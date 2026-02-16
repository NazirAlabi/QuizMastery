import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import QuestionCard from '@/components/quiz/QuestionCard.jsx';
import { Button } from '@/components/ui/button.jsx';
import { submitAnswer, submitQuiz } from '@/api/api.js';
import { ChevronLeft, ChevronRight, CheckCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast.jsx';

const QuizRunner = ({ quiz, attemptId }) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(
    quiz.timing?.enabled && quiz.timing?.durationSeconds
      ? quiz.timing.durationSeconds
      : null
  );
  const navigate = useNavigate();
  const { toast } = useToast();
  const hasSubmittedRef = useRef(false);

  const currentQuestion = quiz.questions[currentQuestionIndex];
  const totalQuestions = quiz.questions.length;
  const isLastQuestion = currentQuestionIndex === totalQuestions - 1;
  const isFirstQuestion = currentQuestionIndex === 0;
  const isTimedQuiz = Boolean(quiz.timing?.enabled && quiz.timing?.durationSeconds);
  const formattedTimeRemaining = useMemo(() => {
    if (!isTimedQuiz || remainingSeconds == null) return null;
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }, [isTimedQuiz, remainingSeconds]);

  useEffect(() => {
    if (!isTimedQuiz || remainingSeconds == null || hasSubmittedRef.current) return;

    if (remainingSeconds <= 0) {
      handleSubmitQuiz({ bypassUnansweredPrompt: true, isAutoSubmit: true });
      return;
    }

    const timer = window.setInterval(() => {
      setRemainingSeconds((previous) => {
        if (previous == null) return previous;
        if (previous <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        return previous - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isTimedQuiz, remainingSeconds]);

  const handleSelectOption = async (optionId) => {
    setAnswers(prev => ({
      ...prev,
      [currentQuestion.id]: optionId
    }));

    try {
      await submitAnswer(attemptId, currentQuestion.id, optionId);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save answer. Please try again.',
        variant: 'destructive'
      });
    }
  };

  const handleNext = () => {
    if (currentQuestionIndex < totalQuestions - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      window.scrollTo(0, 0);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
      window.scrollTo(0, 0);
    }
  };

  const handleSubmitQuiz = async ({ bypassUnansweredPrompt = false, isAutoSubmit = false } = {}) => {
    if (hasSubmittedRef.current) return;

    const unansweredCount = totalQuestions - Object.keys(answers).length;

    if (!bypassUnansweredPrompt && unansweredCount > 0) {
      const confirmed = window.confirm(
        `You have ${unansweredCount} unanswered question${unansweredCount > 1 ? 's' : ''}. Submit anyway?`
      );
      if (!confirmed) return;
    }

    hasSubmittedRef.current = true;
    setIsSubmitting(true);
    try {
      const result = await submitQuiz(attemptId);
      toast({
        title: isAutoSubmit ? 'Time is up!' : 'Quiz Submitted!',
        description: 'Redirecting to results...',
      });
      setTimeout(() => {
        navigate(`/results/${result.attemptId}`);
      }, 1000);
    } catch (error) {
      hasSubmittedRef.current = false;
      toast({
        title: 'Error',
        description: 'Failed to submit quiz. Please try again.',
        variant: 'destructive'
      });
      setIsSubmitting(false);
    }
  };

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
          {Object.keys(answers).length} / {totalQuestions} answered
          {formattedTimeRemaining ? ` • Time Left: ${formattedTimeRemaining}` : ''}
        </div>
      </div>

      <QuestionCard
        question={currentQuestion}
        selectedAnswer={answers[currentQuestion.id]}
        onSelectOption={handleSelectOption}
      />

      <div className="mt-6 flex flex-col-reverse md:flex-row items-center justify-between gap-3 md:gap-0">
        <Button
          variant="outline"
          onClick={handlePrevious}
          disabled={isFirstQuestion}
          className="w-full md:w-auto min-h-[3rem] md:min-h-[2.5rem] text-slate-700 text-base dark:text-slate-300"
        >
          <ChevronLeft className="h-5 w-5 md:h-4 md:w-4 mr-2" />
          Previous
        </Button>

        {isLastQuestion ? (
          <Button
            onClick={handleSubmitQuiz}
            disabled={isSubmitting}
            className="w-full md:w-auto min-h-[3rem] md:min-h-[2.5rem] bg-green-600 hover:bg-green-700 text-white text-base dark:bg-green-600 dark:hover:bg-green-700"
          >
            <CheckCircle className="h-5 w-5 md:h-4 md:w-4 mr-2" />
            {isSubmitting ? 'Submitting...' : 'Submit Quiz'}
          </Button>
        ) : (
          <Button
            onClick={handleNext}
            className="w-full md:w-auto min-h-[3rem] md:min-h-[2.5rem] bg-indigo-600 hover:bg-indigo-700 text-white text-base dark:bg-indigo-500 dark:hover:bg-indigo-600"
          >
            Next
            <ChevronRight className="h-5 w-5 md:h-4 md:w-4 ml-2" />
          </Button>
        )}
      </div>
    </div>
  );
};

export default QuizRunner;
