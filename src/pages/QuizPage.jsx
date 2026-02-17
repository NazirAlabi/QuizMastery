import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import Navbar from '@/components/layout/Navbar.jsx';
import SettingsModal from '@/components/layout/SettingsModal.jsx';
import QuizRunner from '@/components/quiz/QuizRunner.jsx';
import { getQuizById } from '@/api/api.js';
import { useToast } from '@/components/ui/use-toast.jsx';

const QuizPage = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const attemptId = searchParams.get('attemptId');
  const [quiz, setQuiz] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!attemptId) {
      toast({
        title: 'Error',
        description: 'No attempt ID found',
        variant: 'destructive'
      });
      navigate('/quizzes');
      return;
    }

    loadQuiz();
  }, [id, attemptId]);

  const loadQuiz = async () => {
    try {
      const data = await getQuizById(id);
      setQuiz(data);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load quiz',
        variant: 'destructive'
      });
      navigate('/quizzes');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
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

  return (
    <>
      <Helmet>
        <title>{`${quiz.title} - QuizMaster`}</title>
        <meta name="description" content={quiz.description} />
      </Helmet>

      <div className="min-h-screen">
        <Navbar onOpenSettings={() => setIsSettingsOpen(true)} />
        <SettingsModal open={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900 mb-2 dark:text-white">{quiz.title}</h1>
            <p className="text-slate-600 dark:text-slate-400">{quiz.description}</p>
          </div>

          <QuizRunner quiz={quiz} attemptId={attemptId} />
        </div>
      </div>
    </>
  );
};

export default QuizPage;
