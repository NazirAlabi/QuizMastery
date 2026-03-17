import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ChevronDown, LayoutGrid, List } from 'lucide-react';
import Navbar from '@/components/layout/Navbar.jsx';
import SettingsModal from '@/components/layout/SettingsModal.jsx';
import DataStatusOverlay from '@/components/layout/DataStatusOverlay.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { cn } from '@/lib/utils.js';
import { useToast } from '@/components/ui/use-toast.jsx';
import { useAuth } from '@/hooks/useAuth.js';
import QuizCard from '@/components/quiz/QuizCard.jsx';
import { useCourse } from '@/hooks/useCourse.js';
import { useStartAttempt } from '@/hooks/useStartAttempt.js';
import { GUEST_ATTEMPT_LIMIT_REACHED_CODE } from '@/api/api.js';
import { appendReturnUrl } from '@/utils/returnUrl.js';
import FeedbackButton from '@/components/feedback/FeedbackButton.jsx';
import { getUserFriendlyErrorMessage, isConnectionRelatedError } from '@/utils/errorHandling.js';

const buildCourseDescription = (course) => {
  const baseDescription =   String(course?.longDescription || course?.shortDescription || course?.description || '').trim() ||
  'No course description provided.';

  return `${baseDescription}`.trim();
};

const CourseDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, isDevFeaturesEnabled } = useAuth();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [startingQuizId, setStartingQuizId] = useState(null);
  const [hasShownLoadError, setHasShownLoadError] = useState(false);
  const [selectedTopicFilters, setSelectedTopicFilters] = useState([]);
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const [viewMode, setViewMode] = useState('responsive'); // 'responsive' or 'grid-2'
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const { data: course, isLoading, isError, error, refetch } = useCourse(id);
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
      description: getUserFriendlyErrorMessage(error, 'Failed to load course page.'),
      variant: 'destructive',
    });
  }, [error, hasShownLoadError, isError, toast]);

  const description = useMemo(() => buildCourseDescription(course), [course]);
  const linkedQuizCount = useMemo(
    () => (Array.isArray(course?.quizzes) ? course.quizzes.length : 0),
    [course]
  );

  useEffect(() => {
    if (linkedQuizCount > 10) {
      setViewMode('grid-2');
    }
  }, [linkedQuizCount]);

  const availableTopics = useMemo(() => {
    if (!course?.quizzes) return [];
    const topics = new Set();
    course.quizzes.forEach((quiz) => {
      if (quiz.topic) topics.add(quiz.topic);
    });
    return Array.from(topics).sort();
  }, [course]);

  const toggleTopicFilter = useCallback((topic) => {
    setSelectedTopicFilters((prev) => {
      if (prev.includes(topic)) {
        return prev.filter((t) => t !== topic);
      }
      return [...prev, topic];
    });
  }, []);

  const clearFilters = useCallback(() => {
    setSelectedTopicFilters([]);
  }, []);

  const filteredQuizzes = useMemo(() => {
    if (!course?.quizzes) return [];
    if (selectedTopicFilters.length === 0) return course.quizzes;
    return course.quizzes.filter((quiz) => selectedTopicFilters.includes(quiz.topic));
  }, [course, selectedTopicFilters]);

  const quizzesByTopic = useMemo(() => {
    const grouped = {};
    filteredQuizzes.forEach((quiz) => {
      const topic = quiz.topic || 'General';
      if (!grouped[topic]) grouped[topic] = new Map();
      
      const titleKey = String(quiz.title || '').trim().toLowerCase();
      if (!grouped[topic].has(titleKey)) {
        grouped[topic].set(titleKey, []);
      }
      grouped[topic].get(titleKey).push(quiz);
    });

    // Convert Maps to sorted arrays of grouped variations
    const finalGrouped = {};
    Object.entries(grouped).forEach(([topic, titleGroups]) => {
      finalGrouped[topic] = Array.from(titleGroups.values()).map(variations => {
        const sorted = [...variations].sort((a, b) => {
          const diffs = { beginner: 1, intermediate: 2, advanced: 3 };
          return (diffs[a.difficulty] || 99) - (diffs[b.difficulty] || 99);
        });
        return {
          ...sorted[0],
          allVariations: sorted
        };
      }).sort((a, b) => a.title.localeCompare(b.title));
    });
    
    return finalGrouped;
  }, [filteredQuizzes]);

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
          description: 'Failed to start quiz',
          variant: 'destructive',
        });
        setStartingQuizId(null);
      }
    },
    [authPromptUrl, guestLimitUrl, navigate, startAttemptMutation, toast, user?.id]
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

  const shouldShowDataOverlay = !isLoading && isError;
  const safeCourse = course || { id: id || '', title: 'Course', quizzes: [] };

  return (
    <>
      <Helmet>
        <title>{`${safeCourse.title} - Course Page`}</title>
        <meta name="description" content={description} />
      </Helmet>

      <div className="min-h-screen">
        <Navbar onOpenSettings={() => setIsSettingsOpen(true)} />
        <SettingsModal open={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

        <div className="max-w-[95%] mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-10 space-y-6">
          <div className="space-y-3">
            <Link to="/courses" className="text-sm text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300">
              Back to courses
            </Link>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white">{safeCourse.title}</h1>
                {safeCourse.courseCode ? <Badge variant="outline">{safeCourse.courseCode}</Badge> : null}
              </div>
              <FeedbackButton
                contextKey="course_detail"
                contextLabel="Course Details"
                subjectType="course"
                subjectId={safeCourse.id}
                subjectTitle={safeCourse.title}
                label="Course Feedback"
              />
            </div>
            <p className="text-slate-600 dark:text-slate-300">{description}</p>
          </div>

          <DataStatusOverlay
            isVisible={shouldShowDataOverlay}
            title={isConnectionRelatedError(error) ? 'Connection issue' : 'Unable to load course'}
            description={isConnectionRelatedError(error)
              ? 'The course data did not load due to a network issue.'
              : 'Course objects were not returned. Retry loading this page.'}
            onRetry={() => refetch()}
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="py-5">
                  <span className="text-slate-700 dark:text-slate-300">Topic: {safeCourse.topic || 'General'}</span>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-5">
                  <span className="text-slate-700 dark:text-slate-300">Course code: {safeCourse.courseCode || 'Not specified'}</span>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-5">
                  <span className="text-slate-700 dark:text-slate-300">Linked quizzes: {linkedQuizCount}</span>
                </CardContent>
              </Card>
            </div>

            {windowWidth < 768 && linkedQuizCount > 2 && (
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

            {availableTopics.length > 0 && (
              <Card className="mb-6">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Filter by topics
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
                      {availableTopics.map((topic) => {
                        const isSelected = selectedTopicFilters.includes(topic);
                        return (
                          <Button
                            key={topic}
                            size="sm"
                            variant={isSelected ? 'default' : 'outline'}
                            onClick={() => toggleTopicFilter(topic)}
                            className="h-8 md:flex-shrink-0"
                          >
                            {topic} (
                            {safeCourse.quizzes.filter((q) => q.topic === topic).length})
                          </Button>
                        );
                      })}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={clearFilters}
                        disabled={selectedTopicFilters.length === 0}
                        className="h-8 md:flex-shrink-0"
                      >
                        Clear all filters
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {filteredQuizzes.length === 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">No quizzes match filters</CardTitle>
                  <CardDescription>Try clearing your filters to see more results.</CardDescription>
                </CardHeader>
              </Card>
            ) : (
              <div className="space-y-10">
                {Object.entries(quizzesByTopic).map(([topic, topicQuizzes]) => (
                  <section key={topic} className="space-y-4">
                    <h3 className="text-xl font-semibold text-slate-900 dark:text-white border-b pb-2">
                      {topic}
                    </h3>
                    <div
                      className={cn(
                        'grid gap-4 md:gap-6',
                        viewMode === 'grid-2'
                          ? 'grid-cols-2'
                          : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
                      )}
                    >
                      {topicQuizzes.map((quiz) => (
                        <QuizCard
                          key={quiz.id}
                          quiz={quiz}
                          variations={quiz.allVariations}
                          onStart={handleStartQuiz}
                          isStarting={startingQuizId === quiz.id}
                          isDevFeaturesEnabled={isDevFeaturesEnabled}
                          startLabel={getStartLabel(quiz)}
                          fullWidthButton={windowWidth < 480}
                        />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </DataStatusOverlay>
        </div>
      </div>
    </>
  );
};

export default CourseDetailPage;
