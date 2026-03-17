import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import QuestionCard from '@/components/quiz/QuestionCard.jsx';
import { Button } from '@/components/ui/button.jsx';
import { submitAnswer, submitQuiz, terminateAttempt } from '@/api/api.js';
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  Flag,
  PauseCircle,
  PlayCircle,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast.jsx';
import { cn } from '@/lib/utils.js';

const hasAnswerValue = (value) => String(value ?? '').trim().length > 0;

const formatSeconds = (totalSeconds) => {
  const normalized = Math.max(0, Number(totalSeconds) || 0);
  const minutes = Math.floor(normalized / 60);
  const seconds = normalized % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const QuizRunner = ({ quiz, attemptId }) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [markedForReview, setMarkedForReview] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFinalizingSubmission, setIsFinalizingSubmission] = useState(false);
  const [isQuitting, setIsQuitting] = useState(false);
  const [isOnBreak, setIsOnBreak] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(
    quiz.timing?.enabled && Number.isFinite(Number(quiz.timing?.durationSeconds))
      ? Number(quiz.timing.durationSeconds)
      : null
  );
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const navigate = useNavigate();
  const { toast } = useToast();
  const hasSubmittedRef = useRef(false);
  const textAnswerSaveTimersRef = useRef({});
  const savedAnswersRef = useRef({});

  const totalQuestions = Array.isArray(quiz.questions) ? quiz.questions.length : 0;
  const currentQuestion = quiz.questions?.[currentQuestionIndex] || null;
  const isLastQuestion = currentQuestionIndex === totalQuestions - 1;
  const isFirstQuestion = currentQuestionIndex === 0;
  const isTimedQuiz = Boolean(quiz.timing?.enabled && Number.isFinite(Number(quiz.timing?.durationSeconds)));
  const allowBreaks = Boolean(quiz?.attemptConfig?.allowBreaks);
  const isInteractionLocked = isSubmitting || isQuitting || isOnBreak;
  const answeredCount = useMemo(
    () =>
      quiz.questions.reduce(
        (count, question) => count + (hasAnswerValue(answers[question.id]) ? 1 : 0),
        0
      ),
    [answers, quiz.questions]
  );
  const markedCount = useMemo(
    () => Object.values(markedForReview).filter(Boolean).length,
    [markedForReview]
  );
  const timerLabel = useMemo(() => {
    if (isTimedQuiz) {
      return `Time Left: ${formatSeconds(remainingSeconds)}`;
    }
    return `Elapsed: ${formatSeconds(elapsedSeconds)}`;
  }, [elapsedSeconds, isTimedQuiz, remainingSeconds]);

  useEffect(() => {
    return () => {
      Object.values(textAnswerSaveTimersRef.current).forEach((timerId) => {
        window.clearTimeout(timerId);
      });
      textAnswerSaveTimersRef.current = {};
    };
  }, []);

  useEffect(() => {
    if (hasSubmittedRef.current || isInteractionLocked || isFinalizingSubmission) return;

    const timer = window.setInterval(() => {
      if (isTimedQuiz) {
        setRemainingSeconds((previous) => {
          if (previous == null) return previous;
          if (previous <= 1) return 0;
          return previous - 1;
        });
        return;
      }

      setElapsedSeconds((previous) => previous + 1);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isFinalizingSubmission, isInteractionLocked, isTimedQuiz]);

  const persistAnswer = async (questionId, answerValue) => {
    await submitAnswer(attemptId, questionId, answerValue);
    savedAnswersRef.current[questionId] = String(answerValue ?? '');
  };

  const handleAnswerChange = async (question, answerValue) => {
    if (isInteractionLocked) return;
    if (!question) return;
    const questionId = question.id;
    const type = String(question.type || '').toLowerCase();
    const normalizedValue = String(answerValue ?? '');
    const shouldKeep = hasAnswerValue(normalizedValue);

    setAnswers((previous) => {
      if (!shouldKeep) {
        const next = { ...previous };
        delete next[questionId];
        return next;
      }

      return {
        ...previous,
        [questionId]: normalizedValue,
      };
    });

    const existingTimer = textAnswerSaveTimersRef.current[questionId];
    if (existingTimer) {
      window.clearTimeout(existingTimer);
      delete textAnswerSaveTimersRef.current[questionId];
    }

    if (type === 'mcq' || !shouldKeep) {
      try {
        await persistAnswer(questionId, normalizedValue);
      } catch {
        toast({
          title: 'Error',
          description: 'Failed to save answer. Please try again.',
          variant: 'destructive',
        });
      }
      return;
    }

    textAnswerSaveTimersRef.current[questionId] = window.setTimeout(() => {
      persistAnswer(questionId, normalizedValue).catch(() => {
        toast({
          title: 'Error',
          description: 'Failed to save answer. Please try again.',
          variant: 'destructive',
        });
      });
      delete textAnswerSaveTimersRef.current[questionId];
    }, 500);
  };

  const flushPendingAnswerWrites = async () => {
    Object.entries(textAnswerSaveTimersRef.current).forEach(([, timerId]) => {
      window.clearTimeout(timerId);
    });
    textAnswerSaveTimersRef.current = {};

    const pendingWrites = quiz.questions
      .map((question) => {
        const nextValue = String(answers[question.id] ?? '');
        const savedValue = String(savedAnswersRef.current[question.id] ?? '');
        return savedValue === nextValue ? null : [question.id, nextValue];
      })
      .filter(Boolean);

    if (pendingWrites.length > 0) {
      await Promise.all(
        pendingWrites.map(([questionId, value]) => submitAnswer(attemptId, questionId, value))
      );
      pendingWrites.forEach(([questionId, value]) => {
        savedAnswersRef.current[questionId] = String(value ?? '');
      });
    }
  };

  const handleSubmitQuiz = async ({ bypassUnansweredPrompt = false, isAutoSubmit = false } = {}) => {
    if (hasSubmittedRef.current) return;

    const unansweredCount = totalQuestions - answeredCount;
    if (!bypassUnansweredPrompt && unansweredCount > 0) {
      const confirmed = window.confirm(
        `You have ${unansweredCount} unanswered question${unansweredCount > 1 ? 's' : ''}. Submit anyway?`
      );
      if (!confirmed) return;
    }

    hasSubmittedRef.current = true;
    setIsSubmitting(true);
    setIsFinalizingSubmission(true);
    try {
      await flushPendingAnswerWrites();
      const result = await submitQuiz(attemptId);
      toast({
        title: isAutoSubmit ? 'Time is up!' : 'Quiz Submitted!',
      });
      navigate(`/results/${result.attemptId}`);
    } catch {
      hasSubmittedRef.current = false;
      setIsSubmitting(false);
      setIsFinalizingSubmission(false);
      toast({
        title: 'Error',
        description: 'Failed to submit quiz. Please try again.',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    if (!isTimedQuiz || remainingSeconds == null || hasSubmittedRef.current) return;
    if (remainingSeconds > 0) return;
    handleSubmitQuiz({ bypassUnansweredPrompt: true, isAutoSubmit: true });
  }, [isTimedQuiz, remainingSeconds]);

  const handleQuitQuiz = async () => {
    if (isInteractionLocked || hasSubmittedRef.current) return;

    const confirmed = window.confirm('Quit this quiz and terminate the current attempt?');
    if (!confirmed) return;

    hasSubmittedRef.current = true;
    setIsQuitting(true);
    try {
      await terminateAttempt(attemptId);
      toast({
        title: 'Attempt terminated',
        description: 'You can start again from the courses page.',
      });
      navigate('/courses');
    } catch {
      hasSubmittedRef.current = false;
      setIsQuitting(false);
      toast({
        title: 'Error',
        description: 'Failed to terminate attempt. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const navigateToQuestion = (index) => {
    if (isInteractionLocked || isFinalizingSubmission) return;
    if (index < 0 || index >= totalQuestions) return;
    setCurrentQuestionIndex(index);
    window.scrollTo(0, 0);
  };

  const handleNext = () => {
    if (currentQuestionIndex < totalQuestions - 1) {
      navigateToQuestion(currentQuestionIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      navigateToQuestion(currentQuestionIndex - 1);
    }
  };

  const toggleMarkForReview = () => {
    if (isInteractionLocked || !currentQuestion) return;
    setMarkedForReview((previous) => ({
      ...previous,
      [currentQuestion.id]: !previous[currentQuestion.id],
    }));
  };

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== 'Enter') return;
      if (event.defaultPrevented) return;
      if (event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return;
      if (isInteractionLocked || isFinalizingSubmission || !currentQuestion) return;

      event.preventDefault();
      if (isLastQuestion) {
        handleSubmitQuiz();
        return;
      }
      handleNext();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [answeredCount, currentQuestion, isFinalizingSubmission, isInteractionLocked, isLastQuestion, totalQuestions, currentQuestionIndex]);

  if (isFinalizingSubmission) {
    return (
      <div className="max-w-4xl mx-auto min-h-[55vh] flex items-center justify-center pb-8">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto dark:border-indigo-400" />
          <p className="text-slate-700 dark:text-slate-300">Submitting your quiz...</p>
        </div>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="max-w-4xl mx-auto pb-8">
        <div className="rounded-lg border border-slate-300 bg-slate-100 p-6 text-center dark:border-slate-700 dark:bg-slate-900">
          <p className="text-slate-700 dark:text-slate-300">No questions are available for this quiz.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-8">
      <div className="mb-4 md:mb-6 flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div className="w-full md:w-auto">
          <p className="text-sm text-slate-500 mb-1 dark:text-slate-400">
            Question {currentQuestionIndex + 1} of {totalQuestions}
          </p>
          <div className="w-full bg-slate-200 rounded-full h-2 md:w-64 dark:bg-slate-700">
            <div
              className="bg-indigo-600 h-2 rounded-full transition-all duration-300 dark:bg-indigo-500"
              style={{ width: `${((currentQuestionIndex + 1) / totalQuestions) * 100}%` }}
            />
          </div>
        </div>
        <div className="text-sm text-slate-600 font-medium dark:text-slate-300">
          {answeredCount} / {totalQuestions} answered {markedCount > 0 ? `| ${markedCount} marked` : ''} | {timerLabel}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap justify-between md:justify-end gap-2">
        {allowBreaks ? (
          <Button
            variant="outline"
            onClick={() => setIsOnBreak((previous) => !previous)}
            disabled={isSubmitting || isQuitting}
            className="py-1 px-2 bg-black/20 dark:bg-white/20 md:bg-none md:min-h-[2.5rem]"
          >
            {isOnBreak ? (
              <>
                <PlayCircle className="h-4 w-4 mr-2" />
                Resume Quiz
              </>
            ) : (
              <>
                <PauseCircle className="h-4 w-4 mr-2" />
                Take Break
              </>
            )}
          </Button>
        ) : null}
        <Button
          variant={markedForReview[currentQuestion.id] ? 'default' : 'outline'}
          onClick={toggleMarkForReview}
          disabled={isInteractionLocked}
          className="min-h-[2.5rem]"
        >
          <Flag className="h-4 w-4 mr-2" />
          {markedForReview[currentQuestion.id] ? 'Marked' : 'Mark for Review'}
        </Button>
        <Button
          variant="destructive"
          onClick={handleQuitQuiz}
          disabled={isInteractionLocked}
          className="min-h-[2.5rem] text-white dark:text-slate-100 hidden md:flex"
        >
          <XCircle className="h-4 w-4 mr-2" />
          {isQuitting ? 'Quitting...' : 'Quit Quiz'}
        </Button>
      </div>

      <div className="md:grid md:grid-cols-[minmax(0,1fr)_15rem] md:items-start md:gap-4">
        <div>
          {isOnBreak ? (
            <div className="rounded-lg border border-slate-300 bg-slate-100 p-8 text-center dark:border-slate-700 dark:bg-slate-900">
              <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">Break in progress</p>
              <p className="text-sm text-slate-600 mt-2 dark:text-slate-400">
                Timer and interactions are paused. Resume when ready.
              </p>
              <Button
                className="mt-4"
                onClick={() => setIsOnBreak(false)}
              >
                <PlayCircle className="h-4 w-4 mr-2" />
                Resume Quiz
              </Button>
            </div>
          ) : (
            <QuestionCard
              question={currentQuestion}
              selectedAnswer={answers[currentQuestion.id]}
              onAnswerChange={(value) => handleAnswerChange(currentQuestion, value)}
            />
          )}

          <div className="mt-6 flex flex-row items-center justify-between gap-3 md:gap-0">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={isFirstQuestion || isInteractionLocked}
              className="w-full md:w-auto min-h-[3rem] md:min-h-[2.5rem] text-slate-700 text-base dark:text-slate-300"
            >
              <ChevronLeft className="h-5 w-5 md:h-4 md:w-4 mr-2" />
              Previous
            </Button>

            {isLastQuestion ? (
              <Button
                onClick={() => handleSubmitQuiz()}
                disabled={isInteractionLocked}
                className="w-full md:w-auto min-h-[3rem] md:min-h-[2.5rem] bg-green-600 hover:bg-green-700 text-white text-base dark:bg-green-600 dark:hover:bg-green-700"
              >
                <CheckCircle className="h-5 w-5 md:h-4 md:w-4 mr-2" />
                {isSubmitting ? 'Submitting...' : 'Submit Quiz'}
              </Button>
            ) : (
              <Button
                onClick={handleNext}
                disabled={isInteractionLocked}
                className="w-full md:w-auto min-h-[3rem] md:min-h-[2.5rem] bg-indigo-600 hover:bg-indigo-700 text-white text-base dark:bg-indigo-500 dark:hover:bg-indigo-600"
              >
                Next
                <ChevronRight className="h-5 w-5 md:h-4 md:w-4 ml-2" />
              </Button>
            )}
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-slate-300 bg-slate-100 p-3 dark:border-slate-700 dark:bg-slate-900 md:mt-0">
          <p className="text-xs font-medium text-slate-600 mb-2 dark:text-slate-400">Question Navigator</p>
          <div className="flex flex-wrap gap-2">
            {quiz.questions.map((question, index) => {
              const isCurrent = index === currentQuestionIndex;
              const isAnswered = hasAnswerValue(answers[question.id]);
              const isMarked = Boolean(markedForReview[question.id]);
              return (
                <button
                  key={question.id}
                  type="button"
                  onClick={() => navigateToQuestion(index)}
                  disabled={isInteractionLocked}
                  className={cn(
                    'h-9 w-9 rounded-md border text-xs font-semibold transition-colors',
                    'disabled:cursor-not-allowed disabled:opacity-60 border-2',
                    isCurrent && 'border-indigo-600 bg-indigo-600 text-white',
                    isCurrent && isAnswered && !isMarked && 'border-green-500 bg-indigo-600 text-white',
                    isCurrent && isMarked && !isAnswered && 'border-amber-500 bg-indigo-600 text-white',
                    isCurrent && isAnswered && isMarked && 'border-y-amber-500 border-x-green-500 bg-indigo-600 text-white',
                    !isCurrent && isMarked && 'border-amber-500 bg-amber-100 text-amber-900 dark:border-amber-500 dark:bg-amber-950/40 dark:text-amber-300',
                    !isCurrent && isMarked && isAnswered && 'border-amber-500 bg-green-100 dark:border-amber-500 dark:bg-green-950/40 dark:text-green-300',
                    !isCurrent && !isMarked && isAnswered && 'border-green-500 bg-green-100 text-green-900 dark:border-green-500 dark:bg-green-950/40 dark:text-green-300',
                    !isCurrent && !isMarked && !isAnswered && 'border-slate-300 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300'
                  )}
                  title={`Question ${index + 1}`}
                >
                  {index + 1}
                </button>
              );
            })}
          </div>
        </div>
      </div>
        <Button
          variant="destructive"
          onClick={handleQuitQuiz}
          disabled={isInteractionLocked}
          className="mt-12 min-h-[2.5rem] text-white dark:text-slate-100 md:hidden"
        >
          <XCircle className="h-4 w-4 mr-2" />
          {isQuitting ? 'Quitting...' : 'Quit Quiz'}
        </Button>
    </div>
  );
};

export default QuizRunner;
