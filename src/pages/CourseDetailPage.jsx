import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Navbar from '@/components/layout/Navbar.jsx';
import SettingsModal from '@/components/layout/SettingsModal.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { useToast } from '@/components/ui/use-toast.jsx';
import { useAuth } from '@/hooks/useAuth.js';
import QuizCard from '@/components/quiz/QuizCard.jsx';
import { useCourse } from '@/hooks/useCourse.js';
import { useStartAttempt } from '@/hooks/useStartAttempt.js';

const buildCourseBaseDescription = (course) =>
  String(course?.description || '').trim() || 'No course description provided.';

const buildCourseDescriptionDetail = (course) => {
  const baseDescription = buildCourseBaseDescription(course);
  const quizCount = Array.isArray(course?.quizzes) ? course.quizzes.length : 0;
  const parts = [
    `Topic: ${course?.topic || 'General'}.`,
    `Course code: ${course?.courseCode || 'Not specified'}.`,
    `Linked quizzes: ${quizCount}.`,
  ];

  return `${baseDescription} ${parts.join(' ')}`.trim();
};

const CourseDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, isDevFeaturesEnabled } = useAuth();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [startingQuizId, setStartingQuizId] = useState(null);
  const [hasShownLoadError, setHasShownLoadError] = useState(false);
  const { data: course, isLoading, isError } = useCourse(id);
  const startAttemptMutation = useStartAttempt();

  useEffect(() => {
    if (!isError || hasShownLoadError) return;

    setHasShownLoadError(true);
    toast({
      title: 'Error',
      description: 'Failed to load course page.',
      variant: 'destructive',
    });
    navigate('/courses');
  }, [hasShownLoadError, isError, navigate, toast]);

  const baseDescription = useMemo(() => buildCourseBaseDescription(course), [course]);
  const descriptionDetail = useMemo(() => buildCourseDescriptionDetail(course), [course]);
  const linkedQuizCount = useMemo(
    () => (Array.isArray(course?.quizzes) ? course.quizzes.length : 0),
    [course]
  );

  const handleStartQuiz = useCallback(
    async (quiz) => {
      if (!user?.id) return;

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
      } catch {
        toast({
          title: 'Error',
          description: 'Failed to start quiz',
          variant: 'destructive',
        });
        setStartingQuizId(null);
      }
    },
    [navigate, startAttemptMutation, toast, user?.id]
  );

  const getStartLabel = useCallback(
    (quiz) => (isDevFeaturesEnabled ? `Start Quiz (${quiz.id})` : 'Start Quiz'),
    [isDevFeaturesEnabled]
  );

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <Navbar onOpenSettings={() => setIsSettingsOpen(true)} />
        <SettingsModal open={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto dark:border-indigo-400" />
            <p className="mt-4 text-slate-600 dark:text-slate-400">Loading course page...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!course) return null;

  return (
    <>
      <Helmet>
        <title>{`${course.title} - Course Page`}</title>
        <meta name="description" content={descriptionDetail} />
      </Helmet>

      <div className="min-h-screen">
        <Navbar onOpenSettings={() => setIsSettingsOpen(true)} />
        <SettingsModal open={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

        <div className="max-w-[95%] mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-10 space-y-6">
          <div className="space-y-3">
            <Link to="/courses" className="text-sm text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300">
              Back to courses
            </Link>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white">{course.title}</h1>
              {course.courseCode ? <Badge variant="outline">{course.courseCode}</Badge> : null}
            </div>
            <p className="text-slate-600 dark:text-slate-300">{baseDescription}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="py-5">
                <span className="text-slate-700 dark:text-slate-300">Topic: {course.topic || 'General'}</span>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-5">
                <span className="text-slate-700 dark:text-slate-300">Course code: {course.courseCode || 'Not specified'}</span>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-5">
                <span className="text-slate-700 dark:text-slate-300">Linked quizzes: {linkedQuizCount}</span>
              </CardContent>
            </Card>
          </div>

          {course.quizzes.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">No quizzes linked yet</CardTitle>
                <CardDescription>This course currently has no active quizzes.</CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
              {course.quizzes.map((quiz) => (
                <QuizCard
                  key={quiz.id}
                  quiz={quiz}
                  onStart={handleStartQuiz}
                  isStarting={startingQuizId === quiz.id}
                  isDevFeaturesEnabled={isDevFeaturesEnabled}
                  startLabel={getStartLabel(quiz)}
                  fullWidthButton
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default CourseDetailPage;
