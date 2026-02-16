import React from 'react';
import { Card, CardContent } from '@/components/ui/card.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { cn } from '@/lib/utils.js';
import LatexRenderer from '@/components/ui/LatexRenderer.jsx';
import ExplanationCard from '@/components/quiz/ExplanationCard.jsx';

const QuestionCard = ({ question, selectedAnswer, onSelectOption, showResult = false }) => {
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

        <div className="space-y-3 md:space-y-4 mt-4 md:mt-6">
          {question.options.map((option) => {
            const isSelected = selectedAnswer === option.id;
            const isCorrect = showResult && option.id === question.correctAnswer;
            const isWrong = showResult && isSelected && option.id !== question.correctAnswer;

            return (
              <button
                key={option.id}
                onClick={() => !showResult && onSelectOption(option.id)}
                disabled={showResult}
                className={cn(
                  'w-full text-left p-3 md:p-4 rounded-lg border-2 transition-all min-h-[3.5rem] md:min-h-[3rem]',
                  'hover:shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 active:scale-[0.99]',
                  isSelected && !showResult && 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30 dark:border-indigo-500',
                  !isSelected && !showResult && 'border-slate-300 bg-slate-100 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600',
                  isCorrect && 'border-green-500 bg-green-50 dark:bg-green-950/30 dark:border-green-500',
                  isWrong && 'border-red-500 bg-red-50 dark:bg-red-950/30 dark:border-red-500',
                  showResult && !isCorrect && !isWrong && 'border-slate-200 bg-slate-50 opacity-60 dark:border-slate-800 dark:bg-slate-900'
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'flex-shrink-0 w-7 h-7 md:w-6 md:h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold',
                      isSelected && !showResult && 'border-indigo-500 bg-indigo-500 text-white dark:border-indigo-500 dark:bg-indigo-500',
                      !isSelected && !showResult && 'border-slate-300 text-slate-500 dark:border-slate-600 dark:text-slate-400',
                      isCorrect && 'border-green-500 bg-green-500 text-white',
                      isWrong && 'border-red-500 bg-red-500 text-white'
                    )}
                  >
                    {option.id.toUpperCase()}
                  </div>
                  <span className={cn(
                    'text-base md:text-sm text-slate-900 leading-snug dark:text-slate-200',
                    showResult && !isCorrect && !isWrong && 'text-slate-500 dark:text-slate-500'
                  )}>
                    <LatexRenderer content={option.text} />
                  </span>
                </div>
              </button>
            );
          })}
        </div>

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
