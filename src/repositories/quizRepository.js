import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit as limitTo,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '@/firebase/client.js';
import { questionRepository } from '@/repositories/questionRepository.js';

const quizzesCollection = collection(db, 'quizzes');
const DIFFICULTY_LEVELS = [1, 2, 3];

const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;
const isNumber = (value) => typeof value === 'number' && Number.isFinite(value);

const normalizeQuizPayload = (payload) => {
  const questionIds = Array.isArray(payload?.questionIds)
    ? payload.questionIds.map((id) => String(id).trim()).filter(Boolean)
    : [];

  return {
    title: String(payload?.title || '').trim(),
    description: String(payload?.description || '').trim(),
    topic: String(payload?.topic || '').trim(),
    difficulty: Number(payload?.difficulty),
    estimatedTime: Number(payload?.estimatedTime),
    isTimePerQuestion: Boolean(payload?.isTimePerQuestion),
    questionIds,
    isArchived: Boolean(payload?.isArchived),
  };
};

const validateQuizPayload = (quiz) => {
  if (!isNonEmptyString(quiz.title)) {
    throw new Error('title is required');
  }
  if (!isNonEmptyString(quiz.description)) {
    throw new Error('description is required');
  }
  if (!isNonEmptyString(quiz.topic)) {
    throw new Error('topic is required');
  }
  if (!DIFFICULTY_LEVELS.includes(quiz.difficulty)) {
    throw new Error('difficulty must be 1, 2, or 3');
  }
  if (!isNumber(quiz.estimatedTime) || quiz.estimatedTime <= 0) {
    throw new Error('estimatedTime must be a positive number of minutes');
  }
  if (!Array.isArray(quiz.questionIds)) {
    throw new Error('questionIds must be an array');
  }
};

class QuizRepository {
  mapQuiz(quizDoc) {
    return {
      id: quizDoc.id,
      ...quizDoc.data(),
    };
  }

  async getQuizzes(limitCount = null, lastDoc = null) {
    const normalizedLimit = Number(limitCount);
    const shouldPaginate = Number.isFinite(normalizedLimit) && normalizedLimit > 0;

    if (!shouldPaginate) {
      const snapshot = await getDocs(quizzesCollection);
      return snapshot.docs.map((quizDoc) => this.mapQuiz(quizDoc));
    }

    const constraints = [orderBy('createdAt', 'desc')];
    if (lastDoc) constraints.push(startAfter(lastDoc));
    constraints.push(limitTo(normalizedLimit));

    const paginatedQuery = query(quizzesCollection, ...constraints);
    const snapshot = await getDocs(paginatedQuery);
    const quizzes = snapshot.docs.map((quizDoc) => this.mapQuiz(quizDoc));
    const nextLastDoc = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;

    return {
      items: quizzes,
      lastDoc: nextLastDoc,
      hasMore: snapshot.docs.length === normalizedLimit,
    };
  }

  async getQuizById(quizId) {
    const snapshot = await getDoc(doc(db, 'quizzes', quizId));
    if (!snapshot.exists()) return null;
    return { id: snapshot.id, ...snapshot.data() };
  }

  async getQuizzesByIds(quizIds) {
    if (!Array.isArray(quizIds) || quizIds.length === 0) return [];

    const chunks = [];
    for (let index = 0; index < quizIds.length; index += 30) {
      chunks.push(quizIds.slice(index, index + 30));
    }

    const quizzes = [];
    for (const chunk of chunks) {
      const quizQuery = query(quizzesCollection, where('__name__', 'in', chunk));
      const snapshot = await getDocs(quizQuery);
      snapshot.forEach((quizDoc) => {
        quizzes.push({
          id: quizDoc.id,
          ...quizDoc.data(),
        });
      });
    }

    return quizzes;
  }

  async getActiveQuestionCount(questionIds) {
    if (!questionIds.length) return 0;
    const questions = await questionRepository.getQuestionsByIds(questionIds);
    return questions.filter((question) => question?.isArchived !== true).length;
  }

  async getQuizQuestions(quizId) {
    const quiz = await this.getQuizById(quizId);
    const questionIds = Array.isArray(quiz?.questionIds) ? quiz.questionIds : [];
    if (!questionIds.length) return [];

    const questions = await questionRepository.getQuestionsByIds(questionIds);
    const questionById = new Map(questions.map((question) => [question.id, question]));

    return questionIds
      .map((questionId, index) => {
        const question = questionById.get(questionId);
        if (!question || question.isArchived === true) return null;
        return {
          ...question,
          orderIndex: index,
        };
      })
      .filter(Boolean);
  }

  async createQuiz(payload) {
    const quiz = normalizeQuizPayload(payload);
    validateQuizPayload(quiz);

    const questionCount = await this.getActiveQuestionCount(quiz.questionIds);
    const docRef = await addDoc(quizzesCollection, {
      ...quiz,
      questionCount,
      createdAt: serverTimestamp(),
      lastModified: serverTimestamp(),
    });

    return this.getQuizById(docRef.id);
  }

  async updateQuiz(quizId, payload) {
    const quiz = normalizeQuizPayload(payload);
    validateQuizPayload(quiz);

    const questionCount = await this.getActiveQuestionCount(quiz.questionIds);
    const quizRef = doc(db, 'quizzes', quizId);
    await updateDoc(quizRef, {
      ...quiz,
      questionCount,
      lastModified: serverTimestamp(),
    });

    return this.getQuizById(quizId);
  }

  async deleteQuiz(quizId) {
    await deleteDoc(doc(db, 'quizzes', quizId));
    return { id: quizId, deleted: true };
  }
}

export const quizRepository = new QuizRepository();
