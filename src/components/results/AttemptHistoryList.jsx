import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { 
  ChevronDown, 
  ChevronUp,
  ChevronRight, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  XCircle, 
  BrainCircuit,
  Target,
  BarChart3
} from 'lucide-react';
import { cn } from '@/lib/utils';

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  
  // If it's a Firestore timestamp {seconds, nanoseconds}
  let date;
  if (dateValue && typeof dateValue === 'object' && 'seconds' in dateValue) {
    date = new Date(dateValue.seconds * 1000);
  } else {
    date = new Date(dateValue);
  }

  if (isNaN(date.getTime())) return String(dateValue);

  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: true,
    }).format(date);
  } catch (e) {
    return String(dateValue);
  }
};

const formatDuration = (seconds) => {
  if (!seconds) return '0s';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
};

const DistributionBar = ({ label, correct, total, colorClass }) => {
  const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs font-medium">
        <span className="text-slate-600 dark:text-slate-400 capitalize">{label}</span>
        <span className="text-slate-900 dark:text-slate-200">{percentage}%</span>
      </div>
      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden dark:bg-slate-800">
        <div 
          className={cn("h-full transition-all duration-500", colorClass)} 
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

const AttemptHistoryList = ({ attempts = [], loading }) => {
  const navigate = useNavigate();
  const [expandedId, setExpandedId] = useState(null);

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 w-full bg-slate-100 animate-pulse rounded-lg dark:bg-slate-800" />
        ))}
      </div>
    );
  }

  if (!Array.isArray(attempts) || attempts.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center">
          <BrainCircuit className="h-12 w-12 text-slate-300 mx-auto mb-4 dark:text-slate-700" />
          <p className="text-slate-600 dark:text-slate-400">You haven't taken any quizzes yet.</p>
          <Button 
            className="mt-4" 
            onClick={() => navigate('/quizzes')}
          >
            Start your first quiz
          </Button>
        </CardContent>
      </Card>
    );
  }

  const getStatusBadge = (status, score) => {
    switch (status) {
      case 'submitted':
        return (
          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            {score}%
          </Badge>
        );
      case 'abandoned':
        return (
          <Badge variant="outline" className="text-rose-500 border-rose-200 bg-rose-50 dark:text-rose-400 dark:border-rose-900/40 dark:bg-rose-950/20">
            <AlertCircle className="h-3 w-3 mr-1" />
            Abandoned
          </Badge>
        );
      case 'in_progress':
        return (
          <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50 dark:text-amber-400 dark:border-amber-900/40 dark:bg-amber-950/20">
            <Clock className="h-3 w-3 mr-1" />
            In Progress
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-3">
      {attempts.map((attempt) => {
        const isExpanded = expandedId === attempt.id;
        const analysis = attempt.analysis;
        const wrongPercentage = analysis ? Math.round(((analysis.totalQuestions - analysis.correctAnswers) / analysis.totalQuestions) * 100) : null;
        
        // Time calculations
        const config = attempt.attemptConfig || {};
        const timeSpent = attempt.timeSpentSeconds || 0;
        const allocated = config.effectiveDurationSeconds || config.baseDurationSeconds || null;
        const multiplier = config.speedMultiplier || 1;

        return (
          <Card 
            key={attempt.id} 
            className={cn(
              "overflow-hidden transition-all duration-200 border-slate-200 dark:border-slate-800",
              isExpanded ? "ring-2 ring-indigo-500/20 shadow-md border-indigo-200 dark:border-indigo-900/50" : "hover:border-slate-300 dark:hover:border-slate-700"
            )}
          >
            <div 
              className="p-4 sm:p-5 flex items-center justify-between gap-4 cursor-pointer select-none"
              onClick={() => toggleExpand(attempt.id)}
            >
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-slate-900 truncate dark:text-white">
                  {attempt.quizTitle}
                </h3>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                  <span className="text-xs text-slate-500 flex items-center dark:text-slate-400">
                    <Clock className="h-3 w-3 mr-1.5" />
                    {formatDate(attempt.startedAt)}
                  </span>
                  {getStatusBadge(attempt.status, attempt.score)}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isExpanded ? (
                  <ChevronUp className="h-5 w-5 text-slate-400" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-slate-400" />
                )}
              </div>
            </div>

            {isExpanded && (
              <div className="px-4 pb-5 sm:px-5 sm:pb-6 border-t border-slate-100 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-900/20">
                {attempt.status === 'submitted' && analysis ? (
                  <div className="pt-5 space-y-6">
                    {/* Top Stats */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-white p-3 rounded-lg border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
                        <p className="text-[10px] font-bold text-rose-500 uppercase tracking-wider mb-1">Wrong Answers</p>
                        <div className="flex items-baseline gap-1">
                          <span className="text-xl font-bold dark:text-white">{wrongPercentage}%</span>
                          <XCircle className="h-3.5 w-3.5 text-rose-500" />
                        </div>
                      </div>
                      <div className="bg-white p-3 rounded-lg border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
                        <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider mb-1">Time Spent</p>
                        <div className="flex items-baseline gap-1">
                          <span className="text-xl font-bold dark:text-white">{timeSpent === 0 ? 'N/A' : formatDuration(timeSpent)}</span>
                        </div>
                      </div>
                      <div className="bg-white p-3 rounded-lg border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
                        <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider mb-1">Allocated</p>
                        <div className="flex items-baseline gap-1">
                          <span className="text-xl font-bold dark:text-white">{allocated ? formatDuration(allocated) : '∞'}</span>
                        </div>
                      </div>
                      <div className="bg-white p-3 rounded-lg border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
                        <p className="text-[10px] font-bold text-amber-500 uppercase tracking-wider mb-1">Multiplier</p>
                        <div className="flex items-baseline gap-1">
                          <span className="text-xl font-bold dark:text-white">{multiplier}x</span>
                        </div>
                      </div>
                    </div>

                    {/* Distributions */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {/* Topic Distribution */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                          <Target className="h-4 w-4 text-indigo-500" />
                          Topics
                        </div>
                        <div className="space-y-3">
                          {Array.isArray(analysis?.questionTopicBreakdown) && analysis.questionTopicBreakdown.length > 0 ? (
                            analysis.questionTopicBreakdown.slice(0, 3).map((topic) => (
                              <DistributionBar 
                                key={topic.topic} 
                                label={topic.topic} 
                                correct={topic.correct} 
                                total={topic.total} 
                                colorClass="bg-indigo-500"
                              />
                            ))
                          ) : (
                            <p className="text-xs text-slate-500 italic">No topic data available.</p>
                          )}
                        </div>
                      </div>

                      {/* Skill Distribution */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                          <BarChart3 className="h-4 w-4 text-emerald-500" />
                          Skills
                        </div>
                        <div className="space-y-3">
                          {analysis?.skillBreakdown && Object.keys(analysis.skillBreakdown).length > 0 ? (
                            Object.entries(analysis.skillBreakdown).map(([skill, stats]) => (
                              <DistributionBar 
                                key={skill} 
                                label={skill} 
                                correct={stats.correct} 
                                total={stats.total} 
                                colorClass="bg-emerald-500"
                              />
                            ))
                          ) : (
                            <p className="text-xs text-slate-500 italic">No skill data available.</p>
                          )}
                        </div>
                      </div>

                      {/* Difficulty Distribution */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                          <BarChart3 className="h-4 w-4 text-amber-500" />
                          Difficulty
                        </div>
                        <div className="space-y-3">
                          {analysis?.difficultyBreakdown && Object.keys(analysis.difficultyBreakdown).length > 0 ? (
                            Object.entries(analysis.difficultyBreakdown).map(([diff, stats]) => (
                              <DistributionBar 
                                key={diff} 
                                label={diff} 
                                correct={stats.correct} 
                                total={stats.total} 
                                colorClass="bg-amber-500"
                              />
                            ))
                          ) : (
                            <p className="text-xs text-slate-500 italic">No difficulty data available.</p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 flex justify-end">
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/results/${attempt.id}`);
                        }}
                      >
                        View Full Review Page
                        <ChevronRight className="ml-1 h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="pt-5 text-center py-6">
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                      {attempt.status === 'in_progress' ? "This quiz is still active." : "This attempt was closed without submission."}
                    </p>
                    <Button 
                      size="sm" 
                      onClick={(e) => {
                        e.stopPropagation();
                        if (attempt.status === 'in_progress') {
                          navigate(`/quiz/${attempt.quizId}`);
                        } else {
                          navigate(`/results/${attempt.id}`);
                        }
                      }}
                    >
                      {attempt.status === 'in_progress' ? "Continue Quiz" : "View Results"}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
};

export default AttemptHistoryList;
