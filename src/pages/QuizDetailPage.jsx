import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BookOpen, Clock, Play } from 'lucide-react';
import Navbar from '@/components/layout/Navbar.jsx';
import SettingsModal from '@/components/layout/SettingsModal.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { useToast } from '@/components/ui/use-toast.jsx';
import { useAuth } from '@/hooks/useAuth.js';
import { getQuizPageById, startAttempt } from '@/api/api.js';

const buildQuizDescriptionDetail = (quiz, associatedCourses) => {
  const baseDescription = String(quiz?.description || '').trim() || 'No quiz description provided.';
  const courseNames = associatedCourses.map((course) => course.title).join(', ') || 'Unassigned';
  const parts = [
    `Topic: ${quiz?.topic || 'General'}.`,
    `Difficulty: ${quiz?.difficulty || 'intermediate'}.`,
    `Questions: ${quiz?.questionCount || 0}.`,
    `Estimated time: ${quiz?.estimatedTime || 0} minutes.`,
    `Associated courses: ${courseNames}.`,
  ];

  return `${baseDescription} ${parts.join(' ')}`.trim();
};

const QuizDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, isDevFeaturesEnabled } = useAuth();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [quiz, setQuiz] = useState(null);
  const [associatedCourses, setAssociatedCourses] = useState([]);

  useEffect(() => {
    const loadQuizPage = async () => {
      try {
        const pageData = await getQuizPageById(id);
        setQuiz(pageData);
        setAssociatedCourses(pageData.associatedCourses || []);
      } catch {
        toast({
          title: 'Error',
          description: 'Failed to load quiz page.',
          variant: 'destructive',
        });
        navigate('/quizzes');
      } finally {
        setIsLoading(false);
      }
    };

    loadQuizPage();
  }, [id, navigate, toast]);

  const descriptionDetail = useMemo(
    () => buildQuizDescriptionDetail(quiz, associatedCourses),
    [quiz, associatedCourses]
  );
  const questionTypeBreakdown = useMemo(() => {
    const bucket = {};
    (quiz?.questions || []).forEach((question) => {
      const key = String(question?.type || 'unknown');
      bucket[key] = (bucket[key] || 0) + 1;
    });
    return Object.entries(bucket).sort((a, b) => a[0].localeCompare(b[0]));
  }, [quiz]);

  const handleStartQuiz = async () => {
    if (!quiz) return;
    setIsStarting(true);
    try {
      const attempt = await startAttempt(quiz.id, user.id);
      navigate(`/quiz/${quiz.id}/ready?attemptId=${attempt.id}`, {
        state: {
          quizTitle: quiz.title,
          questionCount: quiz.questionCount,
          estimatedTime: quiz.estimatedTime,
        },
      });
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to start quiz',
        variant: 'destructive',
      });
      setIsStarting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <Navbar onOpenSettings={() => setIsSettingsOpen(true)} />
        <SettingsModal open={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto dark:border-indigo-400" />
            <p className="mt-4 text-slate-600 dark:text-slate-400">Loading quiz page...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!quiz) return null;

  return (
    <>
      <Helmet>
        <title>{`${quiz.title} - Quiz Page`}</title>
        <meta name="description" content={descriptionDetail} />
      </Helmet>

      <div className="min-h-screen">
        <Navbar onOpenSettings={() => setIsSettingsOpen(true)} />
        <SettingsModal open={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

        <div className="max-w-[95%] mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-10 space-y-6">
          <div className="space-y-3">
            <Link to="/quizzes" className="text-sm text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300">
              Back to quizzes
            </Link>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white">{quiz.title}</h1>
              <Badge variant="outline">{quiz.difficulty}</Badge>
            </div>
            <p className="text-slate-600 dark:text-slate-300">{descriptionDetail}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="py-5">
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                  <BookOpen className="h-4 w-4" />
                  <span>{quiz.questionCount} questions</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-5">
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                  <Clock className="h-4 w-4" />
                  <span>~{quiz.estimatedTime} minutes</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-5">
                <span className="text-slate-700 dark:text-slate-300">Topic: {quiz.topic}</span>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Associated Courses</CardTitle>
              <CardDescription>Courses that currently include this quiz.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {associatedCourses.length === 0 ? (
                <p className="text-sm text-slate-600 dark:text-slate-400">No course associations yet.</p>
              ) : (
                associatedCourses.map((course) => (
                  <Badge key={course.id} variant="outline" className="gap-2">
                    <Link to={`/courses/${course.id}`} className="hover:text-indigo-700 dark:hover:text-indigo-300">
                      {course.title}
                    </Link>
                  </Badge>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Question Type Breakdown</CardTitle>
              <CardDescription>Distribution of question formats in this quiz.</CardDescription>
            </CardHeader>
            <CardContent>
              {questionTypeBreakdown.length === 0 ? (
                <p className="text-sm text-slate-600 dark:text-slate-400">No questions available.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {questionTypeBreakdown.map(([type, count]) => (
                    <Badge key={type} variant="outline">{type}: {count}</Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleStartQuiz}
              disabled={isStarting}
              className="min-h-[2.75rem] bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-indigo-500 dark:hover:bg-indigo-600"
            >
              <Play className="h-4 w-4 mr-2" />
              {isStarting ? 'Starting...' : 'Start Quiz'}
            </Button>
            <Button asChild variant="outline">
              <Link to="/courses">Browse Courses</Link>
            </Button>
          </div>

          {isDevFeaturesEnabled ? (
            <p className="text-xs font-mono text-slate-500 dark:text-slate-400">quizId={quiz.id}</p>
          ) : null}
        </div>
      </div>
    </>
  );
};

export default QuizDetailPage;
