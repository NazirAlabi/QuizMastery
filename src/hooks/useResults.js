import { useQuery } from '@tanstack/react-query';
import { getResults } from '@/api/api.js';
import { queryKeys } from '@/hooks/queryKeys.js';
import { measureAsync } from '@/utils/performance.js';
import { logFirestoreQueryError } from '@/utils/firestoreDiagnostics.js';

export const useResults = (attemptId) =>
  useQuery({
    queryKey: queryKeys.results(attemptId),
    enabled: Boolean(attemptId),
    queryFn: async () => {
      try {
        return await measureAsync(`query:results:${attemptId}`, () => getResults(attemptId));
      } catch (error) {
        logFirestoreQueryError(`useResults:${attemptId}`, error);
        throw error;
      }
    },
  });
