import {
  browserLocalPersistence,
  browserSessionPersistence,
  EmailAuthProvider,
  createUserWithEmailAndPassword,
  linkWithCredential,
  sendPasswordResetEmail,
  setPersistence,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db } from '@/firebase/client.js';
import { quizRepository } from '@/repositories/quizRepository.js';
import { questionRepository } from '@/repositories/questionRepository.js';
import { attemptRepository } from '@/repositories/attemptRepository.js';
import { courseRepository } from '@/repositories/courseRepository.js';
import { evaluateAnswer, isQuestionAutoGraded } from '@/utils/evaluateAnswer.js';
import {
  isUnexpectedFirestoreResponse,
  logUnexpectedFirestoreResponse,
} from '@/utils/firestoreDiagnostics.js';
const GUEST_ATTEMPT_LIMIT = 2;

const discussionsCollection = collection(db, 'questionDiscussions');
const usersCollection = collection(db, 'users');
const attemptsCollection = collection(db, 'userAttempts');
const feedbackCollection = collection(db, 'feedbackEntries');
const adminNotesCollection = collection(db, 'adminNotes');

const SCORE_LEVELS = {
  EXCELLENT: 90,
  GREAT: 75,
  GOOD: 60,
};
const USER_TYPES = {
  GUEST: 'guest',
  REGISTERED: 'registered',
};
const GUEST_ATTEMPT_LIMIT_ERROR_CODE = 'guest-attempt-limit-reached';
export const GUEST_ATTEMPT_LIMIT_REACHED_CODE = GUEST_ATTEMPT_LIMIT_ERROR_CODE;

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

const QUIZ_SPEED_MULTIPLIERS = [0.25, 0.5, 1, 1.5, 2];

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

const normalizeShortDescription = (record) =>
  String(record?.shortDescription || record?.description || '').trim();

const normalizeLongDescription = (record) =>
  String(record?.longDescription || record?.description || record?.shortDescription || '').trim();

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
  const shortDescription = normalizeShortDescription(quiz);
  const longDescription = normalizeLongDescription(quiz) || shortDescription;
  const description = shortDescription || longDescription || 'No description provided.';


  return {
    id: quiz.id,
    title: quiz.title || quiz.name,
    name: quiz.title || quiz.name,
    shortDescription,
    longDescription,
    description,
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
    createdAt: toDate(quiz?.createdAt),
    updatedAt: toDate(quiz?.lastModified),
  };
};

const normalizeDisplayName = (value) => String(value || '').trim();
const normalizeDisplayNameForMatch = (value) => normalizeDisplayName(value).toLowerCase();

const resolveAuthPersistence = (persistenceMode) =>
  String(persistenceMode || '').toLowerCase() === 'session'
    ? browserSessionPersistence
    : browserLocalPersistence;

const normalizeEmailValue = (value) => {
  if (value === null) return null;
  const normalized = String(value || '').trim();
  return normalized ? normalized : null;
};

const resolveDisplayName = (preferredDisplayName, { existingDisplayName, firebaseUser, email }) => {
  const preferred = normalizeDisplayName(preferredDisplayName);
  if (preferred) return preferred;

  const existing = normalizeDisplayName(existingDisplayName);
  if (existing) return existing;

  const authName = normalizeDisplayName(firebaseUser?.displayName);
  if (authName) return authName;

  const normalizedEmail = normalizeEmailValue(email);
  if (normalizedEmail) {
    return normalizedEmail.split('@')[0] || normalizedEmail;
  }

  return 'Guest';
};

const mapSessionUser = (firebaseUser, profileData = {}) => {
  const resolvedEmail = normalizeEmailValue(
    Object.prototype.hasOwnProperty.call(profileData, 'email')
      ? profileData.email
      : firebaseUser?.email ?? null
  );
  const displayName = resolveDisplayName(profileData.displayName, {
    existingDisplayName: profileData.displayName,
    firebaseUser,
    email: resolvedEmail,
  });
  const isGuest = resolvedEmail === null;

  return {
    id: firebaseUser.uid,
    uid: firebaseUser.uid,
    email: resolvedEmail,
    displayName,
    isGuest,
  };
};

const ensureUserProfile = async (
  firebaseUser,
  preferredDisplayName = '',
  { email: requestedEmail } = {}
) => {
  const userRef = doc(db, 'users', firebaseUser.uid);
  const existing = await getDoc(userRef);
  const existingData = existing.exists() ? existing.data() : {};
  const normalizedPreferredName = normalizeDisplayName(preferredDisplayName);
  const normalizedRequestedEmail =
    requestedEmail === undefined ? undefined : normalizeEmailValue(requestedEmail);

  const resolvedEmail = (() => {
    if (requestedEmail !== undefined) return normalizedRequestedEmail;
    if (firebaseUser?.isAnonymous) return null;
    const authEmail = normalizeEmailValue(firebaseUser?.email);
    if (authEmail) return authEmail;
    return normalizeEmailValue(existingData.email);
  })();

  const resolvedDisplayName = resolveDisplayName(normalizedPreferredName, {
    existingDisplayName: existingData.displayName,
    firebaseUser,
    email: resolvedEmail,
  });

  if (!existing.exists()) {
    await setDoc(userRef, {
      displayName: resolvedDisplayName,
      email: resolvedEmail,
      createdAt: serverTimestamp(),
    });
  } else {
    const updates = {};
    if (resolvedDisplayName && resolvedDisplayName !== normalizeDisplayName(existingData.displayName)) {
      updates.displayName = resolvedDisplayName;
    }

    const hasEmailField = Object.prototype.hasOwnProperty.call(existingData, 'email');
    const normalizedExistingEmail = normalizeEmailValue(existingData.email);
    const hasEmptyStringEmail =
      typeof existingData.email === 'string' && existingData.email.trim() === '';
    if (
      resolvedEmail !== normalizedExistingEmail ||
      (hasEmptyStringEmail && resolvedEmail === null) ||
      (!hasEmailField && resolvedEmail === null)
    ) {
      updates.email = resolvedEmail;
    }

    if (!existingData.createdAt) {
      updates.createdAt = serverTimestamp();
    }

    if (Object.keys(updates).length > 0) {
      await updateDoc(userRef, updates);
    }
  }

  if (normalizedPreferredName && normalizedPreferredName !== normalizeDisplayName(firebaseUser.displayName)) {
    await updateProfile(firebaseUser, { displayName: normalizedPreferredName });
  }

  const profileSnapshot = await getDoc(userRef);
  const profileData = profileSnapshot.exists() ? profileSnapshot.data() : {};
  return mapSessionUser(firebaseUser, profileData);
};

const getCurrentSessionIdentity = () => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Not authenticated');
  }

  return {
    currentUser,
    userId: currentUser.uid,
  };
};

const createGuestAttemptLimitError = () => {
  const error = new Error('Guest quiz limit reached. Create an account to unlock unlimited attempts.');
  error.code = GUEST_ATTEMPT_LIMIT_ERROR_CODE;
  return error;
};

const countAttemptsByUserId = async (userId) => {
  const snapshot = await getDocs(query(attemptsCollection, where('userId', '==', userId)));
  return snapshot.size;
};

export const resolveSessionUser = async (
  firebaseUser = auth.currentUser,
  { email } = {}
) => {
  if (!firebaseUser) {
    throw new Error('Not authenticated');
  }

  return ensureUserProfile(firebaseUser, '', { email });
};

export const login = async (email, password, { persistence = 'local' } = {}) => {
  await setPersistence(auth, resolveAuthPersistence(persistence));
  const credential = await signInWithEmailAndPassword(auth, email, password);
  const user = await ensureUserProfile(credential.user, '', { email });
  const token = await credential.user.getIdToken();

  return {
    user,
    token,
  };
};

export const register = async (email, password, displayName = '', { persistence = 'local' } = {}) => {
  const normalizedName = normalizeDisplayName(displayName);
  if (!normalizedName) {
    throw new Error('Display name is required');
  }

  await setPersistence(auth, resolveAuthPersistence(persistence));

  let credential;
  const currentUser = auth.currentUser;
  if (currentUser?.isAnonymous) {
    credential = await linkWithCredential(currentUser, EmailAuthProvider.credential(email, password));
  } else {
    credential = await createUserWithEmailAndPassword(auth, email, password);
  }

  const user = await ensureUserProfile(credential.user, normalizedName, { email });
  const token = await credential.user.getIdToken();

  return {
    user,
    token,
  };
};

export const requestPasswordReset = async ({ email, displayName }) => {
  const normalizedEmail = normalizeEmailValue(email);
  const normalizedName = normalizeDisplayName(displayName);

  if (!normalizedEmail || !normalizedName) {
    throw new Error('Email and display name are required.');
  }

  const userMatches = await getDocs(query(usersCollection, where('email', '==', normalizedEmail)));
  const hasMatchingDisplayName = userMatches.docs.some((snapshot) => {
    const userData = snapshot.data() || {};
    return normalizeDisplayNameForMatch(userData.displayName) === normalizeDisplayNameForMatch(normalizedName);
  });

  if (!hasMatchingDisplayName) {
    throw new Error('Display name and email do not match our records.');
  }

  await sendPasswordResetEmail(auth, normalizedEmail);
  return { email: normalizedEmail, sent: true };
};

export const createGuest = async (displayName = '') => {
  const normalizedName = normalizeDisplayName(displayName);
  if (!normalizedName) {
    throw new Error('Display name is required');
  }

  if (auth.currentUser) {
    throw new Error('You are already signed in');
  }

  const credential = await signInAnonymously(auth);
  const user = await ensureUserProfile(credential.user, normalizedName, { email: null });
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
  const { currentUser, userId } = getCurrentSessionIdentity();

  const normalizedName = String(displayName || '').trim();
  if (!normalizedName) {
    throw new Error('Name cannot be empty');
  }

  await updateDoc(doc(db, 'users', userId), { displayName: normalizedName });
  await updateProfile(currentUser, { displayName: normalizedName });

  return resolveSessionUser(currentUser);
};

export const getQuizzes = async () => {
  const quizzes = await quizRepository.getQuizzes();
  if (isUnexpectedFirestoreResponse(quizzes, 'array')) {
    logUnexpectedFirestoreResponse('getQuizzes', 'array', quizzes);
    return [];
  }
  const courseByQuizId = new Map();

  const activeQuizzes = quizzes.filter((quiz) => quiz?.isArchived !== true);
  return activeQuizzes.map((quiz) => mapQuizForList(quiz, courseByQuizId));
};

export const getCoursesWithQuizzes = async () => {
  const [courses, quizzes] = await Promise.all([
    courseRepository.getCourses(),
    quizRepository.getQuizzes(),
  ]);

  if (isUnexpectedFirestoreResponse(courses, 'array')) {
    logUnexpectedFirestoreResponse('getCoursesWithQuizzes:courses', 'array', courses);
    return [];
  }
  if (isUnexpectedFirestoreResponse(quizzes, 'array')) {
    logUnexpectedFirestoreResponse('getCoursesWithQuizzes:quizzes', 'array', quizzes);
    return [];
  }

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
      shortDescription: normalizeShortDescription(course),
      longDescription:
        normalizeLongDescription(course) || normalizeShortDescription(course),
      description:
        normalizeShortDescription(course) ||
        normalizeLongDescription(course) ||
        'No course description provided.',
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
    shortDescription: normalizeShortDescription(course),
    longDescription:
      normalizeLongDescription(course) || normalizeShortDescription(course),
    description:
      normalizeShortDescription(course) ||
      normalizeLongDescription(course) ||
      'No course description provided.',
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
    shortDescription: normalizeShortDescription(quiz),
    longDescription: normalizeLongDescription(quiz),
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
    shortDescription: normalizeShortDescription(course),
    longDescription: normalizeLongDescription(course),
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

export const getAdminContentSnapshot = async ({
  coursesLimit = null,
  coursesLastDoc = null,
  quizzesLimit = null,
  quizzesLastDoc = null,
  questionsLimit = null,
  questionsLastDoc = null,
} = {}) => {
  const [coursesResult, quizzesResult, questionsResult] = await Promise.all([
    courseRepository.getCourses(coursesLimit, coursesLastDoc),
    quizRepository.getQuizzes(quizzesLimit, quizzesLastDoc),
    questionRepository.getQuestions(questionsLimit, questionsLastDoc),
  ]);

  const courses = Array.isArray(coursesResult) ? coursesResult : coursesResult.items || [];
  const quizzes = Array.isArray(quizzesResult) ? quizzesResult : quizzesResult.items || [];
  const questions = Array.isArray(questionsResult) ? questionsResult : questionsResult.items || [];

  return {
    courses,
    quizzes,
    questions,
    pagination: {
      courses:
        Array.isArray(coursesResult) || !coursesResult
          ? null
          : { lastDoc: coursesResult.lastDoc || null, hasMore: Boolean(coursesResult.hasMore) },
      quizzes:
        Array.isArray(quizzesResult) || !quizzesResult
          ? null
          : { lastDoc: quizzesResult.lastDoc || null, hasMore: Boolean(quizzesResult.hasMore) },
      questions:
        Array.isArray(questionsResult) || !questionsResult
          ? null
          : { lastDoc: questionsResult.lastDoc || null, hasMore: Boolean(questionsResult.hasMore) },
    },
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
  courseIds = [],
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

  if (Array.isArray(courseIds) && courseIds.length > 0) {
    for (const id of courseIds) {
      await attachQuizToCourse(createdQuiz.id, id);
    }
  } else if (typeof courseIds === 'string' && courseIds.trim() !== '') {
    await attachQuizToCourse(createdQuiz.id, courseIds);
  }

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

export const hardDeleteCourse = async (courseId) => {
  return courseRepository.deleteCourse(courseId);
};

export const hardDeleteQuiz = async (quizId) => {
  // 1. Detach from all associated courses
  const associatedCourses = await courseRepository.getCoursesByQuizId(quizId);
  for (const course of associatedCourses) {
    const updatedQuizIds = (course.quizIds || []).filter((id) => id !== quizId);
    await courseRepository.updateCourse(course.id, {
      ...course,
      quizIds: updatedQuizIds,
    });
  }

  // 2. Delete all related attempts (cascading cleanup)
  const attemptsSnapshot = await getDocs(query(attemptsCollection, where('quizId', '==', quizId)));
  for (const attemptDoc of attemptsSnapshot.docs) {
    await deleteAttemptWithAnswers(attemptDoc.id);
  }

  // 3. Delete the quiz record
  return quizRepository.deleteQuiz(quizId);
};

export const hardDeleteQuestion = async (questionId) => {
  // 1. Find and update all quizzes containing this question
  const quizzesSnapshot = await getDocs(
    query(collection(db, 'quizzes'), where('questionIds', 'array-contains', questionId))
  );

  for (const quizDoc of quizzesSnapshot.docs) {
    const quizData = quizDoc.data();
    const updatedQuestionIds = (quizData.questionIds || []).filter((id) => id !== questionId);

    // Update quiz (recomputes questionCount inside repository)
    await quizRepository.updateQuiz(quizDoc.id, {
      ...quizData,
      questionIds: updatedQuestionIds,
    });

    // 2. Cascade cleanup: Delete ALL attempts for quizzes that contained this question
    const attemptsSnapshot = await getDocs(query(attemptsCollection, where('quizId', '==', quizDoc.id)));
    for (const attemptDoc of attemptsSnapshot.docs) {
      await deleteAttemptWithAnswers(attemptDoc.id);
    }
  }

  // 3. Delete all related discussions
  const discussionQuery = query(discussionsCollection, where('question_id', '==', questionId));
  const discussionSnapshot = await getDocs(discussionQuery);
  for (const discussionDoc of discussionSnapshot.docs) {
    await deleteDoc(discussionDoc.ref);
  }

  // 4. Delete the question record
  return questionRepository.deleteQuestion(questionId);
};

const normalizeAdminNotePayload = (payload = {}) => ({
  title: String(payload?.title || '').trim(),
  text: typeof payload?.text === 'string' ? payload.text : String(payload?.text || ''),
});

const mapAdminNote = (snapshot) => {
  const data = snapshot.data() || {};
  return {
    id: snapshot.id,
    title: String(data?.title || '').trim(),
    text: typeof data?.text === 'string' ? data.text : String(data?.text || ''),
    createdAt: toIsoOrNull(data?.createdAt),
    updatedAt: toIsoOrNull(data?.updatedAt || data?.lastModified),
  };
};

export const getAdminNotes = async () => {
  const notesSnapshot = await getDocs(query(adminNotesCollection, orderBy('updatedAt', 'desc')));
  return notesSnapshot.docs.map(mapAdminNote);
};

export const createAdminNote = async (payload = {}) => {
  const normalized = normalizeAdminNotePayload(payload);
  const nowFallback = new Date().toISOString();

  const createdRef = await addDoc(adminNotesCollection, {
    title: normalized.title || 'Untitled note',
    text: normalized.text,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const createdSnapshot = await getDoc(doc(db, 'adminNotes', createdRef.id));
  if (!createdSnapshot.exists()) {
    return {
      id: createdRef.id,
      title: normalized.title || 'Untitled note',
      text: normalized.text,
      createdAt: nowFallback,
      updatedAt: nowFallback,
    };
  }

  return mapAdminNote(createdSnapshot);
};

export const updateAdminNote = async (noteId, payload = {}) => {
  const normalized = normalizeAdminNotePayload(payload);
  const noteRef = doc(db, 'adminNotes', noteId);

  await updateDoc(noteRef, {
    title: normalized.title || 'Untitled note',
    text: normalized.text,
    updatedAt: serverTimestamp(),
  });

  const updatedSnapshot = await getDoc(noteRef);
  if (!updatedSnapshot.exists()) {
    throw new Error('Note not found after update');
  }

  return mapAdminNote(updatedSnapshot);
};

export const hardDeleteAdminNote = async (noteId) => {
  await deleteDoc(doc(db, 'adminNotes', noteId));
  return { id: noteId };
};

const pluralize = (count, singular, plural = `${singular}s`) =>
  `${count} ${count === 1 ? singular : plural}`;

export const getDeleteImpact = async (type, id) => {
  const selectedIds = uniqueOrderedIds(Array.isArray(id) ? id : [id]);
  if (selectedIds.length === 0) {
    return { summary: 'Deletes the selected item and all references.' };
  }

  if (type === 'course') {
    if (selectedIds.length > 1) {
      return {
        summary: `Permanently deletes ${pluralize(selectedIds.length, 'course document')}. Linked quizzes will exist independently.`,
      };
    }

    return {
      summary: 'Permanently deletes this course document. Linked quizzes will exist independently.',
    };
  }

  if (type === 'quiz') {
    const impactedCourseIds = new Set();
    const impactedAttemptIds = new Set();

    const quizImpactEntries = await Promise.all(
      selectedIds.map(async (quizId) => {
        const [associatedCourses, attemptsSnapshot] = await Promise.all([
          courseRepository.getCoursesByQuizId(quizId),
          getDocs(query(attemptsCollection, where('quizId', '==', quizId))),
        ]);
        return { associatedCourses, attemptsSnapshot };
      })
    );

    quizImpactEntries.forEach(({ associatedCourses, attemptsSnapshot }) => {
      associatedCourses.forEach((course) => impactedCourseIds.add(course.id));
      attemptsSnapshot.docs.forEach((attemptDoc) => impactedAttemptIds.add(attemptDoc.id));
    });

    if (selectedIds.length > 1) {
      return {
        summary: `Removes from ${pluralize(impactedCourseIds.size, 'course')}, deletes ${pluralize(impactedAttemptIds.size, 'attempt')}, and deletes ${pluralize(selectedIds.length, 'quiz document')}.`,
      };
    }

    return {
      summary: `Removes from ${impactedCourseIds.size} courses, deletes ${impactedAttemptIds.size} attempts, and deletes the quiz document.`,
    };
  }

  if (type === 'question') {
    const impactedQuizIds = new Set();
    const impactedDiscussionIds = new Set();
    const impactedAttemptIds = new Set();

    const questionImpactEntries = await Promise.all(
      selectedIds.map(async (questionId) => {
        const [quizzesSnapshot, discussionSnapshot] = await Promise.all([
          getDocs(query(collection(db, 'quizzes'), where('questionIds', 'array-contains', questionId))),
          getDocs(query(discussionsCollection, where('question_id', '==', questionId))),
        ]);
        return { quizzesSnapshot, discussionSnapshot };
      })
    );

    questionImpactEntries.forEach(({ quizzesSnapshot, discussionSnapshot }) => {
      quizzesSnapshot.docs.forEach((quizDoc) => impactedQuizIds.add(quizDoc.id));
      discussionSnapshot.docs.forEach((discussionDoc) => impactedDiscussionIds.add(discussionDoc.id));
    });

    const attemptsByQuizEntries = await Promise.all(
      Array.from(impactedQuizIds).map(async (quizId) =>
        getDocs(query(attemptsCollection, where('quizId', '==', quizId)))
      )
    );
    attemptsByQuizEntries.forEach((attemptsSnapshot) => {
      attemptsSnapshot.docs.forEach((attemptDoc) => impactedAttemptIds.add(attemptDoc.id));
    });

    if (selectedIds.length > 1) {
      return {
        summary: `Removes from ${pluralize(impactedQuizIds.size, 'quiz')}, deletes ${pluralize(impactedDiscussionIds.size, 'discussion')}, deletes ${pluralize(impactedAttemptIds.size, 'linked attempt')} for impacted quizzes, and deletes ${pluralize(selectedIds.length, 'question record')}.`,
      };
    }

    return {
      summary: `Removes from ${impactedQuizIds.size} quizzes, deletes ${impactedDiscussionIds.size} discussions, deletes ${impactedAttemptIds.size} linked attempts for those quizzes, and deletes the question record.`,
    };
  }

  return { summary: 'Deletes the selected item and all references.' };
};

const resolveUserTypeFromRecord = (userRecord = {}) => {
  const emailValue = userRecord?.email;
  if (emailValue === null || typeof emailValue === 'undefined') {
    return USER_TYPES.GUEST;
  }
  if (typeof emailValue === 'string' && emailValue.trim() === '') {
    return USER_TYPES.GUEST;
  }
  return USER_TYPES.REGISTERED;
};

const toIsoOrNull = (value) => {
  const parsed = toDate(value);
  return parsed ? parsed.toISOString() : null;
};

export const getAdminUsersSnapshot = async () => {
  const [usersSnapshot, attemptsSnapshot] = await Promise.all([
    getDocs(usersCollection),
    getDocs(attemptsCollection),
  ]);

  const attemptsByUserId = new Map();
  attemptsSnapshot.docs.forEach((attemptDoc) => {
    const data = attemptDoc.data() || {};
    const ownerUserId = String(data.userId || '').trim();
    if (!ownerUserId) return;

    if (!attemptsByUserId.has(ownerUserId)) {
      attemptsByUserId.set(ownerUserId, {
        total: 0,
        submitted: 0,
        inProgress: 0,
      });
    }

    const stats = attemptsByUserId.get(ownerUserId);
    stats.total += 1;
    if (data.status === 'submitted') stats.submitted += 1;
    if (data.status === 'in_progress') stats.inProgress += 1;
  });

  const users = usersSnapshot.docs.map((userDoc) => {
    const userData = userDoc.data() || {};
    const userType = resolveUserTypeFromRecord(userData);
    const stats = attemptsByUserId.get(userDoc.id) || {
      total: 0,
      submitted: 0,
      inProgress: 0,
    };

    return {
      id: userDoc.id,
      displayName: String(userData.displayName || '').trim() || 'Unnamed user',
      email: normalizeEmailValue(userData.email),
      userType,
      isGuest: userType === USER_TYPES.GUEST,
      createdAt: toIsoOrNull(userData.createdAt),
      lastActiveAt: toIsoOrNull(userData.lastActiveAt),
      attemptCount: stats.total,
      submittedAttemptCount: stats.submitted,
      inProgressAttemptCount: stats.inProgress,
    };
  });

  return users.sort((a, b) => {
    const aTime = new Date(a.lastActiveAt || a.createdAt || 0).getTime();
    const bTime = new Date(b.lastActiveAt || b.createdAt || 0).getTime();
    return bTime - aTime;
  });
};

const normalizeFeedbackPayload = (payload = {}) => ({
  reason: payload.reason ? String(payload.reason).trim() : null,
  urgency: payload.urgency ? String(payload.urgency).trim().toLowerCase() : null,
  category: payload.category ? String(payload.category).trim().toLowerCase() : null,
  subject: payload.subject ? String(payload.subject).trim() : null,
  details: payload.details ? String(payload.details).trim() : null,
  contextKey: String(payload.contextKey || 'global').trim(),
  contextLabel: payload.contextLabel ? String(payload.contextLabel).trim() : null,
  subjectType: payload.subjectType ? String(payload.subjectType).trim() : null,
  subjectId: payload.subjectId ? String(payload.subjectId).trim() : null,
  sourcePath: payload.sourcePath ? String(payload.sourcePath).trim() : null,
  sourceSearch: payload.sourceSearch ? String(payload.sourceSearch).trim() : null,
  status: payload.status ? String(payload.status).trim().toLowerCase() : 'new',
  triageNotes: payload.triageNotes ? String(payload.triageNotes).trim() : null,
  tags: Array.isArray(payload.tags)
    ? payload.tags.map((tag) => String(tag).trim()).filter(Boolean)
    : [],
  user:
    payload.user && typeof payload.user === 'object'
      ? {
        uid: payload.user.uid ? String(payload.user.uid).trim() : null,
        email: payload.user.email ? String(payload.user.email).trim() : null,
        displayName: payload.user.displayName ? String(payload.user.displayName).trim() : null,
        isGuest: Boolean(payload.user.isGuest),
      }
      : null,
});

const mapFeedbackEntry = (snapshot) => {
  const data = snapshot.data() || {};
  return {
    id: snapshot.id,
    ...data,
    createdAt: toIsoOrNull(data.createdAt),
    updatedAt: toIsoOrNull(data.updatedAt),
  };
};

export const createFeedbackEntry = async (payload) => {
  const normalized = normalizeFeedbackPayload(payload);

  const docRef = await addDoc(feedbackCollection, {
    ...normalized,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return {
    id: docRef.id,
    ...normalized,
  };
};

export const getFeedbackEntries = async () => {
  const snapshot = await getDocs(query(feedbackCollection, orderBy('createdAt', 'desc')));
  return snapshot.docs.map(mapFeedbackEntry);
};

export const updateFeedbackEntry = async (feedbackId, updates = {}) => {
  const normalized = normalizeFeedbackPayload(updates);
  const feedbackRef = doc(db, 'feedbackEntries', feedbackId);

  await updateDoc(feedbackRef, {
    status: normalized.status || 'new',
    category: normalized.category,
    triageNotes: normalized.triageNotes,
    tags: normalized.tags,
    updatedAt: serverTimestamp(),
  });

  const snapshot = await getDoc(feedbackRef);
  if (!snapshot.exists()) {
    throw new Error('Feedback entry not found.');
  }

  return mapFeedbackEntry(snapshot);
};

const deleteAttemptWithAnswers = async (attemptId) => {
  const answersSnapshot = await getDocs(collection(db, 'userAttempts', attemptId, 'answers'));
  for (const answerDoc of answersSnapshot.docs) {
    await deleteDoc(answerDoc.ref);
  }

  await deleteDoc(doc(db, 'userAttempts', attemptId));
  return {
    answersDeleted: answersSnapshot.size,
  };
};

export const clearUserData = async () => {
  const { userId } = getCurrentSessionIdentity();
  const attemptsSnapshot = await getDocs(query(attemptsCollection, where('userId', '==', userId)));

  let deletedAttempts = 0;
  let deletedAnswers = 0;

  for (const attemptDoc of attemptsSnapshot.docs) {
    const result = await deleteAttemptWithAnswers(attemptDoc.id);
    deletedAttempts += 1;
    deletedAnswers += result.answersDeleted;
  }

  return { deletedAttempts, deletedAnswers };
};

export const deleteAdminGuestUsers = async (userIds = []) => {
  const normalizedIds = uniqueStringIds(userIds);
  if (normalizedIds.length === 0) {
    return {
      deletedUsers: 0,
      deletedAttempts: 0,
      deletedAnswers: 0,
      skippedUsers: 0,
    };
  }

  let deletedUsers = 0;
  let deletedAttempts = 0;
  let deletedAnswers = 0;
  let skippedUsers = 0;

  for (const userId of normalizedIds) {
    const userRef = doc(db, 'users', userId);
    const userSnapshot = await getDoc(userRef);
    if (!userSnapshot.exists()) {
      skippedUsers += 1;
      continue;
    }

    const userData = userSnapshot.data() || {};
    const userType = resolveUserTypeFromRecord(userData);
    if (userType !== USER_TYPES.GUEST) {
      skippedUsers += 1;
      continue;
    }

    const attemptsSnapshot = await getDocs(query(attemptsCollection, where('userId', '==', userId)));
    for (const attemptDoc of attemptsSnapshot.docs) {
      const result = await deleteAttemptWithAnswers(attemptDoc.id);
      deletedAttempts += 1;
      deletedAnswers += result.answersDeleted;
    }

    await deleteDoc(userRef);
    deletedUsers += 1;
  }

  return {
    deletedUsers,
    deletedAttempts,
    deletedAnswers,
    skippedUsers,
  };
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
  const shortDescription = normalizeShortDescription(quiz);
  const longDescription = normalizeLongDescription(quiz) || shortDescription;
  const description = shortDescription || longDescription || '';

  return {
    id: quiz.id,
    title: quiz.title || quiz.name,
    name: quiz.title || quiz.name,
    shortDescription,
    longDescription,
    description,
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
      shortDescription: normalizeShortDescription(course),
      longDescription:
        normalizeLongDescription(course) || normalizeShortDescription(course),
      description:
        normalizeShortDescription(course) ||
        normalizeLongDescription(course) ||
        'No course description provided.',
      topic: course.topic || 'General',
      courseCode: course.courseCode || null,
      quizCount: Number(course.quizCount || 0),
    })),
  };
};

export const startAttempt = async (quizId, userId) => {
  const { currentUser, userId: resolvedUserId } = getCurrentSessionIdentity();
  if (resolvedUserId !== userId) {
    throw new Error('You can only create attempts for the signed-in user');
  }

  const sessionUser = await resolveSessionUser(currentUser);
  const isGuest = Boolean(sessionUser?.isGuest);

  if (isGuest) {
    const attemptCount = await countAttemptsByUserId(resolvedUserId);
    if (attemptCount >= GUEST_ATTEMPT_LIMIT) {
      throw createGuestAttemptLimitError();
    }
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
    userId: resolvedUserId,
    quizId,
    timingSnapshot,
  });
};

export const getAttemptById = async (attemptId) => {
  const { userId } = getCurrentSessionIdentity();

  const attempt = await attemptRepository.getAttemptById(attemptId);
  if (!attempt) {
    throw new Error('Attempt not found');
  }
  if (attempt.userId !== userId) {
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
  const { userId } = getCurrentSessionIdentity();

  return attemptRepository.upsertAttemptAnswer({
    attemptId,
    questionId,
    userId,
    answer: String(selectedAnswer ?? ''),
  });
};

export const terminateAttempt = async (attemptId) => {
  const { userId } = getCurrentSessionIdentity();

  const attempt = await attemptRepository.getAttemptById(attemptId);
  if (!attempt) {
    throw new Error('Attempt not found');
  }
  if (attempt.userId !== userId) {
    throw new Error('You can only terminate your own attempts');
  }
  if (attempt.status !== 'in_progress') {
    return { attemptId, status: attempt.status };
  }

  await attemptRepository.abandonAttempt({ attemptId });
  return { attemptId, status: 'abandoned' };
};

export const submitQuiz = async (attemptId) => {
  const { userId } = getCurrentSessionIdentity();

  const attempt = await attemptRepository.getAttemptById(attemptId);
  if (!attempt) {
    throw new Error('Attempt not found');
  }
  if (attempt.userId !== userId) {
    throw new Error('You can only submit your own attempts');
  }

  const quiz = await getQuizById(attempt.quizId);
  const orderedQuestions = orderQuestionsForAttempt(quiz.questions, attempt);
  const answerDocs = await attemptRepository.getAttemptAnswers(attemptId, userId);
  const answerByQuestionId = new Map(
    answerDocs.map((answerDoc) => [answerDoc.questionId, String(answerDoc.answer ?? '')])
  );

  const analysis = buildAttemptAnalysisFromQuestions({
    orderedQuestions,
    answerByQuestionId,
    quizTopic: quiz.topic,
  });

  const score =
    analysis.gradedQuestionsCount > 0
      ? Math.round((analysis.correctAnswers / analysis.gradedQuestionsCount) * 100)
      : 0;

  await attemptRepository.submitAttempt({ attemptId, score, analysis });

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

const buildDifficultyBreakdown = (questions, answerByQuestionId) => {
  const buckets = {};

  questions.forEach((question) => {
    if (!isQuestionAutoGraded(question)) return;

    const key = question.difficulty || 'medium';
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

const computeAccuracy = (correct, total) => (total > 0 ? Math.round((correct / total) * 100) : 0);

const normalizeTopicBreakdown = (entries = []) =>
  entries
    .map((entry) => {
      const total = Number(entry?.total ?? 0);
      const correct = Number(entry?.correct ?? 0);
      return {
        topic: String(entry?.topic || '').trim(),
        total: Number.isFinite(total) ? total : 0,
        correct: Number.isFinite(correct) ? correct : 0,
        accuracy: computeAccuracy(correct, total),
      };
    })
    .filter((entry) => entry.topic);

const buildAttemptAnalysisFromQuestions = ({ orderedQuestions, answerByQuestionId, quizTopic }) => {
  const { topicBreakdown } = buildTopicBreakdown(orderedQuestions, answerByQuestionId);
  const skillBreakdown = buildSkillBreakdown(orderedQuestions, answerByQuestionId);
  const difficultyBreakdown = buildDifficultyBreakdown(orderedQuestions, answerByQuestionId);
  const autoGradedQuestions = orderedQuestions.filter((question) => isQuestionAutoGraded(question));
  const correctAnswers = autoGradedQuestions.reduce((total, question) => {
    const userAnswer = answerByQuestionId.get(question.id) || '';
    return total + (evaluateAnswer(question, userAnswer) ? 1 : 0);
  }, 0);
  const gradedQuestionsCount = autoGradedQuestions.length;
  const totalQuestions = orderedQuestions.length;

  return {
    questionTopicBreakdown: normalizeTopicBreakdown(topicBreakdown),
    correctAnswers,
    gradedQuestionsCount,
    totalQuestions,
    quizTopic: String(quizTopic || '').trim() || 'General',
    skillBreakdown,
    difficultyBreakdown,
  };
};

const resolveQuizTopic = (quiz) =>
  quiz?.topic || quiz?.courseCode || quiz?.tags?.[0] || 'General';

const resolveAttemptAnalysis = async (attempt, userId) => {
  const storedAnalysis = attempt?.analysis;
  const hasStoredBreakdown = Array.isArray(storedAnalysis?.questionTopicBreakdown);
  const hasStoredTotals =
    Number.isFinite(Number(storedAnalysis?.correctAnswers)) &&
    Number.isFinite(Number(storedAnalysis?.gradedQuestionsCount)) &&
    Number.isFinite(Number(storedAnalysis?.totalQuestions));
  const hasQuizTopic = typeof storedAnalysis?.quizTopic === 'string';

  if (hasStoredBreakdown && hasStoredTotals && hasQuizTopic) {
    return {
      questionTopicBreakdown: normalizeTopicBreakdown(storedAnalysis.questionTopicBreakdown),
      correctAnswers: Number(storedAnalysis.correctAnswers || 0),
      gradedQuestionsCount: Number(storedAnalysis.gradedQuestionsCount || 0),
      totalQuestions: Number(storedAnalysis.totalQuestions || 0),
      quizTopic: String(storedAnalysis.quizTopic || '').trim() || 'General',
      skillBreakdown:
        storedAnalysis?.skillBreakdown && typeof storedAnalysis.skillBreakdown === 'object'
          ? storedAnalysis.skillBreakdown
          : null,
      difficultyBreakdown:
        storedAnalysis?.difficultyBreakdown && typeof storedAnalysis.difficultyBreakdown === 'object'
          ? storedAnalysis.difficultyBreakdown
          : null,
    };
  }

  const quiz = await quizRepository.getQuizById(attempt.quizId);
  if (!quiz) return null;
  const questionIds = Array.isArray(quiz.questionIds) ? quiz.questionIds : [];
  if (questionIds.length === 0) {
    return {
      questionTopicBreakdown: [],
      correctAnswers: 0,
      gradedQuestionsCount: 0,
      totalQuestions: 0,
      quizTopic: resolveQuizTopic(quiz),
      skillBreakdown: {},
      difficultyBreakdown: {},
    };
  }

  const questions = await questionRepository.getQuestionsByIds(questionIds);
  const questionById = new Map(questions.map((question) => [question.id, question]));
  const orderedQuestions = questionIds
    .map((questionId, index) => {
      const question = questionById.get(questionId);
      if (!question) return null;
      return mapQuestionForUi({ ...question, orderIndex: index });
    })
    .filter(Boolean);
  const answerDocs = await attemptRepository.getAttemptAnswers(attempt.id, userId);
  const answerByQuestionId = new Map(
    answerDocs.map((answerDoc) => [answerDoc.questionId, String(answerDoc.answer ?? '')])
  );

  return buildAttemptAnalysisFromQuestions({
    orderedQuestions,
    answerByQuestionId,
    quizTopic: resolveQuizTopic(quiz),
  });
};

const buildProgressSummary = ({ entries, getTopicKey, getAccuracy, getCorrect, getTotal }) => {
  const statsByTopic = new Map();

  entries.forEach((entry) => {
    const topic = getTopicKey(entry);
    if (!topic) return;
    if (!statsByTopic.has(topic)) {
      statsByTopic.set(topic, {
        topic,
        totalCorrect: 0,
        totalQuestions: 0,
        attemptCount: 0,
        history: [],
      });
    }
    const stats = statsByTopic.get(topic);
    const correct = Number(getCorrect(entry) || 0);
    const total = Number(getTotal(entry) || 0);
    const accuracy = Number(getAccuracy(entry) ?? computeAccuracy(correct, total));

    stats.totalCorrect += Number.isFinite(correct) ? correct : 0;
    stats.totalQuestions += Number.isFinite(total) ? total : 0;
    stats.attemptCount += 1;
    stats.history.push({
      accuracy: Number.isFinite(accuracy) ? accuracy : 0,
      submittedAt: entry.submittedAt ?? null,
    });
  });

  return Array.from(statsByTopic.values()).map((stats) => {
    const history = stats.history
      .filter((item) => item.submittedAt instanceof Date)
      .sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());
    const last = history[0] || null;
    const previous = history[1] || null;
    const overallAccuracy = computeAccuracy(stats.totalCorrect, stats.totalQuestions);

    return {
      topic: stats.topic,
      overallAccuracy,
      totalCorrect: stats.totalCorrect,
      totalQuestions: stats.totalQuestions,
      attemptCount: stats.attemptCount,
      lastAccuracy: last ? last.accuracy : null,
      previousAccuracy: previous ? previous.accuracy : null,
      delta: last && previous ? last.accuracy - previous.accuracy : null,
      lastAttemptAt: last ? last.submittedAt.toISOString() : null,
    };
  });
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
  const { userId } = getCurrentSessionIdentity();

  const attempt = await attemptRepository.getAttemptById(attemptId);
  if (!attempt || attempt.status !== 'submitted') {
    throw new Error('Results are not available for this attempt yet');
  }
  if (attempt.userId !== userId) {
    throw new Error('You can only view your own results');
  }

  const quiz = await getQuizById(attempt.quizId);
  const orderedQuestions = orderQuestionsForAttempt(quiz.questions, attempt);
  const answerDocs = await attemptRepository.getAttemptAnswers(attemptId, userId);
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
    quizTopic: quiz.topic || 'General',
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

export const deleteAttempt = async (attemptId) => {
  const { userId } = getCurrentSessionIdentity();
  const attempt = await attemptRepository.getAttemptById(attemptId);
  if (!attempt) return;
  if (attempt.userId !== userId) {
    throw new Error('You can only delete your own attempts');
  }
  await attemptRepository.deleteAttempt(attemptId);
};

export const getUserAttempts = async () => {
  try {
    const { userId } = getCurrentSessionIdentity();

    const attemptsSnapshot = await getDocs(
      query(attemptsCollection, where('userId', '==', userId))
    );

    const enrichedAttempts = [];
    
    // Process attempts individually with try/catch to ensure one failure doesn't break the whole list
    for (const docSnap of attemptsSnapshot.docs) {
      try {
        const data = docSnap.data();
        if (!data || !data.quizId) {
          console.warn('Skipping malformed attempt document:', docSnap.id);
          continue;
        }

        const quiz = await quizRepository.getQuizById(data.quizId).catch(err => {
          console.warn(`Failed to fetch quiz ${data.quizId} for attempt ${docSnap.id}:`, err);
          return null;
        });
        
        // Enrich with analysis for accordion view
        let analysis = null;
        if (data.status === 'submitted') {
          try {
            analysis = await resolveAttemptAnalysis({ id: docSnap.id, ...data }, userId);
          } catch (e) {
            console.warn('Failed to resolve analysis for history item:', docSnap.id, e);
          }
        }

        enrichedAttempts.push({
          id: docSnap.id,
          ...data,
          startedAt: toDate(data.startedAt)?.toISOString(),
          submittedAt: toDate(data.submittedAt)?.toISOString(),
          abandonedAt: toDate(data.abandonedAt)?.toISOString(),
          quizTitle: quiz?.title || quiz?.name || 'Unknown Quiz',
          analysis,
        });
      } catch (itemError) {
        console.error('Unexpected error processing history item:', docSnap.id, itemError);
      }
    }

    // Sort in memory to avoid index requirement
    return enrichedAttempts.sort((a, b) => {
      const aDate = a.startedAt ? new Date(a.startedAt) : new Date(0);
      const bDate = b.startedAt ? new Date(b.startedAt) : new Date(0);
      return bDate - aDate;
    });
  } catch (globalError) {
    console.error('Global failure in getUserAttempts:', globalError);
    return []; // Always return a safe default
  }
};

export const cleanupStaleAttempts = async () => {
  try {
    const { userId } = getCurrentSessionIdentity();
    const q = query(
      attemptsCollection,
      where('userId', '==', userId),
      where('status', '==', 'in_progress')
    );
    const snapshot = await getDocs(q);
    let deletedCount = 0;

    for (const docSnap of snapshot.docs) {
      await deleteDoc(docSnap.ref);
      deletedCount++;
    }

    return { success: true, deletedCount };
  } catch (error) {
    console.error('Failed to cleanup attempts:', error);
    throw error;
  }
};

export const getProgressInsights = async () => {
  const { userId } = getCurrentSessionIdentity();

  const attemptsSnapshot = await getDocs(query(attemptsCollection, where('userId', '==', userId)));
  const attempts = attemptsSnapshot.docs.map((attemptDoc) => ({
    id: attemptDoc.id,
    ...attemptDoc.data(),
  }));
  const submittedAttempts = attempts.filter((attempt) => attempt.status === 'submitted');
  const totalSubmittedAttempts = submittedAttempts.length;

  if (submittedAttempts.length === 0) {
    return {
      questionTopicSummary: [],
      quizTopicSummary: [],
      difficultySummary: [],
      skillSummary: [],
      totalSubmittedAttempts: 0,
    };
  }

  const analysisEntries = [];
  for (const attempt of submittedAttempts) {
    try {
      const analysis = await resolveAttemptAnalysis(attempt, userId);
      if (!analysis) continue;
      analysisEntries.push({
        attemptId: attempt.id,
        submittedAt: toDate(attempt.submittedAt),
        ...analysis,
      });
    } catch (error) {
      console.warn('Failed to build progress analysis for attempt:', attempt?.id, error);
    }
  }

  const questionTopicEntries = [];
  const difficultyEntries = [];
  const skillEntries = [];

  analysisEntries.forEach((entry) => {
    (entry.questionTopicBreakdown || []).forEach((topicEntry) => {
      questionTopicEntries.push({
        topic: topicEntry.topic,
        correct: topicEntry.correct,
        total: topicEntry.total,
        accuracy: topicEntry.accuracy,
        submittedAt: entry.submittedAt,
      });
    });

    // Assume we need to aggregate difficulty and skills from the analysis or the quiz itself
    // For now, we'll try to find difficulty and skills if they are present in the analysis
    // or if we can derive them.
    // However, the analysis only contains topic breakdown.
    // Let's look at skillBreakdown in analysis entries.
    if (entry.skillBreakdown) {
      Object.entries(entry.skillBreakdown).forEach(([skill, stats]) => {
        skillEntries.push({
          skill,
          correct: stats.correct,
          total: stats.total,
          accuracy: stats.accuracy,
          submittedAt: entry.submittedAt,
        });
      });
    }

    if (entry.difficultyBreakdown) {
      Object.entries(entry.difficultyBreakdown).forEach(([difficulty, stats]) => {
        difficultyEntries.push({
          difficulty,
          correct: stats.correct,
          total: stats.total,
          accuracy: stats.accuracy,
          submittedAt: entry.submittedAt,
        });
      });
    }
  });

  const questionTopicSummary = buildProgressSummary({
    entries: questionTopicEntries,
    getTopicKey: (entry) => entry.topic,
    getAccuracy: (entry) => entry.accuracy,
    getCorrect: (entry) => entry.correct,
    getTotal: (entry) => entry.total,
  }).sort((a, b) => {
    if (b.overallAccuracy !== a.overallAccuracy) return b.overallAccuracy - a.overallAccuracy;
    return a.topic.localeCompare(b.topic);
  });

  const quizTopicEntries = analysisEntries.map((entry) => ({
    topic: String(entry.quizTopic || '').trim() || 'General',
    correct: entry.correctAnswers,
    total: entry.gradedQuestionsCount,
    accuracy: computeAccuracy(entry.correctAnswers, entry.gradedQuestionsCount),
    submittedAt: entry.submittedAt,
  }));

  const quizTopicSummary = buildProgressSummary({
    entries: quizTopicEntries,
    getTopicKey: (entry) => entry.topic,
    getAccuracy: (entry) => entry.accuracy,
    getCorrect: (entry) => entry.correct,
    getTotal: (entry) => entry.total,
  }).sort((a, b) => {
    if (b.overallAccuracy !== a.overallAccuracy) return b.overallAccuracy - a.overallAccuracy;
    return a.topic.localeCompare(b.topic);
  });

  const skillSummary = buildProgressSummary({
    entries: skillEntries,
    getTopicKey: (entry) => entry.skill,
    getAccuracy: (entry) => entry.accuracy,
    getCorrect: (entry) => entry.correct,
    getTotal: (entry) => entry.total,
  }).sort((a, b) => b.overallAccuracy - a.overallAccuracy);

  const difficultySummary = buildProgressSummary({
    entries: difficultyEntries,
    getTopicKey: (entry) => entry.difficulty,
    getAccuracy: (entry) => entry.accuracy,
    getCorrect: (entry) => entry.correct,
    getTotal: (entry) => entry.total,
  }).sort((a, b) => {
    const order = { easy: 1, medium: 2, hard: 3 };
    return (order[a.topic.toLowerCase()] || 0) - (order[b.topic.toLowerCase()] || 0);
  });

  return {
    questionTopicSummary,
    quizTopicSummary,
    skillSummary,
    difficultySummary,
    totalSubmittedAttempts,
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
  const { userId } = getCurrentSessionIdentity();

  const rawComments = Array.isArray(discussion.comments) ? discussion.comments : [];
  const nextComment = {
    id: `${questionId}-${Date.now()}`,
    userId,
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
