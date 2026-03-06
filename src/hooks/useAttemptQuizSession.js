import { useQuery } from '@tanstack/react-query';
import { getAttemptQuizSession } from '@/api/api.js';
import { queryKeys } from '@/hooks/queryKeys.js';
import { measureAsync } from '@/utils/performance.js';

export const useAttemptQuizSession = (attemptId) =>
  useQuery({
    queryKey: queryKeys.attemptQuizSession(attemptId),
    enabled: Boolean(attemptId),
    queryFn: () =>
      measureAsync(`query:attempt-session:${attemptId}`, () => getAttemptQuizSession(attemptId)),
  });
