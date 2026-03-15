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
  const skillSummary = Array.isArray(progressInsights?.skillSummary)
    ? progressInsights.skillSummary
    : [];
  const difficultySummary = Array.isArray(progressInsights?.difficultySummary)
    ? progressInsights.difficultySummary
    : [];

  const totalSubmittedAttempts = Number(progressInsights?.totalSubmittedAttempts || 0);
  const hasProgressData =
    totalSubmittedAttempts >= 1 && (questionTopicSummary.length > 0 || quizTopicSummary.length > 0);
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
              Performance Insights
            </CardTitle>
            <CardDescription>
              Analysis of strengths and growth across topics, difficulty levels, and skills
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
        <CardContent className="space-y-8">
          {loading ? (
            <p className="text-sm text-slate-600 dark:text-slate-400">Loading insights...</p>
          ) : !hasProgressData ? (
            <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-sm text-slate-600 dark:border-slate-800 dark:text-slate-400">
              Submit at least one quiz to see detailed performance insights.
            </div>
          ) : (
            <>
              {/* Topic-based Insights */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    Topic Mastery
                  </p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                      Top Performant Topics
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
                        <p className="text-xs text-slate-500 dark:text-slate-400">Not enough data.</p>
                      )}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                      Growth Opportunities
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
                        <p className="text-xs text-slate-500 dark:text-slate-400">Not enough data.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="h-px bg-slate-200 dark:bg-slate-800" />

              {/* Skill & Difficulty Aggregation Grid */}
              <div className="grid gap-6 md:grid-cols-2">
                {/* Skill Summary */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                    <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
                      Skill Breakdown
                    </p>
                  </div>
                  <div className="space-y-3">
                    {skillSummary.length > 0 ? (
                      skillSummary.map((skill) => (
                        <div key={skill.topic} className="space-y-1.5">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-700 capitalize dark:text-slate-300">{skill.topic}</span>
                            <span className="font-bold text-slate-900 dark:text-slate-100">
                              {skill.overallAccuracy}%
                            </span>
                          </div>
                          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden dark:bg-slate-800">
                            <div 
                              className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                              style={{ width: `${skill.overallAccuracy}%` }}
                            />
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-500 dark:text-slate-400">Skill data not yet available.</p>
                    )}
                  </div>
                </div>

                {/* Difficulty Summary */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                    <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
                      Difficulty Performance
                    </p>
                  </div>
                  <div className="space-y-3">
                    {difficultySummary.length > 0 ? (
                      difficultySummary.map((diff) => (
                        <div key={diff.topic} className="space-y-1.5">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-700 capitalize dark:text-slate-300">{diff.topic}</span>
                            <span className="font-bold text-slate-900 dark:text-slate-100">
                              {diff.overallAccuracy}%
                            </span>
                          </div>
                          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden dark:bg-slate-800">
                            <div 
                              className={cn(
                                "h-full rounded-full transition-all duration-500",
                                diff.topic.toLowerCase() === 'easy' ? "bg-green-500" :
                                diff.topic.toLowerCase() === 'medium' ? "bg-amber-500" : "bg-rose-500"
                              )}
                              style={{ width: `${diff.overallAccuracy}%` }}
                            />
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-500 dark:text-slate-400">Difficulty data not yet available.</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Recent Topic Changes */}
              <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                <p className="text-sm font-semibold text-slate-800 mb-3 dark:text-slate-200">
                  Recent Topic Trends
                </p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {recentQuestionChanges.length > 0 ? (
                    recentQuestionChanges.map((entry) => (
                      <div key={entry.topic} className="flex items-center justify-between p-2 rounded bg-white border border-slate-100 dark:bg-slate-950 dark:border-slate-800">
                        <span className="text-xs font-medium text-slate-700 truncate mr-2 dark:text-slate-300">{entry.topic}</span>
                        <div className={`flex items-center gap-1 text-xs font-bold ${getDeltaStyle(entry.delta)}`}>
                          {renderDeltaIcon(entry.delta)}
                          <span>{formatDelta(entry.delta)}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-500 dark:text-slate-400 italic">Continue taking quizzes to see your growth trends.</p>
                  )}
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
