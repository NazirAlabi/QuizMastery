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

const coursesCollection = collection(db, 'courses');

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
  getActiveQuizCount(quizIds) {
    if (!Array.isArray(quizIds)) return 0;
    return quizIds.length;
  }

  mapCourse(courseDoc) {
    const course = {
      id: courseDoc.id,
      ...courseDoc.data(),
    };

    return {
      ...course,
      quizCount: this.getActiveQuizCount(Array.isArray(course.quizIds) ? course.quizIds : []),
    };
  }

  async getCourses(limitCount = null, lastDoc = null) {
    const normalizedLimit = Number(limitCount);
    const shouldPaginate = Number.isFinite(normalizedLimit) && normalizedLimit > 0;

    if (!shouldPaginate) {
      const snapshot = await getDocs(coursesCollection);
      return snapshot.docs.map((courseDoc) => this.mapCourse(courseDoc));
    }

    const constraints = [orderBy('createdAt', 'desc')];
    if (lastDoc) constraints.push(startAfter(lastDoc));
    constraints.push(limitTo(normalizedLimit));

    const paginatedQuery = query(coursesCollection, ...constraints);
    const snapshot = await getDocs(paginatedQuery);
    const courses = snapshot.docs.map((courseDoc) => this.mapCourse(courseDoc));
    const nextLastDoc = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;

    return {
      items: courses,
      lastDoc: nextLastDoc,
      hasMore: snapshot.docs.length === normalizedLimit,
    };
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
      quizCount: this.getActiveQuizCount(Array.isArray(course.quizIds) ? course.quizIds : []),
    };
  }

  async getCoursesByQuizId(quizId) {
    const q = query(coursesCollection, where('quizIds', 'array-contains', quizId));
    const snapshot = await getDocs(q);
    return snapshot.docs
      .map((courseDoc) => ({
        id: courseDoc.id,
        ...courseDoc.data(),
      }))
      .filter((course) => course.isArchived !== true)
      .map((course) => ({
        ...course,
        quizCount: this.getActiveQuizCount(Array.isArray(course.quizIds) ? course.quizIds : []),
      }));
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
      quizCount: this.getActiveQuizCount(Array.isArray(course.quizIds) ? course.quizIds : []),
    };
  }

  async createCourse(payload) {
    const course = normalizeCoursePayload(payload);
    validateCoursePayload(course);

    const quizCount = this.getActiveQuizCount(course.quizIds);
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

    const quizCount = this.getActiveQuizCount(course.quizIds);
    const courseRef = doc(db, 'courses', courseId);
    await updateDoc(courseRef, {
      ...course,
      quizCount,
      lastModified: serverTimestamp(),
    });

    return this.getCourseById(courseId);
  }

  async deleteCourse(courseId) {
    await deleteDoc(doc(db, 'courses', courseId));
    return { id: courseId, deleted: true };
  }
}

export const courseRepository = new CourseRepository();
