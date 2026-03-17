import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getUserAttempts, deleteAttempt, cleanupStaleAttempts } from '@/api/api.js';
import { queryKeys } from '@/hooks/queryKeys.js';
import { measureAsync } from '@/utils/performance.js';
import { logFirestoreQueryError } from '@/utils/firestoreDiagnostics.js';

export const useUserAttempts = () => {
  return useQuery({
    queryKey: queryKeys.userAttempts,
    queryFn: async () => {
      // First, delete stale in-progress attempts to prevent edge-case states.
      try {
        await measureAsync('query:cleanup-stale-attempts', () => cleanupStaleAttempts());
      } catch (error) {
        // Continue even if cleanup fails so the main attempts list can still load.
        logFirestoreQueryError('useUserAttempts:cleanupStaleAttempts', error);
      }

      try {
        return await measureAsync('query:user-attempts', () => getUserAttempts());
      } catch (error) {
        logFirestoreQueryError('useUserAttempts:getUserAttempts', error);
        throw error;
      }
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
