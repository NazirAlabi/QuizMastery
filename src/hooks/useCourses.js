import { useQuery } from '@tanstack/react-query';
import { getCoursesWithQuizzes } from '@/api/api.js';
import { queryKeys } from '@/hooks/queryKeys.js';
import { measureAsync } from '@/utils/performance.js';

const compareCourses = (courseA, courseB) => {
  const quizCountA = Array.isArray(courseA?.quizzes)
    ? courseA.quizzes.length
    : Number(courseA?.quizCount || 0);
  const quizCountB = Array.isArray(courseB?.quizzes)
    ? courseB.quizzes.length
    : Number(courseB?.quizCount || 0);

  if (quizCountA !== quizCountB) return quizCountB - quizCountA;

  return String(courseA?.title || '').localeCompare(String(courseB?.title || ''), undefined, {
    sensitivity: 'base',
  });
};

export const useCourses = () =>
  useQuery({
    queryKey: queryKeys.courses,
    queryFn: () => measureAsync('query:courses', getCoursesWithQuizzes),
    select: (courses) => [...courses].sort(compareCourses),
  });
