import { useQuery } from '@tanstack/react-query';
import { getCoursePageById } from '@/api/api.js';
import { queryKeys } from '@/hooks/queryKeys.js';
import { measureAsync } from '@/utils/performance.js';

export const useCourse = (courseId) =>
  useQuery({
    queryKey: queryKeys.course(courseId),
    enabled: Boolean(courseId),
    queryFn: () =>
      measureAsync(`query:course:${courseId}`, () => getCoursePageById(courseId)),
  });
