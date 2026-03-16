import React, { useCallback, useState } from 'react';
import { cn } from '@/lib/utils';
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



const getTimeStatus = (quiz) => {
  if  (!quiz || !quiz?.createdAt || !quiz?.updatedAt) return 0;

  const twoDaysAgo = Date.now() - 2 * 24 * 60 * 60 * 1000; // 2 days in milliseconds
  const createdAtTime = new Date(quiz?.createdAt).getTime();
  const updatedAtTime = new Date(quiz?.updatedAt).getTime();

  if (createdAtTime > twoDaysAgo) {
    // Quiz was created in the last two days
    return 2;
  }
  else if (updatedAtTime > twoDaysAgo) {
    // Quiz was updated in the last two days
    return 1;
  }
  else {
    // Quiz is older than two days
    return 0;
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
  variations = [],
  isGrid = false,
}) => {
  const queryClient = useQueryClient();

  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [activeQuiz, setActiveQuiz] = useState(quiz);

  // Sync activeQuiz if quiz prop changes
  React.useEffect(() => {
    setActiveQuiz(quiz);
  }, [quiz]);

  const hasVariations = variations && variations.length > 1;
  const sortedVariations = React.useMemo(() => {
    return [...variations].sort((a, b) => Number(a.difficulty) - Number(b.difficulty));
  }, [variations]);

  const quizTimeStatus = getTimeStatus(quiz);

  const timeStatusObject = quizTimeStatus === 1 ? {
    badgeClassList: 'md:absolute md:top-2 md:left-6 bg-indigo-50 w-max text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-300 dark:border-indigo-800',
    text: 'updated',
  } : quizTimeStatus === 2 ? {
    badgeClassList: 'md:absolute md:top-2 md:left-6 bg-indigo-50 w-max text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-300 dark:border-indigo-800',
    text: 'new',
  } : null;

  const prefetchQuiz = useCallback(() => {
    const id = activeQuiz?.id;
    if (!id) return;

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
      className={cn(
        'relative hover:shadow-lg transition-shadow flex flex-col dark:hover:shadow-slate-800/50 overflow-hidden w-full h-full group',
        className
      )}
      onMouseEnter={prefetchQuiz}
      onFocus={prefetchQuiz}
    >
      <CardHeader className={cn(
        'pb-2',
        isGrid ? 'space-y-1 p-3' : 'pb-3 min-h-[128px]'
      )}>
        {quizTimeStatus !== 0 && timeStatusObject && (
          <Badge variant="outline" className={timeStatusObject.badgeClassList}>
            {timeStatusObject.text}
          </Badge>
        )}
        <div className={cn(
          'flex items-start justify-between gap-2',
          isGrid ? 'flex-col' : 'flex-col md:flex-row mb-2'
        )}>
          <CardTitle className={cn(
            'text-lg leading-tight group/course:active:line-clamp-none line-clamp-3',
            isGrid ? ' text-base group-focus:line-clamp-none' : 'md:text-xl'
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
                    onChange={(e) => {
                      const selected = variations.find((v) => v.id === e.target.value);
                      if (selected) setActiveQuiz(selected);
                    }}
                    className={cn(
                      'appearance-none cursor-pointer pr-8 pl-3 py-1 rounded-full text-[11px] font-bold border-[1.5px] transition-all duration-200 outline-none shadow-sm',
                      (() => {
                        const variant = getDifficultyVariant(activeQuiz.difficulty);
                        switch (variant) {
                          case 'success':
                            return 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:border-emerald-400 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60 dark:hover:border-emerald-700';
                          case 'warning':
                            return 'bg-amber-50 text-amber-700 border-amber-200 hover:border-amber-400 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/60 dark:hover:border-amber-700';
                          case 'destructive':
                            return 'bg-rose-50 text-rose-700 border-rose-200 hover:border-rose-400 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/60 dark:hover:border-rose-700';
                          default:
                            return 'bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-400 dark:bg-slate-800/40 dark:text-slate-300 dark:border-slate-700';
                        }
                      })()
                    )}
                  >
                    {sortedVariations.map((v) => (
                      <option
                        key={v.id}
                        value={v.id}
                        className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                      >
                        {v.difficulty.charAt(0).toUpperCase() + v.difficulty.slice(1)}
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

            {!isGrid && (
              <Badge
                variant="outline"
                className="md:hidden bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-300 dark:border-indigo-800"
              >
                {activeQuiz.topic}
              </Badge>
            )}
          </div>
        </div>
        {!isGrid && !(activeQuiz.shortDescription === '' && activeQuiz.description === '' && activeQuiz.longDescription === '') ? (
          <>
            <CardDescription className={`text-sm md:text-base ${isExpanded ? 'block' : 'hidden md:block'}`} >
              {activeQuiz.shortDescription || activeQuiz.description || activeQuiz.longDescription}
            </CardDescription>
            <Button variant="ghost" className="self-start md:hidden gap-2 py-1 px-2" onClick={() => setIsExpanded(!isExpanded)}>
              {isExpanded ? 'Hide Description' : 'Show Description'}
              <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            </Button>
          </>
        ) : null}
      </CardHeader>
      <CardContent className={cn(
        'mt-auto flex flex-col',
        isGrid ? 'p-3 pt-0' : 'pt-0'
      )}>
        <div className={cn(
          'space-y-1 flex flex-col',
          isGrid ? 'mb-2' : 'mb-4'
        )}>
          <div className={cn(
            'flex gap-3',
            isGrid ? 'flex-row items-center text-[11px]' : 'flex-row gap-5 md:gap-2 flex-start md:flex-col text-sm'
          )}>
            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
              <BookOpen className={isGrid ? "h-3.5 w-3.5" : "h-4 w-4"} />
              <span>{activeQuiz.questionCount} {isGrid ? 'q' : 'questions'}</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
              <Clock className={isGrid ? "h-3.5 w-3.5" : "h-4 w-4"} />
              <span>{activeQuiz.estimatedTime} {isGrid ? 'min' : 'minutes'}</span>
            </div>
          </div>
          {!isGrid && (
            <Badge
              variant="outline"
              className="hidden md:flex mt-2 md:w-fit bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-300 dark:border-indigo-800"
            >
              {activeQuiz.topic}
            </Badge>
          )}
          {isDevFeaturesEnabled && !isGrid && (
            <div className="text-xs text-slate-500 font-mono dark:text-slate-400">
              id={activeQuiz.id}
            </div>
          )}
        </div>

        <Button
          onClick={() => onStart(activeQuiz)}
          disabled={isStarting}
          size={isGrid ? 'sm' : 'default'}
          className={cn(
            'bg-indigo-600 truncate hover:bg-indigo-700 text-white dark:bg-indigo-500 dark:hover:bg-indigo-600 transition-all',
            isGrid ? 'w-full h-8 text-xs' : `${fullWidthButton ? 'w-full' : 'w-48 self-center'} min-h-[2.5rem] text-base`
          )}
        >
          <Play className={cn(
            'mr-1.5 hover:fill-white',
            isGrid ? 'h-3 w-3' : 'h-4 w-4'
          )} />
          {!isGrid ? isStarting ? '...' : startLabel : 'Start'}
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
  previousProps.onStart === nextProps.onStart;

export default React.memo(QuizCard, areEqual);
