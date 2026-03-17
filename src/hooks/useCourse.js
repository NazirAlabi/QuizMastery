import { useQuery } from '@tanstack/react-query';
import { getCoursePageById } from '@/api/api.js';
import { queryKeys } from '@/hooks/queryKeys.js';
import { measureAsync } from '@/utils/performance.js';
import { logFirestoreQueryError } from '@/utils/firestoreDiagnostics.js';

export const useCourse = (courseId) =>
  useQuery({
    queryKey: queryKeys.course(courseId),
    enabled: Boolean(courseId),
    queryFn: async () => {
      try {
        return await measureAsync(`query:course:${courseId}`, () => getCoursePageById(courseId));
      } catch (error) {
        logFirestoreQueryError(`useCourse:${courseId}`, error);
        throw error;
      }
    },
  });
