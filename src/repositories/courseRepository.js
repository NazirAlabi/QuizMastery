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

const coursesCollection = collection(db, 'courses');
const quizzesCollection = collection(db, 'quizzes');

const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;

const normalizeCoursePayload = (payload) => {
  const quizIds = Array.isArray(payload?.quizIds)
    ? payload.quizIds.map((id) => String(id).trim()).filter(Boolean)
    : [];

  const normalized = {
    title: String(payload?.title || '').trim(),
    description: String(payload?.description || '').trim(),
    topic: String(payload?.topic || '').trim(),
    quizIds,
    isArchived: Boolean(payload?.isArchived),
  };

  if (isNonEmptyString(payload?.courseCode)) {
    normalized.courseCode = String(payload.courseCode).trim();
  }

  return normalized;
};

const validateCoursePayload = (course) => {
  if (!isNonEmptyString(course.title)) {
    throw new Error('title is required');
  }
  if (!isNonEmptyString(course.description)) {
    throw new Error('description is required');
  }
  if (!isNonEmptyString(course.topic)) {
    throw new Error('topic is required');
  }
  if (!Array.isArray(course.quizIds)) {
    throw new Error('quizIds must be an array');
  }
};

class CourseRepository {
  async getActiveQuizCount(quizIds) {
    if (!Array.isArray(quizIds) || !quizIds.length) return 0;

    const chunks = [];
    for (let i = 0; i < quizIds.length; i += 30) {
      chunks.push(quizIds.slice(i, i + 30));
    }

    let count = 0;
    for (const chunk of chunks) {
      const q = query(quizzesCollection, where('__name__', 'in', chunk));
      const snapshot = await getDocs(q);
      snapshot.forEach((quizDoc) => {
        const quizData = quizDoc.data();
        if (quizData?.isArchived !== true) {
          count += 1;
        }
      });
    }

    return count;
  }

  async getCourses() {
    const snapshot = await getDocs(coursesCollection);
    const courses = snapshot.docs.map((courseDoc) => ({
      id: courseDoc.id,
      ...courseDoc.data(),
    }));

    return Promise.all(
      courses.map(async (course) => ({
        ...course,
        quizCount: await this.getActiveQuizCount(Array.isArray(course.quizIds) ? course.quizIds : []),
      }))
    );
  }

  async getCourseByQuizId(quizId) {
    const q = query(coursesCollection, where('quizIds', 'array-contains', quizId));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    const courseDoc = snapshot.docs[0];
    const course = {
      id: courseDoc.id,
      ...courseDoc.data(),
    };

    if (course.isArchived === true) return null;

    return {
      ...course,
      quizCount: await this.getActiveQuizCount(Array.isArray(course.quizIds) ? course.quizIds : []),
    };
  }

  async getCourseById(courseId) {
    const snapshot = await getDoc(doc(db, 'courses', courseId));
    if (!snapshot.exists()) return null;
    const course = {
      id: snapshot.id,
      ...snapshot.data(),
    };

    return {
      ...course,
      quizCount: await this.getActiveQuizCount(Array.isArray(course.quizIds) ? course.quizIds : []),
    };
  }

  async createCourse(payload) {
    const course = normalizeCoursePayload(payload);
    validateCoursePayload(course);

    const quizCount = await this.getActiveQuizCount(course.quizIds);
    const docRef = await addDoc(coursesCollection, {
      ...course,
      quizCount,
      createdAt: serverTimestamp(),
      lastModified: serverTimestamp(),
    });

    return this.getCourseById(docRef.id);
  }

  async updateCourse(courseId, payload) {
    const course = normalizeCoursePayload(payload);
    validateCoursePayload(course);

    const quizCount = await this.getActiveQuizCount(course.quizIds);
    const courseRef = doc(db, 'courses', courseId);
    await updateDoc(courseRef, {
      ...course,
      quizCount,
      lastModified: serverTimestamp(),
    });

    return this.getCourseById(courseId);
  }
}

export const courseRepository = new CourseRepository();
