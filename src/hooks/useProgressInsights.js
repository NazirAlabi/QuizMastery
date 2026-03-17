import { useQuery } from '@tanstack/react-query';
import { getProgressInsights } from '@/api/api.js';
import { queryKeys } from '@/hooks/queryKeys.js';
import { measureAsync } from '@/utils/performance.js';
import { logFirestoreQueryError } from '@/utils/firestoreDiagnostics.js';

export const useProgressInsights = () =>
  useQuery({
    queryKey: queryKeys.progressInsights,
    queryFn: async () => {
      try {
        return await measureAsync('query:progress-insights', () => getProgressInsights());
      } catch (error) {
        logFirestoreQueryError('useProgressInsights', error);
        throw error;
      }
    },
  });
