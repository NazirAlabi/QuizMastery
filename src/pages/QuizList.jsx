import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import Navbar from '@/components/layout/Navbar.jsx';
import SettingsModal from '@/components/layout/SettingsModal.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { useAuth } from '@/hooks/useAuth.js';
import { Search, X } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast.jsx';
import QuizCard from '@/components/quiz/QuizCard.jsx';
import { useQuizzes } from '@/hooks/useQuizzes.js';
import { useStartAttempt } from '@/hooks/useStartAttempt.js';
import { GUEST_ATTEMPT_LIMIT_REACHED_CODE } from '@/api/api.js';
import { appendReturnUrl } from '@/utils/returnUrl.js';
import { getUserFriendlyErrorMessage } from '@/utils/errorHandling.js';

const QuizList = () => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [startingQuizId, setStartingQuizId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [hasShownLoadError, setHasShownLoadError] = useState(false);
  const { user, isDevFeaturesEnabled } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: quizzes = [], isLoading, isError } = useQuizzes();
  const startAttemptMutation = useStartAttempt();
  const location = useLocation();
  const returnUrl = useMemo(
    () => `${location.pathname}${location.search}${location.hash}`,
    [location.hash, location.pathname, location.search]
  );
  const authPromptUrl = useMemo(() => appendReturnUrl('/auth-prompt', returnUrl), [returnUrl]);
  const guestLimitUrl = useMemo(
    () => appendReturnUrl('/register?reason=guest-attempt-limit', returnUrl),
    [returnUrl]
  );

  const filteredQuizzes = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();
    if (!normalizedSearch) return quizzes;

    return quizzes.filter((quiz) => {
      const haystack = [
        quiz.title,
        quiz.shortDescription,
        quiz.longDescription,
        quiz.description,
        quiz.topic,
        quiz.difficulty,
        quiz.id,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [quizzes, searchQuery]);

  useEffect(() => {
    if (!isError || hasShownLoadError) return;

    setHasShownLoadError(true);
    toast({
      title: 'Error',
      description: getUserFriendlyErrorMessage(null, 'Failed to load quizzes'),
      variant: 'destructive',
    });
  }, [hasShownLoadError, isError, toast]);

  const handleStartQuiz = useCallback(
    async (quiz) => {
      if (!user?.id) {
        navigate(authPromptUrl);
        return;
      }

      setStartingQuizId(quiz.id);
      try {
        const attempt = await startAttemptMutation.mutateAsync({
          quizId: quiz.id,
          userId: user.id,
        });
        navigate(`/quiz/${quiz.id}/ready?attemptId=${attempt.id}`, {
          state: {
            quizTitle: quiz.title,
            questionCount: quiz.questionCount,
            estimatedTime: quiz.estimatedTime,
          },
        });
      } catch (error) {
        if (error?.code === GUEST_ATTEMPT_LIMIT_REACHED_CODE) {
          toast({
            title: 'Free guest limit reached',
            description: 'Create an account to continue taking quizzes.',
          });
          navigate(guestLimitUrl);
          setStartingQuizId(null);
          return;
        }

        toast({
          title: 'Error',
          description: getUserFriendlyErrorMessage(error, 'Failed to start quiz'),
          variant: 'destructive',
        });
        setStartingQuizId(null);
      }
    },
    [authPromptUrl, guestLimitUrl, navigate, startAttemptMutation, toast, user?.id]
  );

  const startButtonLabel = useCallback(
    (quiz) => (isDevFeaturesEnabled ? `Start Quiz (${quiz.id})` : 'Start Quiz'),
    [isDevFeaturesEnabled]
  );

  if (isLoading) {
    return (
      <>
        <Helmet>
          <title>Quizzes - QuizMaster</title>
          <meta name="description" content="Browse and take quizzes on various computer science topics" />
        </Helmet>
        <div className="min-h-screen">
          <Navbar onOpenSettings={() => setIsSettingsOpen(true)} />
          <SettingsModal open={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto dark:border-indigo-400"></div>
              <p className="mt-4 text-slate-600 dark:text-slate-400">Loading quizzes...</p>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>Quizzes - QuizMaster</title>
        <meta name="description" content="Browse and take quizzes on various computer science topics" />
      </Helmet>

      <div className="min-h-screen">
        <Navbar onOpenSettings={() => setIsSettingsOpen(true)} />
        <SettingsModal open={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

        <div className="max-w-[95%] mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-12">
          <div className="mb-6 md:mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2 dark:text-white">Available Quizzes</h1>
            <p className="text-base md:text-lg text-slate-600 dark:text-slate-400">
              Test your knowledge and track your progress
            </p>
          </div>

          <div className="mb-6">
            <div className="relative max-w-xl">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search quizzes..."
                className="pl-9 pr-10"
              />
              {searchQuery ? (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
                >
                  <X className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
          </div>

          {isDevFeaturesEnabled && (
            <Card className="mb-6 border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-amber-900 dark:text-amber-200">
                  Developer Features
                </CardTitle>
                <CardDescription className="text-amber-800 dark:text-amber-300">
                  Quiz metadata is visible and start buttons include raw IDs for debugging.
                </CardDescription>
              </CardHeader>
            </Card>
          )}

          <div className="flex flex-wrap gap-4 md:gap-6">
            {filteredQuizzes.map((quiz, index) => (
              <QuizCard
                key={quiz.id}
                quiz={quiz}
                onStart={handleStartQuiz}
                isStarting={startingQuizId === quiz.id}
                isDevFeaturesEnabled={isDevFeaturesEnabled}
                startLabel={startButtonLabel(quiz)}
                fullWidthButton={isDevFeaturesEnabled}
                className="max-w-md"
                defaultExpanded={index === 0}
              />
            ))}
          </div>

          {filteredQuizzes.length === 0 ? (
            <Card className="mt-6">
              <CardContent className="py-8 text-center text-slate-600 dark:text-slate-400">
                No quizzes match your search.
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
};

export default QuizList;
