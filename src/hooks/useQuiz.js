import { useQuery } from '@tanstack/react-query';
import { getQuizById } from '@/api/api.js';
import { queryKeys } from '@/hooks/queryKeys.js';
import { measureAsync } from '@/utils/performance.js';

export const useQuiz = (quizId, options = {}) =>
  useQuery({
    queryKey: queryKeys.quiz(quizId),
    enabled: Boolean(quizId) && options.enabled !== false,
    queryFn: () => measureAsync(`query:quiz:${quizId}`, () => getQuizById(quizId)),
  });
