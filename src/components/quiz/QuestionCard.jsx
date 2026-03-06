import React from 'react';
import { Card, CardContent } from '@/components/ui/card.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Input } from '@/components/ui/input.jsx';
import { cn } from '@/lib/utils.js';
import LatexRenderer from '@/components/ui/LatexRenderer.jsx';
import ExplanationCard from '@/components/quiz/ExplanationCard.jsx';
import { evaluateAnswer, isQuestionAutoGraded } from '@/utils/evaluateAnswer.js';

const QuestionCard = ({ question, selectedAnswer, onAnswerChange, showResult = false }) => {
  const getDifficultyVariant = (difficulty) => {
    switch (difficulty) {
      case 'easy':
        return 'success';
      case 'medium':
        return 'warning';
      case 'hard':
        return 'destructive';
      default:
        return 'default';
    }
  };

  const answerValue = String(selectedAnswer ?? '');
  const questionType = String(question?.type || '').toLowerCase();
  const isAutoGraded = isQuestionAutoGraded(question);
  const evaluation = showResult ? evaluateAnswer(question, answerValue) : null;
  const isCorrect = evaluation === true;
  const isWrong = evaluation === false;
  const hasSubmittedAnswer = answerValue.trim().length > 0;
  const options = Array.isArray(question?.options) ? question.options : [];
  const acceptedAnswers = Array.isArray(question?.acceptedAnswers) ? question.acceptedAnswers : [];

  const renderMcq = () => (
    <div className="space-y-3 md:space-y-4 mt-4 md:mt-6">
      {options.map((option) => {
        const isSelected = answerValue === option.id;
        const optionIsCorrect = showResult && option.id === question.correctAnswer;
        const optionIsWrong = showResult && isSelected && option.id !== question.correctAnswer;

        return (
          <button
            key={option.id}
            onClick={() => !showResult && onAnswerChange(option.id)}
            disabled={showResult}
            className={cn(
              'w-full text-left p-3 md:p-4 rounded-lg border-2 transition-all min-h-[3.5rem] md:min-h-[3rem]',
              'hover:shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 active:scale-[0.99]',
              isSelected && !showResult && 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30 dark:border-indigo-500',
              !isSelected && !showResult && 'border-slate-300 bg-slate-100 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600',
              optionIsCorrect && 'border-green-500 bg-green-50 dark:bg-green-950/30 dark:border-green-500',
              optionIsWrong && 'border-red-500 bg-red-50 dark:bg-red-950/30 dark:border-red-500',
              showResult && !optionIsCorrect && !optionIsWrong && 'border-slate-200 bg-slate-50 opacity-60 dark:border-slate-800 dark:bg-slate-900'
            )}
          >
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'flex-shrink-0 w-7 h-7 md:w-6 md:h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold',
                  isSelected && !showResult && 'border-indigo-500 bg-indigo-500 text-white dark:border-indigo-500 dark:bg-indigo-500',
                  !isSelected && !showResult && 'border-slate-300 text-slate-500 dark:border-slate-600 dark:text-slate-400',
                  optionIsCorrect && 'border-green-500 bg-green-500 text-white',
                  optionIsWrong && 'border-red-500 bg-red-500 text-white'
                )}
              >
                {String(option.id || '').toUpperCase()}
              </div>
              <span
                className={cn(
                  'text-base md:text-sm text-slate-900 leading-snug dark:text-slate-200',
                  showResult && !optionIsCorrect && !optionIsWrong && 'text-slate-500 dark:text-slate-500'
                )}
              >
                <LatexRenderer content={option.text} />
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );

  const renderTextInput = () => {
    const commonClassName =
      'mt-4 w-full rounded-lg border border-slate-300 bg-slate-100 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100';

    if (questionType === 'long_answer') {
      return (
        <textarea
          className={cn(commonClassName, 'min-h-[160px] px-3 py-2 text-sm')}
          placeholder="Type your answer..."
          value={answerValue}
          disabled={showResult}
          onChange={(event) => onAnswerChange(event.target.value)}
        />
      );
    }

    return (
      <Input
        type={questionType === 'numeric' ? 'number' : 'text'}
        step={questionType === 'numeric' ? 'any' : undefined}
        className={cn(commonClassName, 'mt-4')}
        placeholder={questionType === 'numeric' ? 'Enter a number' : 'Type your answer'}
        value={answerValue}
        disabled={showResult}
        onChange={(event) => onAnswerChange(event.target.value)}
      />
    );
  };

  const renderResultSummary = () => {
    if (!showResult || questionType === 'mcq') return null;

    return (
      <div className="mt-4 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
        <p className="text-xs text-slate-500 dark:text-slate-400">Submitted answer</p>
        <p className="text-sm text-slate-900 whitespace-pre-wrap dark:text-slate-100">
          {hasSubmittedAnswer ? answerValue : 'No answer submitted'}
        </p>

        {isAutoGraded ? (
          <p className={cn('text-sm font-medium', isCorrect ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>
            {isCorrect ? 'Correct' : 'Incorrect'}
          </p>
        ) : (
          <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
            Not auto-graded. This answer requires manual review.
          </p>
        )}

        {isAutoGraded && questionType === 'short_answer' && acceptedAnswers.length > 0 ? (
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Accepted answers: {acceptedAnswers.join(' | ')}
          </p>
        ) : null}

        {isAutoGraded && questionType === 'numeric' ? (
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Expected: {question.numericAnswer}
            {Number.isFinite(Number(question.tolerance)) ? ` (±${question.tolerance})` : ''}
          </p>
        ) : null}
      </div>
    );
  };

  return (
    <Card className="w-full shadow-sm">
      <CardContent className="p-4 md:p-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-3 md:gap-4 mb-4 md:mb-6">
          <div className="flex-1">
            <div className="text-lg md:text-xl font-medium text-slate-900 leading-relaxed dark:text-slate-100">
              <LatexRenderer content={question.text} />
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0 self-start">
            <Badge variant={getDifficultyVariant(question.difficulty)} className="text-xs md:text-sm px-2 py-1">
              {question.difficulty}
            </Badge>
            <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-xs md:text-sm px-2 py-1 dark:bg-indigo-950/30 dark:text-indigo-300 dark:border-indigo-800">
              {question.topic}
            </Badge>
          </div>
        </div>

        {questionType === 'mcq' ? renderMcq() : renderTextInput()}
        {renderResultSummary()}

        {showResult && question.explanation && (
          <div className="mt-6">
            <ExplanationCard explanation={question.explanation} />
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default QuestionCard;
