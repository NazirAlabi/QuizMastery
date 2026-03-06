import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BookOpen, Clock, Play } from 'lucide-react';
import Navbar from '@/components/layout/Navbar.jsx';
import SettingsModal from '@/components/layout/SettingsModal.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { useToast } from '@/components/ui/use-toast.jsx';
import { useAuth } from '@/hooks/useAuth.js';
import { getCoursePageById, startAttempt } from '@/api/api.js';

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
  const [isLoading, setIsLoading] = useState(true);
  const [startingQuizId, setStartingQuizId] = useState(null);
  const [course, setCourse] = useState(null);

  useEffect(() => {
    const loadCourse = async () => {
      try {
        const data = await getCoursePageById(id);
        setCourse(data);
      } catch (error) {
        toast({
          title: 'Error',
          description: error.message || 'Failed to load course page.',
          variant: 'destructive',
        });
        navigate('/courses');
      } finally {
        setIsLoading(false);
      }
    };

    loadCourse();
  }, [id, navigate, toast]);

  const baseDescription = useMemo(() => buildCourseBaseDescription(course), [course]);
  const descriptionDetail = useMemo(() => buildCourseDescriptionDetail(course), [course]);
  const linkedQuizCount = useMemo(
    () => (Array.isArray(course?.quizzes) ? course.quizzes.length : 0),
    [course]
  );

  const handleStartQuiz = async (quiz) => {
    setStartingQuizId(quiz.id);
    try {
      const attempt = await startAttempt(quiz.id, user.id);
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
  };

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
                <Card key={quiz.id} className="hover:shadow-lg transition-shadow flex flex-col h-full dark:hover:shadow-slate-800/50">
                  <CardHeader className="pb-3 min-h-[128px]">
                    <div className="flex items-start justify-between mb-2 gap-2">
                      <CardTitle className="text-lg md:text-xl leading-tight line-clamp-2">
                        <Link to={`/quizzes/${quiz.id}`} className="hover:text-indigo-700 dark:hover:text-indigo-300">
                          {quiz.title}
                        </Link>
                      </CardTitle>
                      <Badge variant={getDifficultyVariant(quiz.difficulty)} className="shrink-0">
                        {quiz.difficulty}
                      </Badge>
                    </div>
                    <CardDescription className="text-sm md:text-base line-clamp-3">
                      {quiz.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="mt-auto pt-0">
                    <div className="space-y-3 mb-4">
                      <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                        <BookOpen className="h-4 w-4" />
                        <span>{quiz.questionCount} questions</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                        <Clock className="h-4 w-4" />
                        <span>~{quiz.estimatedTime} minutes</span>
                      </div>
                      <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-300 dark:border-indigo-800">
                        {quiz.topic}
                      </Badge>
                      {isDevFeaturesEnabled ? (
                        <div className="text-xs text-slate-500 font-mono dark:text-slate-400">quizId={quiz.id}</div>
                      ) : null}
                    </div>

                    <Button
                      onClick={() => handleStartQuiz(quiz)}
                      disabled={startingQuizId === quiz.id}
                      className="w-full min-h-[2.75rem] md:min-h-[2.5rem] bg-indigo-600 hover:bg-indigo-700 text-white text-base dark:bg-indigo-500 dark:hover:bg-indigo-600"
                    >
                      <Play className="h-5 w-5 md:h-4 md:w-4 mr-2 hover:fill-white" />
                      {startingQuizId === quiz.id ? 'Starting...' : 'Start Quiz'}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default CourseDetailPage;
