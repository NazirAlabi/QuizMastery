import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import Navbar from '@/components/layout/Navbar.jsx';
import SettingsModal from '@/components/layout/SettingsModal.jsx';
import ProgressInsightsCard from '@/components/results/ProgressInsightsCard.jsx';
import { Button } from '@/components/ui/button.jsx';
import { useProgressInsights } from '@/hooks/useProgressInsights.js';

const InsightsPage = () => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const navigate = useNavigate();
  const { data: progressInsights, isLoading, isError } = useProgressInsights();

  return (
    <>
      <Helmet>
        <title>Progress Insights - QuizMaster</title>
        <meta
          name="description"
          content="Track strengths, weaknesses, and progress trends across all your quiz attempts."
        />
      </Helmet>

      <div className="min-h-screen">
        <Navbar onOpenSettings={() => setIsSettingsOpen(true)} />
        <SettingsModal open={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-12">
          <div className="mb-6 md:mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2 dark:text-white">
              Progress Insights
            </h1>
            <p className="text-sm md:text-base text-slate-600 dark:text-slate-400">
              See long-term strengths, weaknesses, and your latest improvements across quizzes.
            </p>
          </div>

          {isError ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
              Failed to load progress insights. Please try again later.
            </div>
          ) : (
            <ProgressInsightsCard progressInsights={progressInsights} loading={isLoading} />
          )}

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
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

export default InsightsPage;
