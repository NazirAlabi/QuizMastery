import { useQuery } from '@tanstack/react-query';
import { getQuizzes } from '@/api/api.js';
import { queryKeys } from '@/hooks/queryKeys.js';
import { measureAsync } from '@/utils/performance.js';
import {
  isUnexpectedFirestoreResponse,
  logFirestoreQueryError,
  logUnexpectedFirestoreResponse,
} from '@/utils/firestoreDiagnostics.js';

export const useQuizzes = () =>
  useQuery({
    queryKey: queryKeys.quizzes,
    queryFn: async () => {
      try {
        const data = await measureAsync('query:quizzes', getQuizzes);
        if (isUnexpectedFirestoreResponse(data, 'array')) {
          logUnexpectedFirestoreResponse('useQuizzes', 'array', data);
          return [];
        }
        return data;
      } catch (error) {
        logFirestoreQueryError('useQuizzes', error);
        throw error;
      }
    },
});
