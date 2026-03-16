import { useMutation, useQueryClient  } from '@tanstack/react-query';
import { queryKeys } from '@/hooks/queryKeys.js';
import { startAttempt } from '@/api/api.js';

export const useStartAttempt = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ quizId, userId }) => startAttempt(quizId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.userAttempts });
      queryClient.invalidateQueries({ queryKey: queryKeys.progressInsights });
    },
  });
};