import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Clock3, Play, ListChecks, Gauge, PauseCircle } from 'lucide-react';
import Navbar from '@/components/layout/Navbar.jsx';
import SettingsModal from '@/components/layout/SettingsModal.jsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { useToast } from '@/components/ui/use-toast.jsx';
import { useQuiz } from '@/hooks/useQuiz.js';
import { useConfigureAttempt } from '@/hooks/useConfigureAttempt.js';
import { getUserFriendlyErrorMessage } from '@/utils/errorHandling.js';

const SPEED_OPTIONS = [
  { label: '0.5x', value: 0.5 },
  { label: '0.75x', value: 0.75 },
  { label: '1x', value: 1 },
  { label: '1.25x', value: 1.25 },
  { label: '1.5x', value: 1.5 },
];

const formatDuration = (seconds) => {
  if (!Number.isFinite(Number(seconds)) || Number(seconds) < 0) return 'n/a';
  const minutes = Math.floor(Number(seconds) / 60);
  const remainingSeconds = Number(seconds) % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
};

const QuizReady = () => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const attemptId = searchParams.get('attemptId');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [quizTitle, setQuizTitle] = useState(location.state?.quizTitle || '');
  const [questionCount, setQuestionCount] = useState(location.state?.questionCount ?? null);
  const [estimatedTime, setEstimatedTime] = useState(location.state?.estimatedTime ?? null);
  const [mode, setMode] = useState('timed');
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const [allowBreaks, setAllowBreaks] = useState(false);
  const [isCountdownActive, setIsCountdownActive] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const { toast } = useToast();
  const shouldFetchQuiz =
    Boolean(id) && (!quizTitle || questionCount == null || estimatedTime == null);
  const { data: fetchedQuiz } = useQuiz(id, { enabled: shouldFetchQuiz });
  const configureAttemptMutation = useConfigureAttempt();

  const startPath = useMemo(() => `/quiz/${id}?attemptId=${attemptId}`, [id, attemptId]);
  const baseDurationSeconds = useMemo(() => {
    if (!Number.isFinite(Number(estimatedTime)) || Number(estimatedTime) <= 0) return null;
    return Math.max(1, Math.round(Number(estimatedTime) * 60));
  }, [estimatedTime]);
  const effectiveDurationSeconds = useMemo(() => {
    if (mode === 'untimed') return null;
    if (!Number.isFinite(Number(baseDurationSeconds))) return null;
    return Math.max(1, Math.round(Number(baseDurationSeconds) / Number(speedMultiplier)));
  }, [baseDurationSeconds, mode, speedMultiplier]);

  useEffect(() => {
    if (!attemptId) {
      navigate('/quizzes', { replace: true });
    }
  }, [attemptId, navigate]);

  useEffect(() => {
    if (!shouldFetchQuiz) return;
    if (!fetchedQuiz) return;

    if (!quizTitle) {
      setQuizTitle(fetchedQuiz?.title || 'Your Quiz');
    }
    if (questionCount == null) {
      setQuestionCount(Number(fetchedQuiz?.questionCount || 0));
    }
    if (estimatedTime == null) {
      setEstimatedTime(Number(fetchedQuiz?.estimatedTime || 0));
    }
  }, [estimatedTime, fetchedQuiz, questionCount, quizTitle, shouldFetchQuiz]);

  useEffect(() => {
    if (!attemptId || !isCountdownActive) return;

    const timer = window.setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          navigate(startPath, { replace: true });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [attemptId, isCountdownActive, navigate, startPath]);

  const progress = isCountdownActive ? ((3 - countdown) / 3) * 100 : 0;
  const isInteractionLocked = isCountdownActive;

  const handleProceed = () => {
    if (!attemptId) return;
    if (isCountdownActive) return;

    setCountdown(3);
    setIsCountdownActive(true);

    configureAttemptMutation.mutate(
      {
        attemptId,
        mode,
        speedMultiplier,
        allowBreaks,
      },
      {
        onError: (error) => {
          toast({
            title: 'Warning',
            description: getUserFriendlyErrorMessage(error, 'Attempt setup was slow. Applying defaults.'),
            variant: 'destructive',
          });
        },
      }
    );
  };

  return (
    <>
      <Helmet>
        <title>{`${quizTitle || 'Quiz'} - Get Ready`}</title>
      </Helmet>

      <div className="min-h-screen">
        <Navbar onOpenSettings={() => setIsSettingsOpen(true)} />
        <SettingsModal open={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-14">
          <Card className="shadow-lg">
            <CardHeader className="text-center space-y-3">
              <CardTitle className="text-2xl md:text-3xl">Get Ready</CardTitle>
              <CardDescription className="text-base md:text-lg">
                {quizTitle || 'Preparing your quiz setup...'}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6 md:space-y-7">
              {isCountdownActive ? (
                <>
                  <div className="rounded-xl border border-slate-300/70 bg-slate-100/70 backdrop-blur-sm p-5 text-center dark:border-slate-700/70 dark:bg-slate-900/55">
                    <p className="text-sm text-slate-600 dark:text-slate-400">Starting in</p>
                    <p className="text-5xl font-bold text-indigo-700 dark:text-indigo-300 mt-1">{countdown}</p>
                  </div>

                  <div className="h-2 rounded-full bg-slate-300/70 overflow-hidden dark:bg-slate-800">
                    <div
                      className="h-full bg-indigo-600 transition-all duration-500 dark:bg-indigo-400"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </>
              ) : (
                <div className="space-y-5">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Timing mode</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant={mode === 'timed' ? 'default' : 'outline'}
                        onClick={() => setMode('timed')}
                        disabled={isInteractionLocked}
                        className="min-h-[2.75rem]"
                      >
                        <Gauge className="h-4 w-4 mr-2" />
                        Timed
                      </Button>
                      <Button
                        type="button"
                        variant={mode === 'untimed' ? 'default' : 'outline'}
                        onClick={() => setMode('untimed')}
                        disabled={isInteractionLocked}
                        className="min-h-[2.75rem]"
                      >
                        <Clock3 className="h-4 w-4 mr-2" />
                        Untimed
                      </Button>
                    </div>
                  </div>

                  {mode === 'timed' ? (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Quiz speed</p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {SPEED_OPTIONS.map((option) => (
                          <Button
                            key={option.value}
                            type="button"
                            variant={speedMultiplier === option.value ? 'default' : 'outline'}
                            onClick={() => setSpeedMultiplier(option.value)}
                            disabled={isInteractionLocked}
                          >
                            {option.label}
                          </Button>
                        ))}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Estimated time for this run: {formatDuration(effectiveDurationSeconds)}
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Timer will count up from 00:00 so you can track total time spent.
                    </p>
                  )}

                  <div className="space-y-2">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Breaks</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant={allowBreaks ? 'default' : 'outline'}
                        onClick={() => setAllowBreaks(true)}
                        disabled={isInteractionLocked}
                      >
                        <PauseCircle className="h-4 w-4 mr-2" />
                        Breaks allowed
                      </Button>
                      <Button
                        type="button"
                        variant={!allowBreaks ? 'default' : 'outline'}
                        onClick={() => setAllowBreaks(false)}
                        disabled={isInteractionLocked}
                      >
                        No breaks
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-center gap-3 rounded-lg border border-slate-300/70 bg-slate-100/60 backdrop-blur-sm p-3 dark:border-slate-700/70 dark:bg-slate-900/55">
                  <ListChecks className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  <span className="text-sm text-slate-700 dark:text-slate-300">
                    {questionCount ? `${questionCount} questions` : 'Question set ready'}
                  </span>
                </div>
                <div className="flex items-center gap-3 rounded-lg border border-slate-300/70 bg-slate-100/60 backdrop-blur-sm p-3 dark:border-slate-700/70 dark:bg-slate-900/55">
                  <Clock3 className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  <span className="text-sm text-slate-700 dark:text-slate-300">
                    {estimatedTime ? `~${estimatedTime} min estimated` : 'Timer options coming soon'}
                  </span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 sm:justify-center">
                <Button
                  variant="default"
                  onClick={handleProceed}
                  disabled={isInteractionLocked}
                  className="min-h-[2.75rem] bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-indigo-500 dark:hover:bg-indigo-600"
                >
                  <Play className="h-4 w-4 mr-2" />
                  {isCountdownActive ? 'Starting...' : 'Proceed'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate('/quizzes')}
                  disabled={isInteractionLocked}
                  className="min-h-[2.75rem]"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
};

export default QuizReady;
