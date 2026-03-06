import { useQuery } from '@tanstack/react-query';
import { getResults } from '@/api/api.js';
import { queryKeys } from '@/hooks/queryKeys.js';
import { measureAsync } from '@/utils/performance.js';

export const useResults = (attemptId) =>
  useQuery({
    queryKey: queryKeys.results(attemptId),
    enabled: Boolean(attemptId),
    queryFn: () => measureAsync(`query:results:${attemptId}`, () => getResults(attemptId)),
  });
