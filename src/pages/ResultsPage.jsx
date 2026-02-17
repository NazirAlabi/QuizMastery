import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import Navbar from '@/components/layout/Navbar.jsx';
import ResultsDashboard from '@/components/results/ResultsDashboard.jsx';
import ReviewPanel from '@/components/review/ReviewPanel.jsx';
import DiscussionThread from '@/components/discussion/DiscussionThread.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx';
import { Button } from '@/components/ui/button.jsx';
import { getResults } from '@/api/api.js';
import { useToast } from '@/components/ui/use-toast.jsx';
import { useAuth } from '@/hooks/useAuth.js';

const ResultsPage = () => {
  const { attemptId } = useParams();
  const [results, setResults] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('results');
  const [selectedQuestionId, setSelectedQuestionId] = useState(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isDevFeaturesEnabled } = useAuth();

  useEffect(() => {
    loadResults();
  }, [attemptId]);

  const loadResults = async () => {
    try {
      const data = await getResults(attemptId);
      setResults(data);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load results',
        variant: 'destructive'
      });
      navigate('/quizzes');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReviewAnswers = () => {
    setActiveTab('review');
    window.scrollTo(0, 0);
  };

  const handleReturnToQuizzes = () => {
    navigate('/quizzes');
  };

  const handleShowDiscussion = (questionId) => {
    setSelectedQuestionId(questionId);
    setActiveTab('discussion');
    window.scrollTo(0, 0);
  };

  if (isLoading) {
    return (
      <>
        <Helmet>
          <title>Loading Results - QuizMaster</title>
        </Helmet>
        <div className="min-h-screen">
          <Navbar />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto dark:border-indigo-400"></div>
              <p className="mt-4 text-slate-600 dark:text-slate-400">Loading results...</p>
            </div>
          </div>
        </div>
      </>
    );
  }

  const answers = results.answers || [];

  return (
    <>
      <Helmet>
        <title>{`Results (${results.score}%) - QuizMaster`}</title>
        <meta name="description" content={`Quiz results: ${results.score}% score with detailed analysis`} />
      </Helmet>

      <div className="min-h-screen">
        <Navbar />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-12">
          <div className="mb-6 md:mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2 dark:text-white">Quiz Results</h1>
            <p className="text-sm md:text-base text-slate-600 dark:text-slate-400">Review your performance and learn from your answers</p>
          </div>

          {isDevFeaturesEnabled && (
            <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">Developer Summary</p>
              <p className="text-xs font-mono text-amber-800 mt-1 dark:text-amber-300">
                attemptId={results.attemptId} | quizId={results.quizId} | correct={results.correctAnswers}/{results.totalQuestions}
              </p>
            </div>
          )}

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="mb-6 w-full flex h-auto p-1 bg-slate-100 rounded-lg overflow-x-auto dark:bg-slate-800">
              <TabsTrigger value="results" className="flex-1 min-w-[100px] py-2">Results</TabsTrigger>
              <TabsTrigger value="review" className="flex-1 min-w-[100px] py-2">Review</TabsTrigger>
              <TabsTrigger value="discussion" className="flex-1 min-w-[100px] py-2">Discussion</TabsTrigger>
            </TabsList>

            <TabsContent value="results" className="mt-0">
              <ResultsDashboard
                results={results}
                onReviewAnswers={handleReviewAnswers}
                onReturnToQuizzes={handleReturnToQuizzes}
              />
            </TabsContent>

            <TabsContent value="review" className="mt-0">
              <ReviewPanel
                quizId={results.quizId}
                answers={answers}
                onShowDiscussion={handleShowDiscussion}
              />
            </TabsContent>

            <TabsContent value="discussion" className="mt-0">
              {selectedQuestionId ? (
                <DiscussionThread questionId={selectedQuestionId} />
              ) : (
                <div className="text-center py-12 text-slate-500 bg-slate-100 rounded-lg border border-slate-300 p-6 dark:bg-slate-950 dark:border-slate-800 dark:text-slate-400">
                  <p className="text-base">Select a question from the review tab to view its discussion</p>
                  <Button 
                    variant="link" 
                    onClick={() => setActiveTab('review')}
                    className="mt-2 text-indigo-600 dark:text-indigo-400"
                  >
                    Go to Review
                  </Button>
                </div>
              )}
            </TabsContent>
          </Tabs>

          {isDevFeaturesEnabled && (
            <pre className="mt-6 p-4 rounded-lg border border-slate-300 bg-slate-100 text-xs overflow-x-auto dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
              {JSON.stringify(results, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </>
  );
};

export default ResultsPage;
