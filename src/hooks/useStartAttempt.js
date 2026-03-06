import { useMutation } from '@tanstack/react-query';
import { startAttempt } from '@/api/api.js';

export const useStartAttempt = () =>
  useMutation({
    mutationFn: ({ quizId, userId }) => startAttempt(quizId, userId),
  });
