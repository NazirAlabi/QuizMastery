import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { db } from '@/firebase/client.js';

const questionsCollection = collection(db, 'questions');

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
}

export const questionRepository = new QuestionRepository();
