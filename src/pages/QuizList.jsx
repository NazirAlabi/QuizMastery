import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import Navbar from '@/components/layout/Navbar.jsx';
import SettingsModal from '@/components/layout/SettingsModal.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Input } from '@/components/ui/input.jsx';
import { getQuizzes, startAttempt } from '@/api/api.js';
import { useAuth } from '@/hooks/useAuth.js';
import { Clock, BookOpen, Play, Search, X } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast.jsx';

const QuizList = () => {
  const [quizzes, setQuizzes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [startingQuiz, setStartingQuiz] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const { user, isDevFeaturesEnabled } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const filteredQuizzes = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();
    if (!normalizedSearch) return quizzes;

    return quizzes.filter((quiz) => {
      const haystack = [
        quiz.title,
        quiz.description,
        quiz.topic,
        quiz.difficulty,
        quiz.id,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [quizzes, searchQuery]);

  useEffect(() => {
    loadQuizzes();
  }, []);

  const loadQuizzes = async () => {
    try {
      const data = await getQuizzes();
      setQuizzes(data);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load quizzes',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartQuiz = async (quiz) => {
    setStartingQuiz(quiz.id);
    try {
      const attempt = await startAttempt(quiz.id, user.id);
      navigate(`/quiz/${quiz.id}/ready?attemptId=${attempt.id}`, {
        state: {
          quizTitle: quiz.title,
          questionCount: quiz.questionCount,
          estimatedTime: quiz.estimatedTime,
        },
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to start quiz',
        variant: 'destructive'
      });
      setStartingQuiz(null);
    }
  };

  const getDifficultyVariant = (difficulty) => {
    switch (difficulty) {
      case 'beginner':
        return 'success';
      case 'intermediate':
        return 'warning';
      case 'advanced':
        return 'destructive';
      default:
        return 'default';
    }
  };

  if (isLoading) {
    return (
      <>
        <Helmet>
          <title>Quizzes - QuizMaster</title>
          <meta name="description" content="Browse and take quizzes on various computer science topics" />
        </Helmet>
        <div className="min-h-screen">
          <Navbar onOpenSettings={() => setIsSettingsOpen(true)} />
          <SettingsModal open={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto dark:border-indigo-400"></div>
              <p className="mt-4 text-slate-600 dark:text-slate-400">Loading quizzes...</p>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>Quizzes - QuizMaster</title>
        <meta name="description" content="Browse and take quizzes on various computer science topics" />
      </Helmet>

      <div className="min-h-screen">
        <Navbar onOpenSettings={() => setIsSettingsOpen(true)} />
        <SettingsModal open={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

        <div className="max-w-[95%] mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-12">
          <div className="mb-6 md:mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2 dark:text-white">Available Quizzes</h1>
            <p className="text-base md:text-lg text-slate-600 dark:text-slate-400">
              Test your knowledge and track your progress
            </p>
          </div>

          <div className="mb-6">
            <div className="relative max-w-xl">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search quizzes by title, topic, description, or ID"
                className="pl-9 pr-10"
              />
              {searchQuery ? (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
                >
                  <X className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
          </div>

          {isDevFeaturesEnabled && (
            <Card className="mb-6 border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-amber-900 dark:text-amber-200">
                  Developer Features
                </CardTitle>
                <CardDescription className="text-amber-800 dark:text-amber-300">
                  Quiz metadata is visible and start buttons include raw IDs for debugging.
                </CardDescription>
              </CardHeader>
            </Card>
          )}

          <div className="flex flex-wrap gap-4 md:gap-6">
            {filteredQuizzes.map((quiz) => (
              <Card key={quiz.id} className="max-w-md hover:shadow-lg transition-shadow flex flex-col h-full dark:hover:shadow-slate-800/50">
                <CardHeader className="pb-3 min-h-[128px]">
                  <div className="flex items-start justify-between mb-2 gap-2">
                    <CardTitle className="text-lg md:text-xl leading-tight">
                      <Link to={`/quizzes/${quiz.id}`} className="hover:text-indigo-700 dark:hover:text-indigo-300">
                        {quiz.title}
                      </Link>
                    </CardTitle>
                    <Badge variant={getDifficultyVariant(quiz.difficulty)} className="shrink-0">
                      {quiz.difficulty}
                    </Badge>
                  </div>
                  <CardDescription className="text-sm md:text-base line-clamp-2">{quiz.description}</CardDescription>
                </CardHeader>
                <CardContent className="mt-auto flex flex-col pt-0">
                  <div className="space-y-3 mb-4">
                    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                      <BookOpen className="h-4 w-4" />
                      <span>{quiz.questionCount} questions</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                      <Clock className="h-4 w-4" />
                      <span>~{quiz.estimatedTime} minutes</span>
                    </div>
                    <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-300 dark:border-indigo-800">
                      {quiz.topic}
                    </Badge>
                    {isDevFeaturesEnabled && (
                      <div className="text-xs text-slate-500 font-mono dark:text-slate-400">
                        quizId={quiz.id} | timing={quiz.timing?.enabled ? 'timed' : 'untimed'}
                      </div>
                    )}
                  </div>

                  <Button
                    onClick={() => handleStartQuiz(quiz)}
                    disabled={startingQuiz === quiz.id}
                    className={`${isDevFeaturesEnabled ? 'w-full' : 'w-48 self-center'} min-h-[2.75rem] md:min-h-[2.5rem] bg-indigo-600 hover:bg-indigo-700 text-white text-base dark:bg-indigo-500 dark:hover:bg-indigo-600`}
                  >
                    <Play className="h-5 w-5 md:h-4 md:w-4 mr-2 hover:fill-white" />
                    {startingQuiz === quiz.id
                      ? 'Starting...'
                      : isDevFeaturesEnabled
                        ? `Start Quiz (${quiz.id})`
                        : 'Start Quiz'
                    }
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredQuizzes.length === 0 ? (
            <Card className="mt-6">
              <CardContent className="py-8 text-center text-slate-600 dark:text-slate-400">
                No quizzes match your search.
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
};

export default QuizList;
