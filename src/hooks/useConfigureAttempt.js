import { useMutation } from '@tanstack/react-query';
import { configureAttempt } from '@/api/api.js';

export const useConfigureAttempt = () =>
  useMutation({
    mutationFn: ({ attemptId, mode, speedMultiplier, allowBreaks }) =>
      configureAttempt(attemptId, {
        mode,
        speedMultiplier,
        allowBreaks,
      }),
  });
