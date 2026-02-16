import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { db } from '@/firebase/client.js';
import { questionRepository } from '@/repositories/questionRepository.js';

const quizzesCollection = collection(db, 'quizzes');
const quizQuestionsCollection = collection(db, 'quizQuestions');

class QuizRepository {
  async getQuizzes() {
    const snapshot = await getDocs(quizzesCollection);
    return snapshot.docs.map((quizDoc) => ({
      id: quizDoc.id,
      ...quizDoc.data(),
    }));
  }

  async getQuizById(quizId) {
    const snapshot = await getDoc(doc(db, 'quizzes', quizId));
    if (!snapshot.exists()) return null;
    return { id: snapshot.id, ...snapshot.data() };
  }

  async getQuizQuestionLinks(quizId) {
    const q = query(
      quizQuestionsCollection,
      where('quizId', '==', quizId),
      orderBy('orderIndex', 'asc')
    );
    const snapshot = await getDocs(q);

    return snapshot.docs.map((linkDoc) => ({
      id: linkDoc.id,
      ...linkDoc.data(),
    }));
  }

  async getQuizQuestions(quizId) {
    const links = await this.getQuizQuestionLinks(quizId);
    if (!links.length) return [];

    const questionIds = links.map((link) => link.questionId);
    const questions = await questionRepository.getQuestionsByIds(questionIds);
    const questionById = new Map(questions.map((question) => [question.id, question]));

    return links
      .map((link) => {
        const question = questionById.get(link.questionId);
        if (!question) return null;
        return {
          ...question,
          orderIndex: link.orderIndex,
        };
      })
      .filter(Boolean);
  }
}

export const quizRepository = new QuizRepository();
