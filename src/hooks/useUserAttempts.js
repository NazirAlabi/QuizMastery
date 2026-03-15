import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getUserAttempts, deleteAttempt, cleanupStaleAttempts } from '@/api/api.js';
import { queryKeys } from '@/hooks/queryKeys.js';
import { measureAsync } from '@/utils/performance.js';

export const useUserAttempts = () => {
  return useQuery({
    queryKey: queryKeys.userAttempts,
    queryFn: async () => {
      // First, delete any in‑progress attempts to prevent bugs
      try {
        await measureAsync('query:cleanup-stale-attempts', () => cleanupStaleAttempts());
      } catch (error) {
        // Log the error but continue – the user can still see their other attempts
        console.error('Failed to clean up stale attempts:', error);
      }

      // Then fetch the remaining attempts (abandoned or completed)
      return measureAsync('query:user-attempts', () => getUserAttempts());
    },
  });
};

export const useDeleteAttempt = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (attemptId) => deleteAttempt(attemptId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.userAttempts });
      queryClient.invalidateQueries({ queryKey: queryKeys.progressInsights });
    },
  });
};

export const useCleanupStaleAttempts = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => cleanupStaleAttempts(),
    onSuccess: (data) => {
      if (data.deletedCount > 0) {
        queryClient.invalidateQueries({ queryKey: queryKeys.userAttempts });
        queryClient.invalidateQueries({ queryKey: queryKeys.progressInsights });
      }
    },
  });
};

