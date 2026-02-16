import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '@/firebase/client.js';

const attemptsCollection = collection(db, 'userAttempts');
const attemptAnswersCollection = collection(db, 'attemptAnswers');

class AttemptRepository {
  async createAttempt({ userId, quizId, timingSnapshot }) {
    const snapshot = await addDoc(attemptsCollection, {
      userId,
      quizId,
      startedAt: Timestamp.now(),
      status: 'in_progress',
      timingSnapshot,
    });

    return {
      id: snapshot.id,
      userId,
      quizId,
      status: 'in_progress',
      timingSnapshot,
    };
  }

  async getAttemptById(attemptId) {
    const snapshot = await getDoc(doc(db, 'userAttempts', attemptId));
    if (!snapshot.exists()) return null;
    return { id: snapshot.id, ...snapshot.data() };
  }

  async upsertAttemptAnswer({ attemptId, questionId, userId, answer }) {
    const existingAnswerQuery = query(
      attemptAnswersCollection,
      where('attemptId', '==', attemptId),
      where('questionId', '==', questionId),
      where('userId', '==', userId),
      limit(1)
    );

    const existingSnapshot = await getDocs(existingAnswerQuery);
    if (existingSnapshot.empty) {
      const created = await addDoc(attemptAnswersCollection, {
        attemptId,
        questionId,
        userId,
        answer: String(answer ?? ''),
        answeredAt: Timestamp.now(),
      });

      return {
        id: created.id,
        attemptId,
        questionId,
        userId,
        answer: String(answer ?? ''),
      };
    }

    const existingDoc = existingSnapshot.docs[0];
    await updateDoc(existingDoc.ref, {
      answer: String(answer ?? ''),
      answeredAt: Timestamp.now(),
    });

    return {
      id: existingDoc.id,
      ...existingDoc.data(),
      answer: String(answer ?? ''),
    };
  }

  async getAttemptAnswers(attemptId, userId) {
    const q = query(
      attemptAnswersCollection,
      where('attemptId', '==', attemptId),
      where('userId', '==', userId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((answerDoc) => ({
      id: answerDoc.id,
      ...answerDoc.data(),
    }));
  }

  async submitAttempt({ attemptId, score }) {
    const attemptRef = doc(db, 'userAttempts', attemptId);
    await updateDoc(attemptRef, {
      score,
      status: 'submitted',
      submittedAt: Timestamp.now(),
    });
  }
}

export const attemptRepository = new AttemptRepository();
