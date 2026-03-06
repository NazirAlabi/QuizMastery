import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, Clock, Play } from 'lucide-react';
import Navbar from '@/components/layout/Navbar.jsx';
import SettingsModal from '@/components/layout/SettingsModal.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { useToast } from '@/components/ui/use-toast.jsx';
import { useAuth } from '@/hooks/useAuth.js';
import { getCoursesWithQuizzes, startAttempt } from '@/api/api.js';

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

const CoursesPage = () => {
  const [courses, setCourses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [startingQuizId, setStartingQuizId] = useState(null);
  const [selectedCourseFilters, setSelectedCourseFilters] = useState([]);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, isDevFeaturesEnabled } = useAuth();

  useEffect(() => {
    const loadCourses = async () => {
      try {
        const data = await getCoursesWithQuizzes();
        const sortedCourses = [...data].sort((courseA, courseB) => {
          const quizCountA = Array.isArray(courseA.quizzes) ? courseA.quizzes.length : Number(courseA.quizCount || 0);
          const quizCountB = Array.isArray(courseB.quizzes) ? courseB.quizzes.length : Number(courseB.quizCount || 0);
          if (quizCountA !== quizCountB) return quizCountB - quizCountA;
          return String(courseA.title || '').localeCompare(String(courseB.title || ''), undefined, { sensitivity: 'base' });
        });
        setCourses(sortedCourses);
      } catch {
        toast({
          title: 'Error',
          description: 'Failed to load courses',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadCourses();
  }, [toast]);

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

  const toggleCourseFilter = (courseId) => {
    setSelectedCourseFilters((previous) => {
      if (previous.includes(courseId)) {
        return previous.filter((entry) => entry !== courseId);
      }
      return [...previous, courseId];
    });
  };

  const visibleCourses = useMemo(() => {
    if (selectedCourseFilters.length === 0) return courses;
    return courses.filter((course) => selectedCourseFilters.includes(course.id));
  }, [courses, selectedCourseFilters]);

  return (
    <>
      <Helmet>
        <title>Courses - QuizMaster</title>
        <meta
          name="description"
          content="Browse courses and start quizzes grouped by each course."
        />
      </Helmet>

      <div className="min-h-screen">
        <Navbar onOpenSettings={() => setIsSettingsOpen(true)} />
        <SettingsModal open={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

        <div className="max-w-[95%] mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-12">
          <div className="mb-6 md:mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2 dark:text-white">
              Available Courses
            </h1>
            <p className="text-base md:text-lg text-slate-600 dark:text-slate-400">
              Browse courses and launch quizzes by subject area.
            </p>
          </div>

          {!isLoading && courses.length > 0 && (
            <Card className="mb-6">
              <CardContent className="py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Filter courses:</span>
                  {courses.map((course) => {
                    const isSelected = selectedCourseFilters.includes(course.id);
                    return (
                      <Button
                        key={course.id}
                        size="sm"
                        variant={isSelected ? 'default' : 'outline'}
                        onClick={() => toggleCourseFilter(course.id)}
                        className="h-8"
                      >
                        {course.title} ({course.quizzes.length})
                      </Button>
                    );
                  })}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedCourseFilters([])}
                    disabled={selectedCourseFilters.length === 0}
                    className="h-8"
                  >
                    Clear all filters
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto dark:border-indigo-400"></div>
              <p className="mt-4 text-slate-600 dark:text-slate-400">Loading courses...</p>
            </div>
          ) : (
            <div className="space-y-8">
              {visibleCourses.map((course) => (
                <section key={course.id} className="space-y-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                        <Link to={`/courses/${course.id}`} className="hover:text-indigo-700 dark:hover:text-indigo-300">
                          {course.title}
                        </Link>
                      </h2>
                      {course.courseCode ? <Badge variant="outline">{course.courseCode}</Badge> : null}
                    </div>
                    <p className="text-slate-600 dark:text-slate-400">{course.description}</p>
                  </div>

                  {course.quizzes.length === 0 ? (
                    <Card className="max-w-md">
                      <CardHeader>
                        <CardTitle className="text-lg">No quizzes linked yet</CardTitle>
                        <CardDescription>
                          This course currently has no active quizzes.
                        </CardDescription>
                      </CardHeader>
                    </Card>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
                      {course.quizzes.map((quiz) => (
                        <Card
                          key={quiz.id}
                          className="hover:shadow-lg transition-shadow flex flex-col h-full dark:hover:shadow-slate-800/50"
                        >
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
                          <CardContent className="mt-auto pt-0 flex flex-col">
                            <div className="space-y-3 mb-4 flex-1">
                              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                                <BookOpen className="h-4 w-4" />
                                <span>{quiz.questionCount} questions</span>
                              </div>
                              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                                <Clock className="h-4 w-4" />
                                <span>~{quiz.estimatedTime} minutes</span>
                              </div>
                              <Badge
                                variant="outline"
                                className="bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-300 dark:border-indigo-800"
                              >
                                {quiz.topic}
                              </Badge>
                              {isDevFeaturesEnabled ? (
                                <div className="text-xs text-slate-500 font-mono dark:text-slate-400">
                                  quizId={quiz.id}
                                </div>
                              ) : null}
                            </div>

                            <Button
                              onClick={() => handleStartQuiz(quiz)}
                              disabled={startingQuizId === quiz.id}
                              className={`${isDevFeaturesEnabled ? 'w-full' : 'w-48 self-center'} min-h-[2.75rem] md:min-h-[2.5rem] bg-indigo-600 hover:bg-indigo-700 text-white text-base dark:bg-indigo-500 dark:hover:bg-indigo-600`}
                            >
                              <Play className="h-5 w-5 md:h-4 md:w-4 mr-2 hover:fill-white" />
                              {startingQuizId === quiz.id
                                ? 'Starting...'
                                : isDevFeaturesEnabled
                                  ? `Start Quiz (${quiz.id})`
                                  : 'Start Quiz'}
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </section>
              ))}
              {visibleCourses.length === 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">No matching courses</CardTitle>
                    <CardDescription>
                      Your current filters did not match any course. Clear filters to see all courses.
                    </CardDescription>
                  </CardHeader>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default CoursesPage;
