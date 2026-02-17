import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  Timestamp,
  updateDoc,
  setDoc,
} from 'firebase/firestore';
import { db } from '@/firebase/client.js';

const attemptsCollection = collection(db, 'userAttempts');

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
    const answerRef = doc(db, 'userAttempts', attemptId, 'answers', questionId);
    await setDoc(
      answerRef,
      {
        questionId,
        userId,
        answer: String(answer ?? ''),
        answeredAt: Timestamp.now(),
      },
      { merge: true }
    );

    return {
      id: questionId,
      questionId,
      userId,
      answer: String(answer ?? ''),
    };
  }

  async getAttemptAnswers(attemptId, userId) {
    const answersCollection = collection(db, 'userAttempts', attemptId, 'answers');
    const snapshot = await getDocs(answersCollection);
    return snapshot.docs
      .map((answerDoc) => ({ id: answerDoc.id, ...answerDoc.data() }))
      .filter((answerDoc) => answerDoc.userId === userId);
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
