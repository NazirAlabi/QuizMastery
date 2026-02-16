import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { auth, db } from '@/firebase/client.js';
import { quizRepository } from '@/repositories/quizRepository.js';
import { questionRepository } from '@/repositories/questionRepository.js';
import { attemptRepository } from '@/repositories/attemptRepository.js';
import { evaluateAnswer } from '@/utils/evaluateAnswer.js';

const STORAGE_KEYS = {
  DISCUSSIONS: 'quiz_discussions',
};

const SCORE_LEVELS = {
  EXCELLENT: 90,
  GREAT: 75,
  GOOD: 60,
};

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

const minutesFromTiming = (timing, fallbackQuestions = 0) => {
  if (timing?.enabled && timing?.durationSeconds) {
    return Math.max(1, Math.ceil(timing.durationSeconds / 60));
  }
  return Math.max(1, Math.ceil(fallbackQuestions * 1.5));
};

const mapQuestionForUi = (question) => {
  const metadata = question.metadata || {};
  return {
    ...question,
    options: Array.isArray(metadata.options) ? metadata.options : [],
    correctAnswer: metadata.correctOption ?? null,
    explanation: metadata.explanation || '',
    difficulty: metadata.difficulty || inferDifficulty(question.tags || []),
    topic: metadata.topic || question.courseCode || question.tags?.[0] || 'General',
    skillCategory: metadata.skillCategory || 'conceptual',
  };
};

const mapQuizForList = async (quiz) => {
  const links = await quizRepository.getQuizQuestionLinks(quiz.id);
  return {
    id: quiz.id,
    title: quiz.name,
    name: quiz.name,
    description: quiz.description || 'No description provided.',
    topic: quiz.courseCode || quiz.tags?.[0] || 'General',
    difficulty: inferDifficulty(quiz.tags || []),
    timing: quiz.timing || { enabled: false },
    questionCount: links.length,
    estimatedTime: minutesFromTiming(quiz.timing, links.length),
  };
};

const getFromStorage = (key) => {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
};

const saveToStorage = (key, data) => {
  localStorage.setItem(key, JSON.stringify(data));
};

const ensureUserProfile = async (firebaseUser) => {
  const userRef = doc(db, 'users', firebaseUser.uid);
  const existing = await getDoc(userRef);

  if (!existing.exists()) {
    await setDoc(userRef, {
      displayName:
        firebaseUser.displayName ||
        firebaseUser.email?.split('@')[0] ||
        'Quiz User',
      email: firebaseUser.email || '',
      createdAt: Timestamp.now(),
      profilePhotoUrl: firebaseUser.photoURL || null,
    });
  }

  return {
    id: firebaseUser.uid,
    uid: firebaseUser.uid,
    email: firebaseUser.email || '',
    displayName: firebaseUser.displayName || '',
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

export const register = async (email, password) => {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  const user = await ensureUserProfile(credential.user);
  const token = await credential.user.getIdToken();

  return {
    user,
    token,
  };
};

export const logout = async () => {
  await signOut(auth);
};

export const getQuizzes = async () => {
  const quizzes = await quizRepository.getQuizzes();
  return Promise.all(quizzes.map(mapQuizForList));
};

export const getQuizById = async (quizId) => {
  const quiz = await quizRepository.getQuizById(quizId);
  if (!quiz) {
    throw new Error('Quiz not found');
  }

  const questions = await quizRepository.getQuizQuestions(quizId);
  const mappedQuestions = questions.map(mapQuestionForUi);

  return {
    id: quiz.id,
    title: quiz.name,
    name: quiz.name,
    description: quiz.description || '',
    topic: quiz.courseCode || quiz.tags?.[0] || 'General',
    difficulty: inferDifficulty(quiz.tags || []),
    timing: quiz.timing || { enabled: false },
    questionCount: mappedQuestions.length,
    estimatedTime: minutesFromTiming(quiz.timing, mappedQuestions.length),
    questions: mappedQuestions,
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
  if (!quiz) {
    throw new Error('Quiz not found');
  }

  const timingSnapshot = {
    enabled: Boolean(quiz.timing?.enabled),
    durationSeconds: quiz.timing?.durationSeconds || null,
    perQuestion: Boolean(quiz.timing?.perQuestion),
  };

  return attemptRepository.createAttempt({
    userId,
    quizId,
    timingSnapshot,
  });
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
  const answerDocs = await attemptRepository.getAttemptAnswers(attemptId, currentUser.uid);
  const answerByQuestionId = new Map(
    answerDocs.map((answerDoc) => [answerDoc.questionId, String(answerDoc.answer ?? '')])
  );

  const correctAnswers = quiz.questions.reduce((total, question) => {
    const userAnswer = answerByQuestionId.get(question.id) || '';
    return total + (evaluateAnswer(question, userAnswer) ? 1 : 0);
  }, 0);

  const score =
    quiz.questions.length > 0
      ? Math.round((correctAnswers / quiz.questions.length) * 100)
      : 0;

  await attemptRepository.submitAttempt({ attemptId, score });

  return { attemptId };
};

const buildSkillBreakdown = (questions, answerByQuestionId) => {
  const buckets = {};

  questions.forEach((question) => {
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
  const answerDocs = await attemptRepository.getAttemptAnswers(attemptId, currentUser.uid);
  const answerByQuestionId = new Map(
    answerDocs.map((answerDoc) => [answerDoc.questionId, String(answerDoc.answer ?? '')])
  );

  const answers = quiz.questions.map((question) => {
    const selectedAnswer = answerByQuestionId.get(question.id) || '';
    const isCorrect = evaluateAnswer(question, selectedAnswer);

    return {
      questionId: question.id,
      selectedAnswer,
      isCorrect,
    };
  });

  const correctAnswers = answers.filter((answer) => answer.isCorrect).length;
  const totalQuestions = quiz.questions.length;
  const score =
    totalQuestions > 0
      ? Math.round((correctAnswers / totalQuestions) * 100)
      : Number(attempt.score || 0);

  const skillBreakdown = buildSkillBreakdown(quiz.questions, answerByQuestionId);
  const { topicBreakdown, weaknesses } = buildTopicBreakdown(quiz.questions, answerByQuestionId);

  return {
    attemptId: attempt.id,
    quizId: attempt.quizId,
    score,
    totalQuestions,
    correctAnswers,
    completedAt: toDate(attempt.submittedAt)?.toISOString() || null,
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
  const discussions = getFromStorage(STORAGE_KEYS.DISCUSSIONS) || {};
  return discussions[questionId] || [];
};

export const postComment = async (questionId, text, author) => {
  const discussions = getFromStorage(STORAGE_KEYS.DISCUSSIONS) || {};

  const comment = {
    id: `${questionId}-${Date.now()}`,
    text,
    author,
    status: 'new',
    upvotes: 0,
    createdAt: new Date().toISOString(),
  };

  const questionDiscussion = discussions[questionId] || [];
  questionDiscussion.push(comment);

  discussions[questionId] = questionDiscussion;
  saveToStorage(STORAGE_KEYS.DISCUSSIONS, discussions);

  return comment;
};

export const upvoteComment = async (questionId, commentId) => {
  const discussions = getFromStorage(STORAGE_KEYS.DISCUSSIONS) || {};
  const questionDiscussion = discussions[questionId] || [];

  const index = questionDiscussion.findIndex((comment) => comment.id === commentId);
  if (index < 0) {
    throw new Error('Comment not found');
  }

  questionDiscussion[index] = {
    ...questionDiscussion[index],
    upvotes: Number(questionDiscussion[index].upvotes || 0) + 1,
  };

  discussions[questionId] = questionDiscussion;
  saveToStorage(STORAGE_KEYS.DISCUSSIONS, discussions);

  return questionDiscussion[index];
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
