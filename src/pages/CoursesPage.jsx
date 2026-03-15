import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import Navbar from '@/components/layout/Navbar.jsx';
import SettingsModal from '@/components/layout/SettingsModal.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { useToast } from '@/components/ui/use-toast.jsx';
import { useAuth } from '@/hooks/useAuth.js';
import { getCoursePageById } from '@/api/api.js';
import { useCourses } from '@/hooks/useCourses.js';
import { useStartAttempt } from '@/hooks/useStartAttempt.js';
import QuizCard from '@/components/quiz/QuizCard.jsx';
import { queryKeys } from '@/hooks/queryKeys.js';
import { GUEST_ATTEMPT_LIMIT_REACHED_CODE } from '@/api/api.js';
import { appendReturnUrl } from '@/utils/returnUrl.js';
import { ChevronDown, LayoutGrid, List } from 'lucide-react';
import { cn } from '@/lib/utils.js';
import { getUserFriendlyErrorMessage } from '@/utils/errorHandling.js';

const CoursesPage = () => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [startingQuizId, setStartingQuizId] = useState(null);
  const [selectedCourseFilters, setSelectedCourseFilters] = useState([]);
  const [hasShownLoadError, setHasShownLoadError] = useState(false);
  const [expandedCourseIds, setExpandedCourseIds] = useState(new Set());
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const [viewMode, setViewMode] = useState('responsive'); // 'responsive' or 'grid-2'
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const quizLimit = useMemo(() => (windowWidth >= 768 ? 6 : 4), [windowWidth]);

  const toggleCourseDescription = useCallback((courseId) => {
    setExpandedCourseIds((prev) => {
      const next = new Set(prev);
      if (next.has(courseId)) {
        next.delete(courseId);
      } else {
        next.add(courseId);
      }
      return next;
    });
  }, []);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, isDevFeaturesEnabled } = useAuth();
  const queryClient = useQueryClient();
  const { data: courses = [], isLoading, isError } = useCourses();
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

  useEffect(() => {
    if (!isError || hasShownLoadError) return;

    setHasShownLoadError(true);
    toast({
      title: 'Error',
      description: getUserFriendlyErrorMessage(null, 'Failed to load courses'),
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
            title: 'Guest limit reached',
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

  const toggleCourseFilter = useCallback((courseId) => {
    setSelectedCourseFilters((previous) => {
      if (previous.includes(courseId)) {
        return previous.filter((entry) => entry !== courseId);
      }
      return [...previous, courseId];
    });
  }, []);

  const visibleCourses = useMemo(() => {
    if (selectedCourseFilters.length === 0) return courses;
    return courses.filter((course) => selectedCourseFilters.includes(course.id));
  }, [courses, selectedCourseFilters]);

  const groupedCourses = useMemo(() => {
    return visibleCourses.map(course => {
      const groups = new Map();
      course.quizzes.forEach(quiz => {
        const key = `${String(quiz.title || '').trim().toLowerCase()}|${String(quiz.topic || 'General').trim().toLowerCase()}`;
        if (!groups.has(key)) {
          groups.set(key, []);
        }
        groups.get(key).push(quiz);
      });
      
      const uniqueQuizzes = Array.from(groups.values()).map(variations => {
        const sorted = [...variations].sort((a, b) => {
          const diffs = { beginner: 1, intermediate: 2, advanced: 3 };
          return (diffs[a.difficulty] || 99) - (diffs[b.difficulty] || 99);
        });
        return {
          ...sorted[0],
          allVariations: sorted
        };
      });
      
      return {
        ...course,
        groupedQuizzes: uniqueQuizzes
      };
    });
  }, [visibleCourses]);

  const getStartLabel = useCallback(
    (quiz) => (isDevFeaturesEnabled ? `Start Quiz (${quiz.id})` : 'Start Quiz'),
    [isDevFeaturesEnabled]
  );

  const clearFilters = useCallback(() => {
    setSelectedCourseFilters([]);
  }, []);

  if (isLoading) {
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
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto dark:border-indigo-400"></div>
              <p className="mt-4 text-slate-600 dark:text-slate-400">Loading courses...</p>
            </div>
          </div>
        </div>
      </>
    );
  }

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

          {windowWidth < 768 && (
            <div className="flex justify-end mb-4">
              <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                <Button
                  size="sm"
                  variant={viewMode === 'responsive' ? 'secondary' : 'ghost'}
                  onClick={() => setViewMode('responsive')}
                  className="gap-2"
                >
                  <List className="h-4 w-4" />
                  Default
                </Button>
                <Button
                  size="sm"
                  variant={viewMode === 'grid-2' ? 'secondary' : 'ghost'}
                  onClick={() => setViewMode('grid-2')}
                  className="gap-2"
                >
                  <LayoutGrid className="h-4 w-4" />
                  Grid (2x)
                </Button>
              </div>
            </div>
          )}

          {courses.length > 0 && (
            <Card className="mb-6">
              <CardContent className="py-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Filter courses
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    type="button"
                    onClick={() => setIsMobileFiltersOpen((previous) => !previous)}
                    className="md:hidden h-8"
                    aria-expanded={isMobileFiltersOpen}
                  >
                    {isMobileFiltersOpen ? 'Hide' : 'Show'}
                    <ChevronDown
                      className={cn(
                        'ml-2 h-4 w-4 transition-transform',
                        isMobileFiltersOpen && 'rotate-180'
                      )}
                    />
                  </Button>
                </div>
                <div className={cn('mt-3', isMobileFiltersOpen ? 'block' : 'hidden', 'md:block')}>
                  <div className="flex flex-wrap items-center gap-2 md:flex-nowrap md:overflow-x-auto md:pb-1">
                    {courses.map((course) => {
                      const isSelected = selectedCourseFilters.includes(course.id);
                      return (
                        <Button
                          key={course.id}
                          size="sm"
                          variant={isSelected ? 'default' : 'outline'}
                          onClick={() => toggleCourseFilter(course.id)}
                          className="h-8 md:flex-shrink-0"
                        >
                          {course.title} ({course.quizzes.length})
                        </Button>
                      );
                    })}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={clearFilters}
                      disabled={selectedCourseFilters.length === 0}
                      className="h-8 md:flex-shrink-0"
                    >
                      Clear all filters
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="space-y-8">
            {groupedCourses.map((course) => (
              <section key={course.id} className="space-y-4 group/course">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                      <Link
                        to={`/courses/${course.id}`}
                        className="hover:text-indigo-700 dark:hover:text-indigo-300"
                        onMouseEnter={() => prefetchCourse(course.id)}
                        onFocus={() => prefetchCourse(course.id)}
                      >
                        {course.title}
                      </Link>
                    </h2>
                    {course.courseCode ? <Badge variant="outline">{course.courseCode}</Badge> : null}
                  </div>
                  <button onClick={() => toggleCourseDescription(course.id)} className='text-start'>
                    <p className={`text-slate-600 dark:text-slate-400 md:w-[700px] ${expandedCourseIds.has(course.id) ? '' : 'line-clamp-2 md:line-clamp-4'}`}>
                      {course.shortDescription || course.description || ''}
                    </p>
                  </button>
                </div>

                {course.groupedQuizzes.length === 0 ? (
                  <Card className="max-w-md">
                    <CardHeader>
                      <CardTitle className="text-lg">No quizzes linked yet</CardTitle>
                      <CardDescription>
                        This course currently has no active quizzes.
                      </CardDescription>
                    </CardHeader>
                  </Card>
                ) : (
                  <>
                    <div
                      className={cn(
                        'grid gap-4 md:gap-6',
                        viewMode === 'grid-2'
                          ? 'grid-cols-2'
                          : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
                      )}
                    >
                      {course.groupedQuizzes.slice(0, quizLimit).map((quiz, index) => (
                        <QuizCard
                          key={quiz.id}
                          quiz={quiz}
                          variations={quiz.allVariations}
                          onStart={handleStartQuiz}
                          isStarting={startingQuizId === quiz.id}
                          isDevFeaturesEnabled={isDevFeaturesEnabled}
                          startLabel={getStartLabel(quiz)}
                          fullWidthButton={isDevFeaturesEnabled}
                          defaultExpanded={index === 0}
                          isGrid={viewMode === 'grid-2'}
                        />
                      ))}
                    </div>
                    {course.groupedQuizzes.length > quizLimit && (
                      <div className="flex justify-center mt-4">
                        <Button variant="outline" asChild>
                          <Link
                            to={`/courses/${course.id}`}
                            onMouseEnter={() => prefetchCourse(course.id)}
                            onFocus={() => prefetchCourse(course.id)}
                          >
                            View all {course.groupedQuizzes.length} unique quizzes in {course.title}
                          </Link>
                        </Button>
                      </div>
                    )}
                  </>
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
        </div>
      </div>
    </>
  );
};

export default CoursesPage;
