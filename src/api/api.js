import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { addDoc, collection, doc, getDoc, getDocs, query, setDoc, Timestamp, updateDoc, where } from 'firebase/firestore';
import { auth, db } from '@/firebase/client.js';
import { quizRepository } from '@/repositories/quizRepository.js';
import { questionRepository } from '@/repositories/questionRepository.js';
import { attemptRepository } from '@/repositories/attemptRepository.js';
import { courseRepository } from '@/repositories/courseRepository.js';
import { evaluateAnswer, isQuestionAutoGraded } from '@/utils/evaluateAnswer.js';

const discussionsCollection = collection(db, 'questionDiscussions');

const SCORE_LEVELS = {
  EXCELLENT: 90,
  GREAT: 75,
  GOOD: 60,
};

const DIFFICULTY_LABELS = {
  1: 'easy',
  2: 'medium',
  3: 'hard',
};

const QUIZ_DIFFICULTY_LABELS = {
  1: 'beginner',
  2: 'intermediate',
  3: 'advanced',
};

const SKILL_CATEGORY_LABELS = {
  1: 'recall',
  2: 'conceptual',
  3: 'application',
};

const QUIZ_SPEED_MULTIPLIERS = [0.5, 1, 1.5, 2];

const inferDifficulty = (tags = []) => {
  const lowered = tags.map((tag) => String(tag).toLowerCase());
  if (lowered.includes('beginner') || lowered.includes('easy')) return 'beginner';
  if (lowered.includes('advanced') || lowered.includes('hard')) return 'advanced';
  return 'intermediate';
};

const toDate = (value) => {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const hasAnswerValue = (value) => String(value ?? '').trim().length > 0;

const resolveEstimatedTime = (quiz, fallbackQuestions = 0) => {
  if (Number.isFinite(Number(quiz?.estimatedTime)) && Number(quiz.estimatedTime) > 0) {
    return Number(quiz.estimatedTime);
  }
  if (quiz?.timing?.enabled && quiz?.timing?.durationSeconds) {
    return Math.max(1, Math.ceil(quiz.timing.durationSeconds / 60));
  }
  return Math.max(1, Math.ceil(fallbackQuestions * 1.5));
};

const resolveIsTimePerQuestion = (quiz) => {
  if (typeof quiz?.isTimePerQuestion === 'boolean') return quiz.isTimePerQuestion;
  return Boolean(quiz?.timing?.perQuestion);
};

const mapQuizTimingForUi = (quiz, questionCount) => {
  const estimatedTime = resolveEstimatedTime(quiz, questionCount);
  return {
    enabled: estimatedTime > 0,
    durationSeconds: Math.round(estimatedTime * 60),
    perQuestion: resolveIsTimePerQuestion(quiz),
  };
};

const mapQuestionForUi = (question) => {
  const metadata = question.metadata || {};
  const difficultyLevel = Number(question.difficulty);
  const skillCategoryLevel = Number(question.skillCategory);
  const type = String(question.type || '').toLowerCase();

  return {
    ...question,
    text: question.question_text || question.text || '',
    type,
    options: Array.isArray(metadata.options) ? metadata.options : [],
    correctAnswer: metadata.correct_answer ?? metadata.correctOption ?? null,
    acceptedAnswers: Array.isArray(metadata.accepted_answers)
      ? metadata.accepted_answers
      : Array.isArray(metadata.acceptedAnswers)
        ? metadata.acceptedAnswers
        : [],
    numericAnswer: metadata.numeric_answer ?? metadata.numericAnswer ?? null,
    tolerance: metadata.tolerance ?? null,
    explanation: question.explanation || '',
    difficulty: DIFFICULTY_LABELS[difficultyLevel] || inferDifficulty(question.tags || []),
    topic: question.topic || question.courseCode || question.tags?.[0] || 'General',
    skillCategory: SKILL_CATEGORY_LABELS[skillCategoryLevel] || 'conceptual',
    difficultyLevel: Number.isFinite(difficultyLevel) ? difficultyLevel : null,
    skillCategoryLevel: Number.isFinite(skillCategoryLevel) ? skillCategoryLevel : null,
  };
};

const resolveQuestionCount = (quiz) => {
  const fromStoredCount = Number(quiz?.questionCount);
  if (Number.isFinite(fromStoredCount) && fromStoredCount >= 0) {
    return fromStoredCount;
  }
  return Array.isArray(quiz?.questionIds) ? quiz.questionIds.length : 0;
};

const mapQuizForList = (quiz, courseByQuizId) => {
  const course = courseByQuizId.get(quiz.id) || null;
  const questionCount = resolveQuestionCount(quiz);
  const estimatedTime = resolveEstimatedTime(quiz, questionCount);

  return {
    id: quiz.id,
    title: quiz.title || quiz.name,
    name: quiz.title || quiz.name,
    description: quiz.description || 'No description provided.',
    topic:
      quiz.topic ||
      course?.topic ||
      course?.courseCode ||
      course?.title ||
      course?.code ||
      course?.name ||
      quiz.courseCode ||
      quiz.tags?.[0] ||
      'General',
    difficulty:
      QUIZ_DIFFICULTY_LABELS[Number(quiz.difficulty)] || inferDifficulty(quiz.tags || []),
    timing: mapQuizTimingForUi(quiz, questionCount),
    isTimePerQuestion: resolveIsTimePerQuestion(quiz),
    questionCount,
    estimatedTime,
    isArchived: Boolean(quiz.isArchived),
  };
};

const ensureUserProfile = async (firebaseUser, preferredDisplayName = '') => {
  const userRef = doc(db, 'users', firebaseUser.uid);
  const existing = await getDoc(userRef);
  const normalizedPreferredName = String(preferredDisplayName || '').trim();
  const fallbackDisplayName =
    normalizedPreferredName ||
    firebaseUser.displayName ||
    firebaseUser.email?.split('@')[0] ||
    'Quiz User';

  if (!existing.exists()) {
    await setDoc(userRef, {
      displayName: fallbackDisplayName,
      email: firebaseUser.email || '',
      createdAt: Timestamp.now(),
      profilePhotoUrl: firebaseUser.photoURL || null,
    });

    if (normalizedPreferredName && normalizedPreferredName !== firebaseUser.displayName) {
      await updateProfile(firebaseUser, { displayName: normalizedPreferredName });
    }
  } else if (normalizedPreferredName) {
    await updateDoc(userRef, { displayName: normalizedPreferredName });
    if (normalizedPreferredName !== firebaseUser.displayName) {
      await updateProfile(firebaseUser, { displayName: normalizedPreferredName });
    }
  }

  const profileSnapshot = await getDoc(userRef);
  const profileData = profileSnapshot.exists() ? profileSnapshot.data() : {};
  const resolvedDisplayName =
    profileData.displayName ||
    firebaseUser.displayName ||
    firebaseUser.email?.split('@')[0] ||
    'Quiz User';

  return {
    id: firebaseUser.uid,
    uid: firebaseUser.uid,
    email: firebaseUser.email || '',
    displayName: resolvedDisplayName,
    profilePhotoUrl: firebaseUser.photoURL || null,
  };
};

export const login = async (email, password) => {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  const user = await ensureUserProfile(credential.user);
  const token = await credential.user.getIdToken();

  return {
    user,
    token,
  };
};

export const register = async (email, password, displayName = '') => {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  const user = await ensureUserProfile(credential.user, displayName);
  const token = await credential.user.getIdToken();

  return {
    user,
    token,
  };
};

export const logout = async () => {
  await signOut(auth);
};

export const updateUserDisplayName = async (displayName) => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Not authenticated');
  }

  const normalizedName = String(displayName || '').trim();
  if (!normalizedName) {
    throw new Error('Name cannot be empty');
  }

  await updateDoc(doc(db, 'users', currentUser.uid), { displayName: normalizedName });
  await updateProfile(currentUser, { displayName: normalizedName });

  return {
    id: currentUser.uid,
    uid: currentUser.uid,
    email: currentUser.email || '',
    displayName: normalizedName,
    profilePhotoUrl: currentUser.photoURL || null,
  };
};

export const getQuizzes = async () => {
  const quizzes = await quizRepository.getQuizzes();
  const courseByQuizId = new Map();

  const activeQuizzes = quizzes.filter((quiz) => quiz?.isArchived !== true);
  return activeQuizzes.map((quiz) => mapQuizForList(quiz, courseByQuizId));
};

export const getCoursesWithQuizzes = async () => {
  const [courses, quizzes] = await Promise.all([
    courseRepository.getCourses(),
    quizRepository.getQuizzes(),
  ]);

  const activeQuizzes = quizzes.filter((quiz) => quiz?.isArchived !== true);
  const quizById = new Map(activeQuizzes.map((quiz) => [quiz.id, quiz]));
  const result = [];

  for (const course of courses) {
    if (course?.isArchived === true) continue;

    const quizIds = Array.isArray(course.quizIds) ? course.quizIds : [];
    const courseQuizMap = new Map(quizIds.map((quizId) => [quizId, course]));
    const quizzesForCourse = [];

    for (const quizId of quizIds) {
      const quiz = quizById.get(quizId);
      if (!quiz) continue;

      const mappedQuiz = mapQuizForList(quiz, courseQuizMap);
      quizzesForCourse.push(mappedQuiz);
    }

    result.push({
      id: course.id,
      title: course.title || course.name || course.topic || 'Untitled Course',
      description: course.description || 'No course description provided.',
      topic: course.topic || 'General',
      courseCode: course.courseCode || null,
      quizCount: quizzesForCourse.length,
      quizzes: quizzesForCourse,
    });
  }

  return result;
};

export const getCoursePageById = async (courseId) => {
  const course = await courseRepository.getCourseById(courseId);
  if (!course || course.isArchived === true) {
    throw new Error('Course not found');
  }

  const quizIds = Array.isArray(course.quizIds) ? course.quizIds : [];
  const linkedQuizzes = await quizRepository.getQuizzesByIds(quizIds);
  const activeQuizById = new Map(
    linkedQuizzes
      .filter((quiz) => quiz?.isArchived !== true)
      .map((quiz) => [quiz.id, quiz])
  );
  const courseQuizMap = new Map(quizIds.map((quizId) => [quizId, course]));
  const quizzes = quizIds
    .map((quizId) => activeQuizById.get(quizId))
    .filter(Boolean)
    .map((quiz) => mapQuizForList(quiz, courseQuizMap));

  return {
    id: course.id,
    title: course.title || course.name || course.topic || 'Untitled Course',
    description: course.description || 'No course description provided.',
    topic: course.topic || 'General',
    courseCode: course.courseCode || null,
    quizCount: quizzes.length,
    quizzes,
  };
};

export const createCourse = async (payload) => {
  return courseRepository.createCourse(payload);
};

export const updateCourse = async (courseId, payload) => {
  return courseRepository.updateCourse(courseId, payload);
};

const uniqueStringIds = (items) =>
  Array.from(
    new Set(
      (Array.isArray(items) ? items : [])
        .map((item) => String(item || '').trim())
        .filter(Boolean)
    )
  );

const uniqueOrderedIds = (items) => {
  const seen = new Set();
  const result = [];

  for (const item of Array.isArray(items) ? items : []) {
    const normalized = String(item || '').trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }

  return result;
};

const shuffleArray = (items) => {
  const copied = [...items];
  for (let index = copied.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copied[index], copied[swapIndex]] = [copied[swapIndex], copied[index]];
  }
  return copied;
};

const normalizeSpeedMultiplier = (value) => {
  const numericValue = Number(value);
  if (QUIZ_SPEED_MULTIPLIERS.includes(numericValue)) return numericValue;
  return 1;
};

const buildAttemptTimingFromQuiz = ({ quiz, questionCount, mode, speedMultiplier }) => {
  const estimatedTimeMinutes = resolveEstimatedTime(quiz, questionCount);
  const baseDurationSeconds = Math.max(1, Math.round(estimatedTimeMinutes * 60));
  const normalizedMode = mode === 'untimed' ? 'untimed' : 'timed';
  const normalizedSpeed = normalizeSpeedMultiplier(speedMultiplier);
  const effectiveDurationSeconds =
    normalizedMode === 'untimed'
      ? null
      : Math.max(1, Math.round(baseDurationSeconds / normalizedSpeed));

  return {
    timingSnapshot: {
      enabled: normalizedMode !== 'untimed',
      durationSeconds: effectiveDurationSeconds,
      perQuestion: resolveIsTimePerQuestion(quiz),
      mode: normalizedMode,
      speedMultiplier: normalizedMode === 'untimed' ? null : normalizedSpeed,
      baseDurationSeconds,
    },
    baseDurationSeconds,
    effectiveDurationSeconds,
    speedMultiplier: normalizedSpeed,
    mode: normalizedMode,
  };
};

const orderQuestionsForAttempt = (questions, attempt) => {
  const questionOrder = uniqueOrderedIds(attempt?.questionOrder || []);
  if (questionOrder.length === 0) return questions;

  const questionById = new Map((Array.isArray(questions) ? questions : []).map((question) => [question.id, question]));
  const ordered = [];

  questionOrder.forEach((questionId) => {
    const matched = questionById.get(questionId);
    if (!matched) return;
    ordered.push(matched);
    questionById.delete(questionId);
  });

  return [...ordered, ...Array.from(questionById.values())];
};

const toStableString = (value) => {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => toStableString(entry)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort((a, b) => a.localeCompare(b));
    return `{${keys.map((key) => `${JSON.stringify(key)}:${toStableString(value[key])}`).join(',')}}`;
  }

  return JSON.stringify(value);
};

const buildQuestionSemanticKey = (question) =>
  toStableString({
    type: question?.type || '',
    question_text: question?.question_text || '',
    metadata: question?.metadata || {},
    difficulty: Number(question?.difficulty) || 0,
    topic: question?.topic || '',
    skillCategory: Number(question?.skillCategory) || 0,
    explanation: question?.explanation || '',
    isArchived: Boolean(question?.isArchived),
  });

const buildQuizSemanticKey = (quiz) =>
  toStableString({
    title: quiz?.title || '',
    description: quiz?.description || '',
    topic: quiz?.topic || '',
    difficulty: Number(quiz?.difficulty) || 0,
    estimatedTime: Number(quiz?.estimatedTime) || 0,
    isTimePerQuestion: Boolean(quiz?.isTimePerQuestion),
    questionIds: Array.isArray(quiz?.questionIds) ? quiz.questionIds : [],
    isArchived: Boolean(quiz?.isArchived),
  });

const buildCourseSemanticKey = (course) =>
  toStableString({
    title: course?.title || '',
    description: course?.description || '',
    courseCode: course?.courseCode || '',
    topic: course?.topic || '',
    quizIds: Array.isArray(course?.quizIds) ? course.quizIds : [],
    isArchived: Boolean(course?.isArchived),
  });

const findDuplicateGroups = (items, keyBuilder) => {
  const bySignature = new Map();

  for (const item of items) {
    const signature = keyBuilder(item);
    if (!bySignature.has(signature)) bySignature.set(signature, []);
    bySignature.get(signature).push(item);
  }

  return Array.from(bySignature.values()).filter((group) => group.length > 1);
};

const normalizeQuestionUploadPayload = (payload) => {
  const candidate = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.questions)
      ? payload.questions
      : null;

  if (!candidate) {
    throw new Error('Uploaded JSON must be an array or an object with a "questions" array');
  }

  if (candidate.length === 0) {
    throw new Error('Uploaded questions array is empty');
  }

  return candidate;
};

const attachQuizToCourse = async (quizId, courseId) => {
  if (!courseId) return null;

  const course = await courseRepository.getCourseById(courseId);
  if (!course) {
    throw new Error('Selected course was not found');
  }

  const mergedQuizIds = uniqueStringIds([...(course.quizIds || []), quizId]);
  return courseRepository.updateCourse(courseId, {
    ...course,
    quizIds: mergedQuizIds,
  });
};

const getDiscussionDocumentByQuestionId = async (questionId) => {
  const discussionQuery = query(discussionsCollection, where('question_id', '==', questionId));
  const snapshot = await getDocs(discussionQuery);
  if (snapshot.empty) return null;
  const first = snapshot.docs[0];
  return { id: first.id, ...first.data() };
};

const buildDefaultAdminComment = (question) => {
  const questionId = String(question?.id || '');
  return {
    id: `${questionId}-admin-default`,
    userId: 'admin',
    displayName: 'Admin',
    comment_text: String(question?.explanation || '').trim() || 'Explanation unavailable for this question.',
    upvotes: 0,
    downvotes: 0,
    admin_rated: true,
    createdAt: Timestamp.now(),
    lastModified: Timestamp.now(),
    isArchived: false,
  };
};

const ensureDiscussionForQuestion = async (question) => {
  if (!question?.id) return null;

  const existing = await getDiscussionDocumentByQuestionId(question.id);
  if (existing) return existing;

  const defaultComment = buildDefaultAdminComment(question);
  const createdRef = await addDoc(discussionsCollection, {
    question_id: question.id,
    createdAt: Timestamp.now(),
    lastModified: Timestamp.now(),
    comments: [defaultComment],
  });

  const createdSnapshot = await getDoc(doc(db, 'questionDiscussions', createdRef.id));
  return createdSnapshot.exists() ? { id: createdSnapshot.id, ...createdSnapshot.data() } : null;
};

const ensureDiscussionForQuestionId = async (questionId) => {
  const existing = await getDiscussionDocumentByQuestionId(questionId);
  if (existing) return existing;

  const question = await questionRepository.getQuestionById(questionId);
  if (!question) {
    throw new Error('Question not found');
  }

  return ensureDiscussionForQuestion(question);
};

const toIsoDate = (value) => toDate(value)?.toISOString() || new Date().toISOString();

const mapDiscussionCommentForUi = (comment, fallbackId = '') => ({
  id: String(comment?.id || fallbackId),
  text: String(comment?.comment_text || '').trim(),
  author: String(comment?.displayName || 'Anonymous').trim() || 'Anonymous',
  status: comment?.admin_rated ? 'clarified' : 'new',
  upvotes: Number(comment?.upvotes || 0),
  createdAt: toIsoDate(comment?.createdAt),
});

const mapDiscussionCommentsForUi = (discussion) => {
  const rawComments = Array.isArray(discussion?.comments) ? discussion.comments : [];
  const mapped = rawComments
    .filter((comment) => comment?.isArchived !== true)
    .map((comment, index) => mapDiscussionCommentForUi(comment, `${discussion?.id || 'discussion'}-${index}`));

  return mapped.sort((a, b) => {
    if (b.upvotes !== a.upvotes) return b.upvotes - a.upvotes;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
};

export const getAdminContentSnapshot = async () => {
  const [courses, quizzes, questions] = await Promise.all([
    courseRepository.getCourses(),
    quizRepository.getQuizzes(),
    questionRepository.getQuestions(),
  ]);

  return {
    courses,
    quizzes,
    questions,
  };
};

export const createAdminQuestion = async (payload) => {
  const createdQuestion = await questionRepository.createQuestion(payload);
  await ensureDiscussionForQuestion(createdQuestion);
  return createdQuestion;
};

export const updateAdminQuestion = async (questionId, payload) => {
  return questionRepository.updateQuestion(questionId, payload);
};

export const archiveAdminQuestion = async (questionId, archived = true) => {
  const existing = await questionRepository.getQuestionById(questionId);
  if (!existing) {
    throw new Error('Question not found');
  }

  return questionRepository.updateQuestion(questionId, {
    ...existing,
    isArchived: Boolean(archived),
  });
};

export const createAdminQuiz = async ({ quiz, courseId }) => {
  const createdQuiz = await quizRepository.createQuiz(quiz);
  await attachQuizToCourse(createdQuiz.id, courseId);
  return createdQuiz;
};

export const updateAdminQuiz = async (quizId, payload) => {
  return quizRepository.updateQuiz(quizId, payload);
};

export const archiveAdminQuiz = async (quizId, archived = true) => {
  const existing = await quizRepository.getQuizById(quizId);
  if (!existing) {
    throw new Error('Quiz not found');
  }

  return quizRepository.updateQuiz(quizId, {
    ...existing,
    isArchived: Boolean(archived),
  });
};

export const addQuestionsToQuiz = async (quizId, questionIds = []) => {
  const quiz = await quizRepository.getQuizById(quizId);
  if (!quiz) {
    throw new Error('Quiz not found');
  }

  const nextQuestionIds = uniqueStringIds([...(quiz.questionIds || []), ...questionIds]);
  return quizRepository.updateQuiz(quizId, {
    ...quiz,
    questionIds: nextQuestionIds,
  });
};

export const removeQuestionFromQuiz = async (quizId, questionId) => {
  const quiz = await quizRepository.getQuizById(quizId);
  if (!quiz) {
    throw new Error('Quiz not found');
  }

  const nextQuestionIds = (quiz.questionIds || []).filter((id) => id !== questionId);
  return quizRepository.updateQuiz(quizId, {
    ...quiz,
    questionIds: nextQuestionIds,
  });
};

export const createAdminCourse = async (payload) => {
  return courseRepository.createCourse(payload);
};

export const updateAdminCourse = async (courseId, payload) => {
  return courseRepository.updateCourse(courseId, payload);
};

export const archiveAdminCourse = async (courseId, archived = true) => {
  const existing = await courseRepository.getCourseById(courseId);
  if (!existing) {
    throw new Error('Course not found');
  }

  return courseRepository.updateCourse(courseId, {
    ...existing,
    isArchived: Boolean(archived),
  });
};

export const createQuizFromQuestionUpload = async ({
  quizPayload,
  uploadPayload,
  courseId = '',
}) => {
  const uploadedQuestions = normalizeQuestionUploadPayload(uploadPayload);
  const createdQuestionIds = [];

  for (const questionPayload of uploadedQuestions) {
    const createdQuestion = await questionRepository.createQuestion({
      ...questionPayload,
      isArchived: Boolean(questionPayload?.isArchived),
    });
    await ensureDiscussionForQuestion(createdQuestion);
    createdQuestionIds.push(createdQuestion.id);
  }

  const createdQuiz = await quizRepository.createQuiz({
    ...quizPayload,
    questionIds: uniqueStringIds([...(quizPayload?.questionIds || []), ...createdQuestionIds]),
    isArchived: Boolean(quizPayload?.isArchived),
  });

  await attachQuizToCourse(createdQuiz.id, courseId);

  return {
    quiz: createdQuiz,
    questionCount: createdQuestionIds.length,
    questionIds: createdQuestionIds,
  };
};

export const removeDuplicateAdminContent = async ({ onProgress } = {}) => {
  const progressCallback = typeof onProgress === 'function' ? onProgress : () => {};
  const report = (progress, message) => {
    progressCallback({
      progress: Math.max(0, Math.min(100, Math.round(progress))),
      message: String(message || ''),
    });
  };

  report(2, 'Loading all courses, quizzes, and questions...');
  const snapshot = await getAdminContentSnapshot();
  const questions = Array.isArray(snapshot.questions) ? [...snapshot.questions] : [];
  const quizzes = Array.isArray(snapshot.quizzes) ? [...snapshot.quizzes] : [];
  const courses = Array.isArray(snapshot.courses) ? [...snapshot.courses] : [];

  const summary = {
    deleted: {
      questions: 0,
      quizzes: 0,
      courses: 0,
      total: 0,
    },
    updated: {
      quizzes: 0,
      courses: 0,
    },
    duplicateGroups: {
      questions: 0,
      quizzes: 0,
      courses: 0,
    },
  };

  report(10, 'Checking for duplicates across questions...');
  const questionGroups = findDuplicateGroups(questions, buildQuestionSemanticKey);
  summary.duplicateGroups.questions = questionGroups.length;

  const questionReplacementMap = new Map();
  const duplicateQuestionIds = [];
  questionGroups.forEach((group) => {
    const sorted = [...group].sort((a, b) => String(a.id).localeCompare(String(b.id)));
    const keeperId = sorted[0].id;
    sorted.slice(1).forEach((duplicate) => {
      duplicateQuestionIds.push(duplicate.id);
      questionReplacementMap.set(duplicate.id, keeperId);
    });
  });

  report(
    20,
    duplicateQuestionIds.length > 0
      ? `Found ${duplicateQuestionIds.length} duplicate questions. Rewriting quiz references...`
      : 'No duplicate questions found.'
  );

  if (questionReplacementMap.size > 0) {
    for (const quiz of quizzes) {
      const sourceIds = Array.isArray(quiz.questionIds) ? quiz.questionIds : [];
      const replacedIds = sourceIds.map((questionId) => questionReplacementMap.get(questionId) || questionId);
      const normalizedIds = uniqueOrderedIds(replacedIds);
      const changed =
        normalizedIds.length !== sourceIds.length ||
        normalizedIds.some((questionId, index) => questionId !== sourceIds[index]);

      if (!changed) continue;

      await quizRepository.updateQuiz(quiz.id, {
        ...quiz,
        questionIds: normalizedIds,
      });
      summary.updated.quizzes += 1;
      quiz.questionIds = normalizedIds;
    }

    report(33, `Deleting ${duplicateQuestionIds.length} duplicate question records...`);
    for (const duplicateQuestionId of duplicateQuestionIds) {
      await questionRepository.deleteQuestion(duplicateQuestionId);
      summary.deleted.questions += 1;
    }
  }

  report(45, 'Checking for duplicates across quizzes...');
  const quizGroups = findDuplicateGroups(quizzes, buildQuizSemanticKey);
  summary.duplicateGroups.quizzes = quizGroups.length;

  const quizReplacementMap = new Map();
  const duplicateQuizIds = [];
  quizGroups.forEach((group) => {
    const sorted = [...group].sort((a, b) => String(a.id).localeCompare(String(b.id)));
    const keeperId = sorted[0].id;
    sorted.slice(1).forEach((duplicate) => {
      duplicateQuizIds.push(duplicate.id);
      quizReplacementMap.set(duplicate.id, keeperId);
    });
  });

  report(
    57,
    duplicateQuizIds.length > 0
      ? `Found ${duplicateQuizIds.length} duplicate quizzes. Rewriting course references...`
      : 'No duplicate quizzes found.'
  );

  if (quizReplacementMap.size > 0) {
    for (const course of courses) {
      const sourceIds = Array.isArray(course.quizIds) ? course.quizIds : [];
      const replacedIds = sourceIds.map((quizId) => quizReplacementMap.get(quizId) || quizId);
      const normalizedIds = uniqueOrderedIds(replacedIds);
      const changed =
        normalizedIds.length !== sourceIds.length ||
        normalizedIds.some((quizId, index) => quizId !== sourceIds[index]);

      if (!changed) continue;

      await courseRepository.updateCourse(course.id, {
        ...course,
        quizIds: normalizedIds,
      });
      summary.updated.courses += 1;
      course.quizIds = normalizedIds;
    }

    report(68, `Deleting ${duplicateQuizIds.length} duplicate quiz records...`);
    for (const duplicateQuizId of duplicateQuizIds) {
      await quizRepository.deleteQuiz(duplicateQuizId);
      summary.deleted.quizzes += 1;
    }
  }

  report(80, 'Checking for duplicates across courses...');
  const courseGroups = findDuplicateGroups(courses, buildCourseSemanticKey);
  summary.duplicateGroups.courses = courseGroups.length;

  const duplicateCourseIds = [];
  courseGroups.forEach((group) => {
    const sorted = [...group].sort((a, b) => String(a.id).localeCompare(String(b.id)));
    sorted.slice(1).forEach((duplicate) => duplicateCourseIds.push(duplicate.id));
  });

  report(
    90,
    duplicateCourseIds.length > 0
      ? `Found ${duplicateCourseIds.length} duplicate courses. Deleting duplicates...`
      : 'No duplicate courses found.'
  );

  if (duplicateCourseIds.length > 0) {
    for (const duplicateCourseId of duplicateCourseIds) {
      await courseRepository.deleteCourse(duplicateCourseId);
      summary.deleted.courses += 1;
    }
  }

  summary.deleted.total =
    summary.deleted.questions + summary.deleted.quizzes + summary.deleted.courses;

  report(
    100,
    `Duplicate cleanup completed. Deleted ${summary.deleted.total} records.`
  );

  return summary;
};

export const getQuizById = async (quizId) => {
  const quiz = await quizRepository.getQuizById(quizId);
  if (!quiz || quiz.isArchived === true) {
    throw new Error('Quiz not found');
  }

  const questions = await quizRepository.getQuizQuestions(quizId);
  const mappedQuestions = questions.map(mapQuestionForUi);
  const estimatedTime = resolveEstimatedTime(quiz, mappedQuestions.length);
  const timing = mapQuizTimingForUi(quiz, mappedQuestions.length);

  return {
    id: quiz.id,
    title: quiz.title || quiz.name,
    name: quiz.title || quiz.name,
    description: quiz.description || '',
    topic:
      quiz.topic ||
      quiz.courseCode ||
      quiz.tags?.[0] ||
      'General',
    difficulty:
      QUIZ_DIFFICULTY_LABELS[Number(quiz.difficulty)] || inferDifficulty(quiz.tags || []),
    timing,
    isTimePerQuestion: resolveIsTimePerQuestion(quiz),
    questionCount: mappedQuestions.length,
    estimatedTime,
    questions: mappedQuestions,
  };
};

export const getQuizPageById = async (quizId) => {
  const quiz = await getQuizById(quizId);
  const associatedCourses = await courseRepository.getCoursesByQuizId(quizId);

  return {
    ...quiz,
    associatedCourses: associatedCourses.map((course) => ({
      id: course.id,
      title: course.title || course.name || course.topic || 'Untitled Course',
      description: course.description || 'No course description provided.',
      topic: course.topic || 'General',
      courseCode: course.courseCode || null,
      quizCount: Number(course.quizCount || 0),
    })),
  };
};

export const startAttempt = async (quizId, userId) => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Not authenticated');
  }
  if (currentUser.uid !== userId) {
    throw new Error('You can only create attempts for the signed-in user');
  }

  const quiz = await quizRepository.getQuizById(quizId);
  if (!quiz || quiz.isArchived === true) {
    throw new Error('Quiz not found');
  }

  const questionCount = resolveQuestionCount(quiz);
  const { timingSnapshot } = buildAttemptTimingFromQuiz({
    quiz,
    questionCount,
    mode: 'timed',
    speedMultiplier: 1,
  });

  return attemptRepository.createAttempt({
    userId,
    quizId,
    timingSnapshot,
  });
};

export const getAttemptById = async (attemptId) => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Not authenticated');
  }

  const attempt = await attemptRepository.getAttemptById(attemptId);
  if (!attempt) {
    throw new Error('Attempt not found');
  }
  if (attempt.userId !== currentUser.uid) {
    throw new Error('You can only access your own attempts');
  }

  return attempt;
};

export const configureAttempt = async (
  attemptId,
  { mode = 'timed', speedMultiplier = 1, allowBreaks = false } = {}
) => {
  const attempt = await getAttemptById(attemptId);
  if (attempt.status !== 'in_progress') {
    throw new Error('Only in-progress attempts can be configured');
  }

  const quiz = await quizRepository.getQuizById(attempt.quizId);
  if (!quiz || quiz.isArchived === true) {
    throw new Error('Quiz not found');
  }

  const baseOrder = uniqueOrderedIds(Array.isArray(quiz.questionIds) ? quiz.questionIds : []);
  const questionOrder = shuffleArray(baseOrder);
  const timing = buildAttemptTimingFromQuiz({
    quiz,
    questionCount: baseOrder.length,
    mode,
    speedMultiplier,
  });

  const attemptConfig = {
    mode: timing.mode,
    speedMultiplier: timing.mode === 'untimed' ? null : timing.speedMultiplier,
    allowBreaks: Boolean(allowBreaks),
    baseDurationSeconds: timing.baseDurationSeconds,
    effectiveDurationSeconds: timing.effectiveDurationSeconds,
    configuredAt: Timestamp.now(),
  };

  return attemptRepository.configureAttempt({
    attemptId,
    timingSnapshot: timing.timingSnapshot,
    attemptConfig,
    questionOrder,
  });
};

export const getAttemptQuizSession = async (attemptId) => {
  let attempt = await getAttemptById(attemptId);
  if (attempt.status !== 'in_progress') {
    throw new Error('This attempt is no longer active');
  }
  if (!Array.isArray(attempt.questionOrder) || attempt.questionOrder.length === 0) {
    attempt = await configureAttempt(attemptId, {
      mode: attempt?.attemptConfig?.mode || (attempt?.timingSnapshot?.enabled === false ? 'untimed' : 'timed'),
      speedMultiplier: Number(attempt?.attemptConfig?.speedMultiplier ?? attempt?.timingSnapshot?.speedMultiplier ?? 1),
      allowBreaks: Boolean(attempt?.attemptConfig?.allowBreaks),
    });
  }
  const quiz = await getQuizById(attempt.quizId);
  const orderedQuestions = orderQuestionsForAttempt(quiz.questions, attempt);
  const mode = attempt?.attemptConfig?.mode || (attempt?.timingSnapshot?.enabled === false ? 'untimed' : 'timed');
  const allowBreaks = Boolean(attempt?.attemptConfig?.allowBreaks);
  const speedMultiplier =
    mode === 'untimed'
      ? null
      : Number(attempt?.attemptConfig?.speedMultiplier ?? attempt?.timingSnapshot?.speedMultiplier ?? 1);
  const effectiveDurationCandidate =
    attempt?.attemptConfig?.effectiveDurationSeconds ??
    attempt?.timingSnapshot?.durationSeconds ??
    quiz?.timing?.durationSeconds;
  const effectiveDurationSeconds = Number.isFinite(Number(effectiveDurationCandidate))
    ? Number(effectiveDurationCandidate)
    : null;

  return {
    attempt: {
      ...attempt,
      questionOrder: uniqueOrderedIds(attempt?.questionOrder || orderedQuestions.map((question) => question.id)),
    },
    quiz: {
      ...quiz,
      questions: orderedQuestions,
      timing:
        mode === 'untimed'
          ? {
            ...quiz.timing,
            enabled: false,
            durationSeconds: null,
          }
          : {
            ...quiz.timing,
            enabled: true,
            durationSeconds: Number.isFinite(effectiveDurationSeconds) ? effectiveDurationSeconds : quiz?.timing?.durationSeconds,
          },
      attemptConfig: {
        mode,
        speedMultiplier,
        allowBreaks,
      },
    },
  };
};

export const submitAnswer = async (attemptId, questionId, selectedAnswer) => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Not authenticated');
  }

  return attemptRepository.upsertAttemptAnswer({
    attemptId,
    questionId,
    userId: currentUser.uid,
    answer: String(selectedAnswer ?? ''),
  });
};

export const terminateAttempt = async (attemptId) => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Not authenticated');
  }

  const attempt = await attemptRepository.getAttemptById(attemptId);
  if (!attempt) {
    throw new Error('Attempt not found');
  }
  if (attempt.userId !== currentUser.uid) {
    throw new Error('You can only terminate your own attempts');
  }
  if (attempt.status !== 'in_progress') {
    return { attemptId, status: attempt.status };
  }

  await attemptRepository.abandonAttempt({ attemptId });
  return { attemptId, status: 'abandoned' };
};

export const submitQuiz = async (attemptId) => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Not authenticated');
  }

  const attempt = await attemptRepository.getAttemptById(attemptId);
  if (!attempt) {
    throw new Error('Attempt not found');
  }
  if (attempt.userId !== currentUser.uid) {
    throw new Error('You can only submit your own attempts');
  }

  const quiz = await getQuizById(attempt.quizId);
  const orderedQuestions = orderQuestionsForAttempt(quiz.questions, attempt);
  const answerDocs = await attemptRepository.getAttemptAnswers(attemptId, currentUser.uid);
  const answerByQuestionId = new Map(
    answerDocs.map((answerDoc) => [answerDoc.questionId, String(answerDoc.answer ?? '')])
  );

  const autoGradedQuestions = orderedQuestions.filter((question) => isQuestionAutoGraded(question));
  const correctAnswers = autoGradedQuestions.reduce((total, question) => {
    const userAnswer = answerByQuestionId.get(question.id) || '';
    return total + (evaluateAnswer(question, userAnswer) ? 1 : 0);
  }, 0);

  const score =
    autoGradedQuestions.length > 0
      ? Math.round((correctAnswers / autoGradedQuestions.length) * 100)
      : 0;

  await attemptRepository.submitAttempt({ attemptId, score });

  return { attemptId };
};

const buildSkillBreakdown = (questions, answerByQuestionId) => {
  const buckets = {};

  questions.forEach((question) => {
    if (!isQuestionAutoGraded(question)) return;

    const key = question.skillCategory || 'conceptual';
    if (!buckets[key]) {
      buckets[key] = { total: 0, correct: 0, accuracy: 0 };
    }

    buckets[key].total += 1;
    const selectedAnswer = answerByQuestionId.get(question.id) || '';
    if (evaluateAnswer(question, selectedAnswer)) {
      buckets[key].correct += 1;
    }
  });

  Object.keys(buckets).forEach((key) => {
    const value = buckets[key];
    value.accuracy = value.total > 0 ? Math.round((value.correct / value.total) * 100) : 0;
  });

  return buckets;
};

const buildTopicBreakdown = (questions, answerByQuestionId) => {
  const topicStats = new Map();

  questions.forEach((question) => {
    if (!isQuestionAutoGraded(question)) return;

    const topic = question.topic || 'General';
    if (!topicStats.has(topic)) {
      topicStats.set(topic, { topic, total: 0, correct: 0, accuracy: 0 });
    }

    const stats = topicStats.get(topic);
    stats.total += 1;

    const selectedAnswer = answerByQuestionId.get(question.id) || '';
    if (evaluateAnswer(question, selectedAnswer)) {
      stats.correct += 1;
    }
  });

  const topicBreakdown = Array.from(topicStats.values()).map((stats) => ({
    ...stats,
    accuracy: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0,
  }));

  const weaknesses = topicBreakdown
    .filter((topic) => topic.accuracy < SCORE_LEVELS.GREAT)
    .sort((a, b) => a.accuracy - b.accuracy)
    .map((topic) => ({ topic: topic.topic, accuracy: topic.accuracy }));

  return { topicBreakdown, weaknesses };
};

const buildDiagnosis = (score) => {
  if (score >= SCORE_LEVELS.EXCELLENT) {
    return 'Excellent work. Keep increasing difficulty and practice mixed-question sets to maintain your edge.';
  }
  if (score >= SCORE_LEVELS.GREAT) {
    return 'Strong performance. Focus targeted review on your weakest topics to push into the top score band.';
  }
  if (score >= SCORE_LEVELS.GOOD) {
    return 'Decent foundation. Revisit core concepts and then retake similar quizzes to improve consistency.';
  }
  return 'You are still building fundamentals. Slow down, review explanations, and practice topic-by-topic before retesting.';
};

export const getResults = async (attemptId) => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Not authenticated');
  }

  const attempt = await attemptRepository.getAttemptById(attemptId);
  if (!attempt || attempt.status !== 'submitted') {
    throw new Error('Results are not available for this attempt yet');
  }
  if (attempt.userId !== currentUser.uid) {
    throw new Error('You can only view your own results');
  }

  const quiz = await getQuizById(attempt.quizId);
  const orderedQuestions = orderQuestionsForAttempt(quiz.questions, attempt);
  const answerDocs = await attemptRepository.getAttemptAnswers(attemptId, currentUser.uid);
  const answerByQuestionId = new Map(
    answerDocs.map((answerDoc) => [answerDoc.questionId, String(answerDoc.answer ?? '')])
  );

  const answers = orderedQuestions.map((question) => {
    const selectedAnswer = answerByQuestionId.get(question.id) || '';
    const isCorrect = evaluateAnswer(question, selectedAnswer);
    const isGradable = isQuestionAutoGraded(question);

    return {
      questionId: question.id,
      selectedAnswer,
      isCorrect,
      isGradable,
      isAnswered: hasAnswerValue(selectedAnswer),
    };
  });

  const correctAnswers = answers.filter((answer) => answer.isCorrect === true).length;
  const totalQuestions = orderedQuestions.length;
  const gradedQuestionsCount = answers.filter((answer) => answer.isGradable).length;
  const score =
    gradedQuestionsCount > 0
      ? Math.round((correctAnswers / gradedQuestionsCount) * 100)
      : Number(attempt.score || 0);

  const skillBreakdown = buildSkillBreakdown(orderedQuestions, answerByQuestionId);
  const { topicBreakdown, weaknesses } = buildTopicBreakdown(orderedQuestions, answerByQuestionId);
  const attemptMode =
    attempt?.attemptConfig?.mode || (attempt?.timingSnapshot?.enabled === false ? 'untimed' : 'timed');

  return {
    attemptId: attempt.id,
    quizId: attempt.quizId,
    score,
    totalQuestions,
    correctAnswers,
    gradedQuestionsCount,
    completedAt: toDate(attempt.submittedAt)?.toISOString() || null,
    attemptConfig: {
      mode: attemptMode,
      speedMultiplier:
        attemptMode === 'untimed'
          ? null
          : Number(attempt?.attemptConfig?.speedMultiplier ?? attempt?.timingSnapshot?.speedMultiplier ?? 1),
      allowBreaks: Boolean(attempt?.attemptConfig?.allowBreaks),
      questionOrder: uniqueOrderedIds(attempt?.questionOrder || orderedQuestions.map((question) => question.id)),
      effectiveDurationSeconds:
        attempt?.attemptConfig?.effectiveDurationSeconds ?? attempt?.timingSnapshot?.durationSeconds ?? null,
      baseDurationSeconds: attempt?.attemptConfig?.baseDurationSeconds ?? attempt?.timingSnapshot?.baseDurationSeconds ?? null,
    },
    topicBreakdown,
    skillBreakdown,
    weaknesses,
    diagnosis: buildDiagnosis(score),
    answers,
  };
};

export const flagQuestion = async () => {
  return { success: true };
};

export const getDiscussion = async (questionId) => {
  const discussion = await ensureDiscussionForQuestionId(questionId);
  return mapDiscussionCommentsForUi(discussion);
};

export const postComment = async (questionId, text, author) => {
  const discussion = await ensureDiscussionForQuestionId(questionId);
  if (!discussion?.id) {
    throw new Error('Discussion not found');
  }

  const rawComments = Array.isArray(discussion.comments) ? discussion.comments : [];
  const nextComment = {
    id: `${questionId}-${Date.now()}`,
    userId: auth.currentUser?.uid || '',
    displayName: String(author || 'Anonymous').trim() || 'Anonymous',
    comment_text: String(text || '').trim(),
    upvotes: 0,
    downvotes: 0,
    admin_rated: false,
    createdAt: Timestamp.now(),
    lastModified: Timestamp.now(),
    isArchived: false,
  };

  const updatedComments = [...rawComments, nextComment];
  await updateDoc(doc(db, 'questionDiscussions', discussion.id), {
    comments: updatedComments,
    lastModified: Timestamp.now(),
  });

  return mapDiscussionCommentForUi(nextComment, nextComment.id);
};

export const upvoteComment = async (questionId, commentId) => {
  const discussion = await ensureDiscussionForQuestionId(questionId);
  if (!discussion?.id) {
    throw new Error('Discussion not found');
  }

  const currentComments = Array.isArray(discussion.comments) ? discussion.comments : [];
  const index = currentComments.findIndex((comment) => String(comment?.id || '') === String(commentId));
  if (index < 0) {
    throw new Error('Comment not found');
  }

  const updatedComments = [...currentComments];
  updatedComments[index] = {
    ...updatedComments[index],
    upvotes: Number(updatedComments[index].upvotes || 0) + 1,
    lastModified: Timestamp.now(),
  };

  await updateDoc(doc(db, 'questionDiscussions', discussion.id), {
    comments: updatedComments,
    lastModified: Timestamp.now(),
  });

  return mapDiscussionCommentForUi(updatedComments[index], commentId);
};

export const getQuestionDetails = async (quizId, questionId) => {
  const quiz = await getQuizById(quizId);
  const questionInQuiz = quiz.questions.find((question) => question.id === questionId);
  if (questionInQuiz) {
    return questionInQuiz;
  }

  const question = await questionRepository.getQuestionById(questionId);
  if (!question) {
    throw new Error('Question not found');
  }

  return mapQuestionForUi(question);
};
