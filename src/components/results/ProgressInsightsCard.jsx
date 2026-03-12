import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card.jsx';
import { Target, TrendingUp, ArrowUpRight, ArrowDownRight, Minus, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils.js';

const ProgressInsightsCard = ({
  progressInsights,
  loading,
  currentAttemptTopics = [],
  currentQuizTopic = null,
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const questionTopicSummary = Array.isArray(progressInsights?.questionTopicSummary)
    ? progressInsights.questionTopicSummary
    : [];
  const quizTopicSummary = Array.isArray(progressInsights?.quizTopicSummary)
    ? progressInsights.quizTopicSummary
    : [];
  const totalSubmittedAttempts = Number(progressInsights?.totalSubmittedAttempts || 0);
  const hasProgressData =
    totalSubmittedAttempts > 1 && (questionTopicSummary.length > 0 || quizTopicSummary.length > 0);
  const hasCurrentAttempt = currentAttemptTopics.length > 0;

  const formatDelta = (delta) => {
    if (!Number.isFinite(delta)) return '';
    return delta > 0 ? `+${delta}%` : `${delta}%`;
  };

  const getDeltaStyle = (delta) => {
    if (!Number.isFinite(delta)) return 'text-slate-500 dark:text-slate-400';
    if (delta > 0) return 'text-green-600 dark:text-green-400';
    if (delta < 0) return 'text-red-600 dark:text-red-400';
    return 'text-slate-600 dark:text-slate-400';
  };

  const renderDeltaIcon = (delta) => {
    if (!Number.isFinite(delta)) return <Minus className="h-4 w-4" />;
    if (delta > 0) return <ArrowUpRight className="h-4 w-4" />;
    if (delta < 0) return <ArrowDownRight className="h-4 w-4" />;
    return <Minus className="h-4 w-4" />;
  };

  const sortedQuestionTopics = useMemo(
    () => [...questionTopicSummary].sort((a, b) => b.overallAccuracy - a.overallAccuracy),
    [questionTopicSummary]
  );
  const topQuestionTopics = sortedQuestionTopics.slice(0, 3);
  const bottomQuestionTopics = [...sortedQuestionTopics]
    .sort((a, b) => a.overallAccuracy - b.overallAccuracy)
    .slice(0, 3);
  const questionTopicLookup = useMemo(
    () => new Map(questionTopicSummary.map((entry) => [entry.topic, entry])),
    [questionTopicSummary]
  );

  const sortedQuizTopics = useMemo(
    () => [...quizTopicSummary].sort((a, b) => b.overallAccuracy - a.overallAccuracy),
    [quizTopicSummary]
  );
  const topQuizTopics = sortedQuizTopics.slice(0, 3);
  const bottomQuizTopics = [...sortedQuizTopics]
    .sort((a, b) => a.overallAccuracy - b.overallAccuracy)
    .slice(0, 3);
  const quizTopicLookup = useMemo(
    () => new Map(quizTopicSummary.map((entry) => [entry.topic, entry])),
    [quizTopicSummary]
  );
  const currentQuizTrend = currentQuizTopic ? quizTopicLookup.get(currentQuizTopic) : null;

  const recentQuestionChanges = useMemo(
    () =>
      questionTopicSummary
        .filter((entry) => Number.isFinite(entry.delta))
        .sort((a, b) => {
          const aTime = a.lastAttemptAt ? new Date(a.lastAttemptAt).getTime() : 0;
          const bTime = b.lastAttemptAt ? new Date(b.lastAttemptAt).getTime() : 0;
          return bTime - aTime;
        })
        .slice(0, 5),
    [questionTopicSummary]
  );

  const recentQuizChanges = useMemo(
    () =>
      quizTopicSummary
        .filter((entry) => Number.isFinite(entry.delta))
        .sort((a, b) => {
          const aTime = a.lastAttemptAt ? new Date(a.lastAttemptAt).getTime() : 0;
          const bTime = b.lastAttemptAt ? new Date(b.lastAttemptAt).getTime() : 0;
          return bTime - aTime;
        })
        .slice(0, 5),
    [quizTopicSummary]
  );

  return (
    <Card>
      <CardHeader className="pb-4">
        <button
          type="button"
          onClick={() => setIsOpen((previous) => !previous)}
          className="w-full flex items-center justify-between text-left"
        >
          <div>
            <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
              <TrendingUp className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              Progress Insights
            </CardTitle>
            <CardDescription>
              Track strengths, weaknesses, and recent changes across attempts
            </CardDescription>
          </div>
          <ChevronDown
            className={cn(
              'h-5 w-5 text-slate-600 transition-transform dark:text-slate-400',
              isOpen && 'rotate-180'
            )}
          />
        </button>
      </CardHeader>
      {isOpen && (
        <CardContent className="space-y-6">
          {loading ? (
            <p className="text-sm text-slate-600 dark:text-slate-400">Loading progress insights...</p>
          ) : !hasProgressData ? (
            <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-400">
              Complete at least two submitted attempts to see cross-quiz progress insights.
            </div>
          ) : (
            <>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Question Topics (Across Attempts)
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Strongest topics
                  </p>
                  <div className="mt-3 space-y-2">
                    {topQuestionTopics.length > 0 ? (
                      topQuestionTopics.map((entry) => (
                        <div key={entry.topic} className="flex items-center justify-between text-sm">
                          <span className="text-slate-700 dark:text-slate-300">{entry.topic}</span>
                          <span className="font-semibold text-slate-900 dark:text-slate-100">
                            {entry.overallAccuracy}%
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-500 dark:text-slate-400">No topic data yet.</p>
                    )}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Topics to improve
                  </p>
                  <div className="mt-3 space-y-2">
                    {bottomQuestionTopics.length > 0 ? (
                      bottomQuestionTopics.map((entry) => (
                        <div key={entry.topic} className="flex items-center justify-between text-sm">
                          <span className="text-slate-700 dark:text-slate-300">{entry.topic}</span>
                          <span className="font-semibold text-slate-900 dark:text-slate-100">
                            {entry.overallAccuracy}%
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-500 dark:text-slate-400">No topic data yet.</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {hasCurrentAttempt ? 'This attempt vs previous' : 'Recent changes'}
                </p>
                <div className="mt-3 space-y-2">
                  {hasCurrentAttempt ? (
                    currentAttemptTopics.map((topic) => {
                      const summary = questionTopicLookup.get(topic.topic);
                      const delta = Number.isFinite(summary?.delta) ? summary.delta : null;
                      const previousAccuracy = Number.isFinite(summary?.previousAccuracy)
                        ? summary.previousAccuracy
                        : null;

                      return (
                        <div key={topic.topic} className="flex items-center justify-between text-sm">
                          <div>
                            <p className="font-medium text-slate-800 dark:text-slate-200">{topic.topic}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {topic.correct}/{topic.total} ({topic.accuracy}%)
                            </p>
                          </div>
                          <div className="text-right">
                            {previousAccuracy === null ? (
                              <p className="text-xs text-slate-500 dark:text-slate-400">No prior data</p>
                            ) : (
                              <div className={`flex items-center justify-end gap-1 font-semibold ${getDeltaStyle(delta)}`}>
                                {renderDeltaIcon(delta)}
                                <span>{formatDelta(delta)}</span>
                              </div>
                            )}
                            {previousAccuracy !== null && (
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                Prev {previousAccuracy}%
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : recentQuestionChanges.length > 0 ? (
                    recentQuestionChanges.map((entry) => (
                      <div key={entry.topic} className="flex items-center justify-between text-sm">
                        <div>
                          <p className="font-medium text-slate-800 dark:text-slate-200">{entry.topic}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Latest {entry.lastAccuracy ?? 0}% overall
                          </p>
                        </div>
                        <div className={`flex items-center gap-1 font-semibold ${getDeltaStyle(entry.delta)}`}>
                          {renderDeltaIcon(entry.delta)}
                          <span>{formatDelta(entry.delta)}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-500 dark:text-slate-400">No recent topic changes yet.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="h-px bg-slate-200 dark:bg-slate-800" />

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Quiz Topics (Across Attempts)
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Strongest quiz topics
                  </p>
                  <div className="mt-3 space-y-2">
                    {topQuizTopics.length > 0 ? (
                      topQuizTopics.map((entry) => (
                        <div key={entry.topic} className="flex items-center justify-between text-sm">
                          <span className="text-slate-700 dark:text-slate-300">{entry.topic}</span>
                          <span className="font-semibold text-slate-900 dark:text-slate-100">
                            {entry.overallAccuracy}%
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-500 dark:text-slate-400">No quiz topic data yet.</p>
                    )}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Quiz topics to improve
                  </p>
                  <div className="mt-3 space-y-2">
                    {bottomQuizTopics.length > 0 ? (
                      bottomQuizTopics.map((entry) => (
                        <div key={entry.topic} className="flex items-center justify-between text-sm">
                          <span className="text-slate-700 dark:text-slate-300">{entry.topic}</span>
                          <span className="font-semibold text-slate-900 dark:text-slate-100">
                            {entry.overallAccuracy}%
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-500 dark:text-slate-400">No quiz topic data yet.</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {currentQuizTopic ? 'Current quiz topic trend' : 'Recent quiz topic changes'}
                </p>
                <div className="mt-3 text-sm text-slate-700 dark:text-slate-300">
                  {currentQuizTopic ? (
                    currentQuizTrend && Number.isFinite(currentQuizTrend?.previousAccuracy) ? (
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-slate-800 dark:text-slate-200">{currentQuizTopic}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Overall {currentQuizTrend.overallAccuracy}%
                          </p>
                        </div>
                        <div className="text-right">
                          <div className={`flex items-center justify-end gap-1 font-semibold ${getDeltaStyle(currentQuizTrend.delta)}`}>
                            {renderDeltaIcon(currentQuizTrend.delta)}
                            <span>{formatDelta(currentQuizTrend.delta)}</span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Prev {currentQuizTrend.previousAccuracy}%
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        No prior data for {currentQuizTopic} yet.
                      </p>
                    )
                  ) : recentQuizChanges.length > 0 ? (
                    <div className="space-y-2">
                      {recentQuizChanges.map((entry) => (
                        <div key={entry.topic} className="flex items-center justify-between text-sm">
                          <div>
                            <p className="font-medium text-slate-800 dark:text-slate-200">{entry.topic}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Latest {entry.lastAccuracy ?? 0}% overall
                            </p>
                          </div>
                          <div className={`flex items-center gap-1 font-semibold ${getDeltaStyle(entry.delta)}`}>
                            {renderDeltaIcon(entry.delta)}
                            <span>{formatDelta(entry.delta)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 dark:text-slate-400">No recent quiz topic changes yet.</p>
                  )}
                </div>
              </div>
            </div>
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
};

export default React.memo(ProgressInsightsCard);
