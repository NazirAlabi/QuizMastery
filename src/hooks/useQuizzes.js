import { useQuery } from '@tanstack/react-query';
import { getQuizzes } from '@/api/api.js';
import { queryKeys } from '@/hooks/queryKeys.js';
import { measureAsync } from '@/utils/performance.js';

export const useQuizzes = () =>
  useQuery({
    queryKey: queryKeys.quizzes,
    queryFn: () => measureAsync('query:quizzes', getQuizzes),
  });
