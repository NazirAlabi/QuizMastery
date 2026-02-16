import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Clock3, Play, ListChecks } from 'lucide-react';
import Navbar from '@/components/layout/Navbar.jsx';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { getQuizById } from '@/api/api.js';

const QuizReady = () => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const attemptId = searchParams.get('attemptId');
  const [countdown, setCountdown] = useState(3);
  const [quizTitle, setQuizTitle] = useState(location.state?.quizTitle || '');
  const questionCount = location.state?.questionCount;
  const estimatedTime = location.state?.estimatedTime;

  const startPath = useMemo(() => `/quiz/${id}?attemptId=${attemptId}`, [id, attemptId]);

  useEffect(() => {
    if (!attemptId) {
      navigate('/quizzes', { replace: true });
    }
  }, [attemptId, navigate]);

  useEffect(() => {
    if (quizTitle || !id) return;

    let isMounted = true;
    getQuizById(id)
      .then((quiz) => {
        if (isMounted) {
          setQuizTitle(quiz?.title || 'Your Quiz');
        }
      })
      .catch(() => {
        if (isMounted) {
          setQuizTitle('Your Quiz');
        }
      });

    return () => {
      isMounted = false;
    };
  }, [id, quizTitle]);

  useEffect(() => {
    if (!attemptId) return;

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
  }, [attemptId, navigate, startPath]);

  const progress = ((3 - countdown) / 3) * 100;

  return (
    <>
      <Helmet>
        <title>{`${quizTitle || 'Quiz'} - Get Ready`}</title>
      </Helmet>

      <div className="min-h-screen">
        <Navbar />

        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-14">
          <Card className="shadow-lg">
            <CardHeader className="text-center space-y-3">
              <CardTitle className="text-2xl md:text-3xl">Get Ready</CardTitle>
              <CardDescription className="text-base md:text-lg">
                {quizTitle || 'Preparing your quiz...'}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6 md:space-y-7">
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
                  onClick={() => navigate(startPath, { replace: true })}
                  className="min-h-[2.75rem] bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-indigo-500 dark:hover:bg-indigo-600"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Start Now
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate('/quizzes')}
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
