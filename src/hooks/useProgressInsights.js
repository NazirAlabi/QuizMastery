import { useQuery } from '@tanstack/react-query';
import { getProgressInsights } from '@/api/api.js';
import { queryKeys } from '@/hooks/queryKeys.js';
import { measureAsync } from '@/utils/performance.js';

export const useProgressInsights = () =>
  useQuery({
    queryKey: queryKeys.progressInsights,
    queryFn: () => measureAsync('query:progress-insights', () => getProgressInsights()),
  });
