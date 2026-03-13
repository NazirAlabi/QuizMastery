import React, { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { BookOpen, Clock, Play, ChevronDown } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { getQuizById, getQuizPageById } from '@/api/api.js';
import { queryKeys } from '@/hooks/queryKeys.js';

const getDifficultyVariant = (difficulty) => {
  switch (difficulty) {
    case 'beginner':
      return 'success';
    case 'intermediate':
      return 'warning';
    case 'advanced':
      return 'destructive';
    default:
      return 'default';
  }
};

const FIVE_MINUTES = 5 * 60 * 1000;

const QuizCard = ({
  quiz,
  onStart,
  isStarting = false,
  isDevFeaturesEnabled = false,
  startLabel = 'Start Quiz',
  fullWidthButton = false,
  defaultExpanded = false,
  className = '',
}) => {
  const queryClient = useQueryClient();

  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const prefetchQuiz = useCallback(() => {
    if (!quiz?.id) return;

    queryClient.prefetchQuery({
      queryKey: queryKeys.quizPage(quiz.id),
      queryFn: () => getQuizPageById(quiz.id),
      staleTime: FIVE_MINUTES,
    });

    queryClient.prefetchQuery({
      queryKey: queryKeys.quiz(quiz.id),
      queryFn: () => getQuizById(quiz.id),
      staleTime: FIVE_MINUTES,
    });
  }, [queryClient, quiz?.id]);

  return (
    <Card
      className={`hover:shadow-lg transition-shadow flex flex-col h-full dark:hover:shadow-slate-800/50 ${className}`}
      onMouseEnter={prefetchQuiz}
      onFocus={prefetchQuiz}
    >
      <CardHeader className="pb-3 min-h-[128px]">
        <div className="flex flex-col md:flex-row items-start justify-between mb-2 gap-2">
          <CardTitle className="text-lg md:text-xl leading-tight line-clamp-3 group/course:active:line-clamp-none">
            <Link
              to={`/quizzes/${quiz.id}`}
              className="hover:text-indigo-700 dark:hover:text-indigo-300"
              onMouseEnter={prefetchQuiz}
              onFocus={prefetchQuiz}
            >
              {quiz.title}
            </Link>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={getDifficultyVariant(quiz.difficulty)} className="shrink-0">
              {quiz.difficulty}
            </Badge>
            <Badge
              variant="outline"
              className="md:hidden bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-300 dark:border-indigo-800"
            >
              {quiz.topic}
            </Badge>
          </div>
        </div>
        <CardDescription className={`text-sm md:text-base ${isExpanded ? 'block' : 'hidden md:block'}`} >
          {quiz.shortDescription || quiz.description || quiz.longDescription}
        </CardDescription>
        <Button variant="ghost" className="self-start md:hidden gap-2 py-1 px-2" onClick={() => setIsExpanded(!isExpanded)}>
          {isExpanded ? 'Hide Description' : 'Show Description'}
          <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
        </Button>
      </CardHeader>
      <CardContent className="mt-auto pt-0 flex flex-col">
        <div className="space-y-2 mb-4 flex flex-start flex-col">
          <div className='flex flex-row gap-5 flex-start md:flex-col'>
            <div className="flex w-fit md:w-auto items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <BookOpen className="h-4 w-4" />
              <span>{quiz.questionCount} questions</span>
            </div>
            <div className="flex w-fit md:w-auto items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <Clock className="h-4 w-4" />
              <span>~{quiz.estimatedTime} minutes</span>
            </div>
          </div>
          <Badge
            variant="outline"
            className="hidden md:flex md:w-fit bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-300 dark:border-indigo-800"
          >
            {quiz.topic}
          </Badge>
          {isDevFeaturesEnabled ? (
            <div className="text-xs text-slate-500 font-mono dark:text-slate-400">
              quizId={quiz.id} | timing={quiz.timing?.enabled ? 'timed' : 'untimed'}
            </div>
          ) : null}
        </div>

        <Button
          onClick={() => onStart(quiz)}
          disabled={isStarting}
          className={`${fullWidthButton ? 'w-full' : 'w-48 self-center'} min-h-[2.75rem] md:min-h-[2.5rem] bg-indigo-600 hover:bg-indigo-700 text-white text-base dark:bg-indigo-500 dark:hover:bg-indigo-600`}
        >
          <Play className="h-5 w-5 md:h-4 md:w-4 mr-2 hover:fill-white" />
          {isStarting ? 'Starting...' : startLabel}
        </Button>
      </CardContent>
    </Card>
  );
};

const areEqual = (previousProps, nextProps) =>
  previousProps.quiz === nextProps.quiz &&
  previousProps.isStarting === nextProps.isStarting &&
  previousProps.isDevFeaturesEnabled === nextProps.isDevFeaturesEnabled &&
  previousProps.startLabel === nextProps.startLabel &&
  previousProps.fullWidthButton === nextProps.fullWidthButton &&
  previousProps.className === nextProps.className &&
  previousProps.onStart === nextProps.onStart;

export default React.memo(QuizCard, areEqual);
