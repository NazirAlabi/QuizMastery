import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '@/firebase/client.js';

const questionsCollection = collection(db, 'questions');
const QUESTION_TYPES = ['mcq', 'short_answer', 'numeric', 'long_answer'];
const DIFFICULTY_LEVELS = [1, 2, 3];
const SKILL_CATEGORY_LEVELS = [1, 2, 3];

const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;
const isNumber = (value) => typeof value === 'number' && Number.isFinite(value);

const normalizeQuestionPayload = (payload) => {
  const type = String(payload?.type || '').trim().toLowerCase();
  const metadata = payload?.metadata && typeof payload.metadata === 'object' ? payload.metadata : {};

  const normalized = {
    type,
    question_text: String(payload?.question_text || '').trim(),
    metadata: {},
    difficulty: Number(payload?.difficulty),
    topic: String(payload?.topic || '').trim(),
    skillCategory: Number(payload?.skillCategory),
    explanation: isNonEmptyString(payload?.explanation) ? payload.explanation.trim() : '',
    isArchived: Boolean(payload?.isArchived),
  };

  if (type === 'mcq') {
    normalized.metadata.options = Array.isArray(metadata.options) ? metadata.options : [];
    normalized.metadata.correct_answer = String(metadata.correct_answer || '').trim();
  }

  if (type === 'short_answer') {
    normalized.metadata.accepted_answers = Array.isArray(metadata.accepted_answers)
      ? metadata.accepted_answers.map((answer) => String(answer))
      : [];
    normalized.metadata.case_sensitive = Boolean(metadata.case_sensitive);
    normalized.metadata.ignore_whitespace = metadata.ignore_whitespace !== false;
  }

  if (type === 'numeric') {
    normalized.metadata.numeric_answer = Number(metadata.numeric_answer);
    if (metadata.tolerance !== undefined && metadata.tolerance !== null && metadata.tolerance !== '') {
      normalized.metadata.tolerance = Number(metadata.tolerance);
    }
  }

  return normalized;
};

const validateQuestionPayload = (question) => {
  if (!QUESTION_TYPES.includes(question.type)) {
    throw new Error('Question type must be one of: mcq, short_answer, numeric, long_answer');
  }

  if (!isNonEmptyString(question.question_text)) {
    throw new Error('question_text is required');
  }

  if (!DIFFICULTY_LEVELS.includes(question.difficulty)) {
    throw new Error('difficulty must be 1, 2, or 3');
  }

  if (!SKILL_CATEGORY_LEVELS.includes(question.skillCategory)) {
    throw new Error('skillCategory must be 1, 2, or 3');
  }

  if (!isNonEmptyString(question.topic)) {
    throw new Error('topic is required');
  }

  if (question.type === 'mcq') {
    if (!Array.isArray(question.metadata.options) || question.metadata.options.length < 2) {
      throw new Error('metadata.options must include at least two options for mcq questions');
    }

    const hasValidOptions = question.metadata.options.every(
      (option) => option && isNonEmptyString(option.id) && isNonEmptyString(option.text)
    );
    if (!hasValidOptions) {
      throw new Error('Each mcq option must include non-empty id and text');
    }

    const optionIds = question.metadata.options.map((option) => String(option.id));
    if (!optionIds.includes(question.metadata.correct_answer)) {
      throw new Error('metadata.correct_answer must match one of the option ids');
    }
  }

  if (question.type === 'short_answer') {
    if (
      !Array.isArray(question.metadata.accepted_answers) ||
      question.metadata.accepted_answers.length === 0 ||
      !question.metadata.accepted_answers.every((answer) => typeof answer === 'string')
    ) {
      throw new Error('metadata.accepted_answers must be a non-empty string array for short_answer questions');
    }
  }

  if (question.type === 'numeric') {
    if (!isNumber(question.metadata.numeric_answer)) {
      throw new Error('metadata.numeric_answer must be a number for numeric questions');
    }

    if (
      question.metadata.tolerance !== undefined &&
      (!isNumber(question.metadata.tolerance) || question.metadata.tolerance < 0)
    ) {
      throw new Error('metadata.tolerance must be a non-negative number when provided');
    }
  }
};

class QuestionRepository {
  async getQuestionById(questionId) {
    const snapshot = await getDoc(doc(db, 'questions', questionId));
    if (!snapshot.exists()) return null;
    return { id: snapshot.id, ...snapshot.data() };
  }

  async getQuestionsByIds(questionIds) {
    if (!questionIds?.length) return [];

    // Firestore where-in supports up to 30 IDs per query
    const chunks = [];
    for (let i = 0; i < questionIds.length; i += 30) {
      chunks.push(questionIds.slice(i, i + 30));
    }

    const results = [];
    for (const chunk of chunks) {
      const q = query(questionsCollection, where('__name__', 'in', chunk));
      const snapshot = await getDocs(q);
      snapshot.forEach((questionDoc) => {
        results.push({ id: questionDoc.id, ...questionDoc.data() });
      });
    }

    return results;
  }

  async getQuestionsByBankId(bankId) {
    const q = query(questionsCollection, where('bankId', '==', bankId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((questionDoc) => ({
      id: questionDoc.id,
      ...questionDoc.data(),
    }));
  }

  async createQuestion(payload) {
    const question = normalizeQuestionPayload(payload);
    validateQuestionPayload(question);

    const docRef = await addDoc(questionsCollection, {
      ...question,
      createdAt: serverTimestamp(),
      lastModified: serverTimestamp(),
    });

    return this.getQuestionById(docRef.id);
  }

  async updateQuestion(questionId, payload) {
    const question = normalizeQuestionPayload(payload);
    validateQuestionPayload(question);

    const questionRef = doc(db, 'questions', questionId);
    await updateDoc(questionRef, {
      ...question,
      lastModified: serverTimestamp(),
    });

    return this.getQuestionById(questionId);
  }
}

export const questionRepository = new QuestionRepository();
