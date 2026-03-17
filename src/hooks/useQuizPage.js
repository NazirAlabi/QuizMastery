import { useQuery } from '@tanstack/react-query';
import { getQuizPageById } from '@/api/api.js';
import { queryKeys } from '@/hooks/queryKeys.js';
import { measureAsync } from '@/utils/performance.js';
import { logFirestoreQueryError } from '@/utils/firestoreDiagnostics.js';

export const useQuizPage = (quizId) =>
  useQuery({
    queryKey: queryKeys.quizPage(quizId),
    enabled: Boolean(quizId),
    queryFn: async () => {
      try {
        return await measureAsync(`query:quiz-page:${quizId}`, () => getQuizPageById(quizId));
      } catch (error) {
        logFirestoreQueryError(`useQuizPage:${quizId}`, error);
        throw error;
      }
    },
  });
