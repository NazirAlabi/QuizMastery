import React, { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { BookOpen, Clock, Play, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { getQuizById, getQuizPageById } from '@/api/api.js';
import { queryKeys } from '@/hooks/queryKeys.js';

const FIVE_MINUTES = 5 * 60 * 1000;

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

const getTimeStatus = (quiz) => {
  if (!quiz?.createdAt || !quiz?.updatedAt) return null;

  const twoDaysAgo = Date.now() - 2 * 24 * 60 * 60 * 1000;
  const createdAtTime = new Date(quiz.createdAt).getTime();
  const updatedAtTime = new Date(quiz.updatedAt).getTime();

  if (createdAtTime > twoDaysAgo) return 'new';
  if (updatedAtTime > twoDaysAgo) return 'updated';
  return null;
};

const getDifficultySelectClassName = (difficulty) => {
  const variant = getDifficultyVariant(difficulty);
  if (variant === 'success') {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:border-emerald-400 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60 dark:hover:border-emerald-700';
  }
  if (variant === 'warning') {
    return 'bg-amber-50 text-amber-700 border-amber-200 hover:border-amber-400 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/60 dark:hover:border-amber-700';
  }
  if (variant === 'destructive') {
    return 'bg-rose-50 text-rose-700 border-rose-200 hover:border-rose-400 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/60 dark:hover:border-rose-700';
  }
  return 'bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-400 dark:bg-slate-800/40 dark:text-slate-300 dark:border-slate-700';
};

const QuizCard = ({
  quiz,
  onStart,
  isStarting = false,
  isDevFeaturesEnabled = false,
  startLabel = 'Start Quiz',
  fullWidthButton = false,
  defaultExpanded = false,
  className = '',
  variations = [],
  isGrid = false,
}) => {
  const queryClient = useQueryClient();
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [activeQuizId, setActiveQuizId] = useState(quiz?.id || '');
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1024
  );

  React.useEffect(() => {
    setActiveQuizId(quiz?.id || '');
  }, [quiz?.id]);

  React.useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const sortedVariations = useMemo(
    () => [...(Array.isArray(variations) ? variations : [])].sort((a, b) => Number(a.difficulty) - Number(b.difficulty)),
    [variations]
  );
  const hasVariations = sortedVariations.length > 1;

  const activeQuiz = useMemo(() => {
    if (!hasVariations) return quiz;
    return sortedVariations.find((variation) => variation.id === activeQuizId) || sortedVariations[0] || quiz;
  }, [activeQuizId, hasVariations, quiz, sortedVariations]);

  const compactGrid = isGrid && viewportWidth <= 768;
  const quizTimeStatus = getTimeStatus(activeQuiz);

  const prefetchQuiz = useCallback(() => {
    const id = activeQuiz?.id;
    if (!id) return;

    queryClient.prefetchQuery({
      queryKey: queryKeys.quizPage(id),
      queryFn: () => getQuizPageById(id),
      staleTime: FIVE_MINUTES,
    });
    queryClient.prefetchQuery({
      queryKey: queryKeys.quiz(id),
      queryFn: () => getQuizById(id),
      staleTime: FIVE_MINUTES,
    });
  }, [activeQuiz?.id, queryClient]);

  return (
    <Card
      className={cn(
        'relative hover:shadow-lg transition-shadow flex flex-col dark:hover:shadow-slate-800/50 overflow-hidden w-full h-full group',
        className
      )}
      onMouseEnter={prefetchQuiz}
      onFocus={prefetchQuiz}
    >
      <CardHeader className={cn('pb-2', compactGrid ? 'space-y-1 p-3' : 'pb-3 min-h-[128px]')}>
        {quizTimeStatus ? (
          <Badge
            variant="outline"
            className="md:absolute md:top-2 md:left-6 bg-indigo-50 w-max text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-300 dark:border-indigo-800"
          >
            {quizTimeStatus}
          </Badge>
        ) : null}

        <div className={cn('flex items-start justify-between gap-2', compactGrid ? 'flex-col' : 'flex-col md:flex-row mb-2')}>
          <CardTitle className={cn(
            'text-lg leading-tight group/course:active:line-clamp-none line-clamp-3',
            compactGrid ? 'text-base group-focus:line-clamp-none' : 'md:text-xl'
          )}>
            <Link
              to={`/quizzes/${activeQuiz.id}`}
              className="hover:text-indigo-700 dark:hover:text-indigo-300"
              onMouseEnter={prefetchQuiz}
              onFocus={prefetchQuiz}
            >
              {activeQuiz.title}
            </Link>
          </CardTitle>

          <div className="flex flex-col items-center gap-2">
            {hasVariations ? (
              <div className="relative group/difficulty">
                <select
                  value={activeQuiz.id}
                  onChange={(event) => setActiveQuizId(event.target.value)}
                  className={cn(
                    'appearance-none cursor-pointer pr-8 pl-3 py-1 rounded-full text-[11px] font-bold border-[1.5px] transition-all duration-200 outline-none shadow-sm',
                    getDifficultySelectClassName(activeQuiz.difficulty)
                  )}
                >
                  {sortedVariations.map((variation) => (
                    <option
                      key={variation.id}
                      value={variation.id}
                      className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                    >
                      {variation.difficulty.charAt(0).toUpperCase() + variation.difficulty.slice(1)}
                    </option>
                  ))}
                </select>
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-current opacity-70">
                  <ChevronDown className="h-3.5 w-3.5" />
                </div>
              </div>
            ) : (
              <Badge variant={getDifficultyVariant(activeQuiz.difficulty)} className="shrink-0 text-[10px] px-1.5 py-0">
                {activeQuiz.difficulty}
              </Badge>
            )}

            {!compactGrid ? (
              <Badge
                variant="outline"
                className="md:hidden bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-300 dark:border-indigo-800"
              >
                {activeQuiz.topic}
              </Badge>
            ) : null}
          </div>
        </div>

        {!compactGrid && !(activeQuiz.shortDescription === '' && activeQuiz.description === '' && activeQuiz.longDescription === '') ? (
          <>
            <CardDescription className={`text-sm md:text-base ${isExpanded ? 'block' : 'hidden md:block'}`}>
              {activeQuiz.shortDescription || activeQuiz.description || activeQuiz.longDescription}
            </CardDescription>
            <Button variant="ghost" className="self-start md:hidden gap-2 py-1 px-2" onClick={() => setIsExpanded((previous) => !previous)}>
              {isExpanded ? 'Hide Description' : 'Show Description'}
              <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            </Button>
          </>
        ) : null}
      </CardHeader>

      <CardContent className={cn('mt-auto flex flex-col', compactGrid ? 'p-3 pt-0' : 'pt-0')}>
        <div className={cn('space-y-1 flex flex-col', compactGrid ? 'mb-2' : 'mb-4')}>
          <div className={cn('flex gap-3', compactGrid ? 'flex-row items-center text-[11px]' : 'flex-row gap-5 md:gap-2 flex-start md:flex-col text-sm')}>
            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
              <BookOpen className={compactGrid ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
              <span>{activeQuiz.questionCount} {compactGrid ? 'q' : 'questions'}</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
              <Clock className={compactGrid ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
              <span>{activeQuiz.estimatedTime} {compactGrid ? 'min' : 'minutes'}</span>
            </div>
          </div>

          {!compactGrid ? (
            <Badge
              variant="outline"
              className="hidden md:flex mt-2 md:w-fit bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-300 dark:border-indigo-800"
            >
              {activeQuiz.topic}
            </Badge>
          ) : null}

          {isDevFeaturesEnabled && !compactGrid ? (
            <div className="text-xs text-slate-500 font-mono dark:text-slate-400">
              id={activeQuiz.id}
            </div>
          ) : null}
        </div>

        <Button
          onClick={() => onStart(activeQuiz)}
          disabled={isStarting}
          size={compactGrid ? 'sm' : 'default'}
          className={cn(
            'bg-indigo-600 truncate hover:bg-indigo-700 text-white dark:bg-indigo-500 dark:hover:bg-indigo-600 transition-all',
            compactGrid ? 'w-full h-8 text-xs' : `${fullWidthButton ? 'w-full' : 'w-48 self-center'} min-h-[2.5rem] text-base`
          )}
        >
          <Play className={cn('mr-1.5 hover:fill-white', compactGrid ? 'h-3 w-3' : 'h-4 w-4')} />
          {!compactGrid ? (isStarting ? 'Starting...' : startLabel) : 'Start'}
        </Button>
      </CardContent>
    </Card>
  );
};

const areEqual = (previousProps, nextProps) =>
  previousProps.quiz === nextProps.quiz &&
  previousProps.variations === nextProps.variations &&
  previousProps.isStarting === nextProps.isStarting &&
  previousProps.isDevFeaturesEnabled === nextProps.isDevFeaturesEnabled &&
  previousProps.startLabel === nextProps.startLabel &&
  previousProps.fullWidthButton === nextProps.fullWidthButton &&
  previousProps.className === nextProps.className &&
  previousProps.onStart === nextProps.onStart &&
  previousProps.isGrid === nextProps.isGrid;

export default React.memo(QuizCard, areEqual);
