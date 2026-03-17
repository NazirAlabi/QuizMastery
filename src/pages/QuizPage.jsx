import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import Navbar from '@/components/layout/Navbar.jsx';
import SettingsModal from '@/components/layout/SettingsModal.jsx';
import DataStatusOverlay from '@/components/layout/DataStatusOverlay.jsx';
import QuizRunner from '@/components/quiz/QuizRunner.jsx';
import { useToast } from '@/components/ui/use-toast.jsx';
import { useAttemptQuizSession } from '@/hooks/useAttemptQuizSession.js';
import { getUserFriendlyErrorMessage, isConnectionRelatedError } from '@/utils/errorHandling.js';
import FeedbackButton from '@/components/feedback/FeedbackButton.jsx';

const QuizPage = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const attemptId = searchParams.get('attemptId');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [hasShownLoadError, setHasShownLoadError] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: session, isLoading, isError, error, refetch } = useAttemptQuizSession(attemptId);
  const quiz = useMemo(() => session?.quiz || null, [session]);

  useEffect(() => {
    if (attemptId) return;

    toast({
      title: 'Error',
      description: getUserFriendlyErrorMessage(null, 'No attempt ID found'),
      variant: 'destructive',
    });
    navigate('/quizzes');
  }, [attemptId, navigate, toast]);

  useEffect(() => {
    if (!session?.quiz?.id || !id) return;
    if (String(session.quiz.id) === String(id)) return;

    toast({
      title: 'Error',
      description: getUserFriendlyErrorMessage(null, 'Attempt does not match selected quiz'),
      variant: 'destructive',
    });
    navigate('/quizzes');
  }, [id, navigate, session?.quiz?.id, toast]);

  useEffect(() => {
    if (!isError || hasShownLoadError) return;

    setHasShownLoadError(true);
    toast({
      title: 'Error',
      description: getUserFriendlyErrorMessage(error, 'Failed to load quiz'),
      variant: 'destructive',
    });
  }, [error, hasShownLoadError, isError, toast]);

  if (isLoading || !attemptId) {
    return (
      <>
        <Helmet>
          <title>Loading Quiz - QuizMaster</title>
        </Helmet>
        <div className="min-h-screen">
          <Navbar onOpenSettings={() => setIsSettingsOpen(true)} />
          <SettingsModal open={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto dark:border-indigo-400"></div>
              <p className="mt-4 text-slate-600 dark:text-slate-400">Loading quiz...</p>
            </div>
          </div>
        </div>
      </>
    );
  }

  const hasQuizMatch = quiz && String(quiz.id || '') === String(id || '');
  const showDataOverlay = !isLoading && (isError || !hasQuizMatch);
  const overlayTitle = isConnectionRelatedError(error) ? 'Connection issue' : 'Unable to load attempt session';
  const overlayDescription = isConnectionRelatedError(error)
    ? 'Quiz attempt data was not loaded due to bad connection.'
    : 'Quiz session data was not returned. Retry loading.';

  return (
    <>
      <Helmet>
        <title>{`${quiz.title} - QuizMaster`}</title>
        <meta
          name="description"
          content={quiz.shortDescription || quiz.description || quiz.longDescription || ''}
        />
      </Helmet>

      <div className="min-h-screen">
        {/* TODO: Make a simplistic Navbar version for this page without links to other pages and just a settings button */}
        {/* <Navbar onOpenSettings={() => setIsSettingsOpen(true)} /> */}
        {/* <SettingsModal open={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} /> */}

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-12">
          <div className="mb-4 md:mb-8">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-3xl font-bold text-slate-900 mb-2 dark:text-white">{quiz.title}</h1>
                <p className="text-slate-600 dark:text-slate-400 hidden md:block">
                  {quiz.shortDescription || quiz.description || quiz.longDescription}
                </p>
              </div>
              <FeedbackButton
                contextKey="quiz_attempt"
                contextLabel="Quiz Attempt"
                subjectType="quiz"
                subjectId={quiz.id}
                subjectTitle={quiz.title}
                label="Quiz Feedback"
              />
            </div>
          </div>

          <DataStatusOverlay
            isVisible={showDataOverlay}
            title={overlayTitle}
            description={overlayDescription}
            onRetry={() => refetch()}
          >
            {hasQuizMatch ? <QuizRunner quiz={quiz} attemptId={attemptId} /> : <div className="min-h-[240px]" />}
          </DataStatusOverlay>
        </div>
      </div>
    </>
  );
};

export default QuizPage;
