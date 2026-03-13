import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { BookOpen, Clock, Play } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import Navbar from '@/components/layout/Navbar.jsx';
import SettingsModal from '@/components/layout/SettingsModal.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { useToast } from '@/components/ui/use-toast.jsx';
import { useAuth } from '@/hooks/useAuth.js';
import { getCoursePageById } from '@/api/api.js';
import { useQuizPage } from '@/hooks/useQuizPage.js';
import { useStartAttempt } from '@/hooks/useStartAttempt.js';
import { queryKeys } from '@/hooks/queryKeys.js';
import { GUEST_ATTEMPT_LIMIT_REACHED_CODE } from '@/api/api.js';
import { appendReturnUrl } from '@/utils/returnUrl.js';
import { getUserFriendlyErrorMessage } from '@/utils/errorHandling.js';

const buildQuizDescriptionDetail = (quiz) => {
  const baseDescription =
    String(quiz?.longDescription || quiz?.shortDescription || quiz?.description || '').trim() ||
    'No quiz description provided.';

  return `${baseDescription}`.trim();
};

const QuizDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, isDevFeaturesEnabled } = useAuth();
  const queryClient = useQueryClient();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [hasShownLoadError, setHasShownLoadError] = useState(false);
  const { data: quiz, isLoading, isError } = useQuizPage(id);
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
  const associatedCourses = useMemo(
    () => (Array.isArray(quiz?.associatedCourses) ? quiz.associatedCourses : []),
    [quiz]
  );

  useEffect(() => {
    if (!isError || hasShownLoadError) return;

    setHasShownLoadError(true);
    toast({
      title: 'Error',
      description: getUserFriendlyErrorMessage(null, 'Failed to load quiz page.'),
      variant: 'destructive',
    });
    navigate('/quizzes');
  }, [hasShownLoadError, isError, navigate, toast]);

  const descriptionDetail = useMemo(() => buildQuizDescriptionDetail(quiz), [quiz]);
  const questionTypeBreakdown = useMemo(() => {
    const bucket = {};
    (quiz?.questions || []).forEach((question) => {
      const key = String(question?.type || 'unknown');
      bucket[key] = (bucket[key] || 0) + 1;
    });
    return Object.entries(bucket).sort((a, b) => a[0].localeCompare(b[0]));
  }, [quiz]);

  const handleStartQuiz = useCallback(async () => {
    if (!quiz || !user?.id) {
      if (!user?.id) {
        navigate(authPromptUrl);
      }
      return;
    }

    setIsStarting(true);
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
        setIsStarting(false);
        return;
      }

      toast({
        title: 'Error',
        description: getUserFriendlyErrorMessage(error, 'Failed to start quiz'),
        variant: 'destructive',
      });
      setIsStarting(false);
    }
  }, [authPromptUrl, guestLimitUrl, navigate, quiz, startAttemptMutation, toast, user?.id]);

  const prefetchCourse = useCallback(
    (courseId) => {
      queryClient.prefetchQuery({
        queryKey: queryKeys.course(courseId),
        queryFn: () => getCoursePageById(courseId),
        staleTime: 5 * 60 * 1000,
      });
    },
    [queryClient]
  );

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <Navbar onOpenSettings={() => setIsSettingsOpen(true)} />
        <SettingsModal open={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto dark:border-indigo-400" />
            <p className="mt-4 text-slate-600 dark:text-slate-400">Loading quiz page...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!quiz) return null;

  return (
    <>
      <Helmet>
        <title>{`${quiz.title} - Quiz Page`}</title>
        <meta name="description" content={descriptionDetail} />
      </Helmet>

      <div className="min-h-screen">
        <Navbar onOpenSettings={() => setIsSettingsOpen(true)} />
        <SettingsModal open={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

        <div className="max-w-[95%] mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-10 space-y-6">
          <div className="space-y-3">
            <Link to="/quizzes" className="text-sm text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300">
              Back to quizzes
            </Link>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white">{quiz.title}</h1>
              <Badge variant="outline">{quiz.difficulty}</Badge>
            </div>
            <p className="text-slate-600 dark:text-slate-300">{descriptionDetail}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="py-5">
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                  <BookOpen className="h-4 w-4" />
                  <span>{quiz.questionCount} questions</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-5">
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                  <Clock className="h-4 w-4" />
                  <span>~{quiz.estimatedTime} minutes</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-5">
                <span className="text-slate-700 dark:text-slate-300">Topic: {quiz.topic}</span>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Associated Courses</CardTitle>
              <CardDescription>Courses that currently include this quiz.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {associatedCourses.length === 0 ? (
                <p className="text-sm text-slate-600 dark:text-slate-400">No course associations yet.</p>
              ) : (
                associatedCourses.map((course) => (
                  <Badge key={course.id} variant="outline" className="gap-2">
                    <Link
                      to={`/courses/${course.id}`}
                      className="hover:text-indigo-700 dark:hover:text-indigo-300"
                      onMouseEnter={() => prefetchCourse(course.id)}
                      onFocus={() => prefetchCourse(course.id)}
                    >
                      {course.title}
                    </Link>
                  </Badge>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Question Type Breakdown</CardTitle>
              <CardDescription>Distribution of question formats in this quiz.</CardDescription>
            </CardHeader>
            <CardContent>
              {questionTypeBreakdown.length === 0 ? (
                <p className="text-sm text-slate-600 dark:text-slate-400">No questions available.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {questionTypeBreakdown.map(([type, count]) => (
                    <Badge key={type} variant="outline">{type}: {count}</Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleStartQuiz}
              disabled={isStarting}
              className="min-h-[2.75rem] bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-indigo-500 dark:hover:bg-indigo-600"
            >
              <Play className="h-4 w-4 mr-2" />
              {isStarting ? 'Starting...' : 'Start Quiz'}
            </Button>
            <Button asChild variant="outline">
              <Link to="/courses">Browse Courses</Link>
            </Button>
          </div>

          {isDevFeaturesEnabled ? (
            <p className="text-xs font-mono text-slate-500 dark:text-slate-400">quizId={quiz.id}</p>
          ) : null}
        </div>
      </div>
    </>
  );
};

export default QuizDetailPage;
