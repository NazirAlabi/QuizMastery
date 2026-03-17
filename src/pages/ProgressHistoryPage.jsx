import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import Navbar from '@/components/layout/Navbar.jsx';
import SettingsModal from '@/components/layout/SettingsModal.jsx';
import DataStatusOverlay from '@/components/layout/DataStatusOverlay.jsx';
import ProgressInsightsCard from '@/components/results/ProgressInsightsCard.jsx';
import AttemptHistoryList from '@/components/results/AttemptHistoryList.jsx';
import { Button } from '@/components/ui/button.jsx';
import { useProgressInsights } from '@/hooks/useProgressInsights.js';
import { useUserAttempts } from '@/hooks/useUserAttempts.js';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx';
import { getUserFriendlyErrorMessage, isConnectionRelatedError } from '@/utils/errorHandling.js';

const ProgressHistoryPage = () => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('insights');
  const navigate = useNavigate();
  const {
    data: progressInsights,
    isLoading: isInsightsLoading,
    isError: isInsightsError,
    error: insightsError,
    refetch: refetchInsights,
  } = useProgressInsights();
  const {
    data: userAttempts,
    isLoading: isAttemptsLoading,
    isError: isAttemptsError,
    error: attemptsError,
    refetch: refetchAttempts,
  } = useUserAttempts();

  return (
    <>
      <Helmet>
        <title>Progress & History - QuizMaster</title>
        <meta
          name="description"
          content="Track strengths, weaknesses, and view your complete quiz history."
        />
      </Helmet>

      <div className="min-h-screen">
        <Navbar onOpenSettings={() => setIsSettingsOpen(true)} />
        <SettingsModal open={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-12">
          <div className="mb-6 md:mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2 dark:text-white">
              Progress & History
            </h1>
            <p className="text-sm md:text-base text-slate-600 dark:text-slate-400">
              Analyze your performance and review your journey across all quizzes.
            </p>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="mb-6 w-full flex h-auto p-1 bg-slate-100 rounded-lg dark:bg-slate-800">
              <TabsTrigger value="insights" className="flex-1 py-2">Insights</TabsTrigger>
              <TabsTrigger value="history" className="flex-1 py-2">Attempt History</TabsTrigger>
            </TabsList>

            <TabsContent value="insights" className="space-y-6">
              <DataStatusOverlay
                isVisible={isInsightsError}
                title={isConnectionRelatedError(insightsError) ? 'Connection issue' : 'Insights unavailable'}
                description={getUserFriendlyErrorMessage(insightsError, 'Failed to load progress insights.')}
                onRetry={() => refetchInsights()}
              >
                <ProgressInsightsCard progressInsights={progressInsights} loading={isInsightsLoading} />
              </DataStatusOverlay>
            </TabsContent>

            <TabsContent value="history">
              <DataStatusOverlay
                isVisible={isAttemptsError}
                title={isConnectionRelatedError(attemptsError) ? 'Connection issue' : 'History unavailable'}
                description={getUserFriendlyErrorMessage(attemptsError, 'Failed to load attempt history.')}
                onRetry={() => refetchAttempts()}
              >
                <AttemptHistoryList attempts={userAttempts} loading={isAttemptsLoading} />
              </DataStatusOverlay>
            </TabsContent>
          </Tabs>

          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Button onClick={() => navigate('/quizzes')} className="w-full sm:w-auto">
              Take a quiz
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate('/courses')}
              className="w-full sm:w-auto"
            >
              Browse courses
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};

export default ProgressHistoryPage;
