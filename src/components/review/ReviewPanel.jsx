import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import QuestionCard from '@/components/quiz/QuestionCard.jsx';
import AllQuestionsView from '@/components/review/AllQuestionsView.jsx';
import { getQuestionDetails } from '@/api/api.js';
import { ChevronLeft, ChevronRight, MessageSquare, LayoutList, Square } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast.jsx';

const ReviewPanel = ({ quizId, answers, onShowDiscussion }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [questions, setQuestions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState('single'); // 'single' | 'all'
  const { toast } = useToast();

  useEffect(() => {
    const loadQuestions = async () => {
      try {
        const loadedQuestions = await Promise.all(
          answers.map(answer => getQuestionDetails(quizId, answer.questionId))
        );
        setQuestions(loadedQuestions);
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Failed to load questions',
          variant: 'destructive'
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadQuestions();
  }, [quizId, answers, toast]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto dark:border-indigo-400"></div>
          <p className="mt-4 text-slate-600 dark:text-slate-400">Loading questions...</p>
        </CardContent>
      </Card>
    );
  }

  const currentQuestion = questions[currentIndex];
  const currentAnswer = answers[currentIndex];
  const isFirstQuestion = currentIndex === 0;
  const isLastQuestion = currentIndex === questions.length - 1;

  return (
    <div className="space-y-4 md:space-y-6 pb-8">
      <Card>
        <CardHeader className="p-4 md:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center justify-between w-full sm:w-auto gap-4">
              <CardTitle className="text-lg md:text-xl">
                {viewMode === 'single' 
                  ? `Question ${currentIndex + 1} of ${questions.length}`
                  : `All Questions (${questions.length})`
                }
              </CardTitle>
              
              {viewMode === 'single' && (
                <div className="flex items-center gap-2 sm:hidden">
                  {currentAnswer.isCorrect ? (
                    <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full dark:bg-green-950/30 dark:text-green-400">
                      ✓ Correct
                    </span>
                  ) : (
                    <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded-full dark:bg-red-950/30 dark:text-red-400">
                      ✗ Incorrect
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 self-start sm:self-auto w-full sm:w-auto justify-between sm:justify-end">
              {viewMode === 'single' && (
                <div className="hidden sm:flex items-center gap-2 mr-2">
                  {currentAnswer.isCorrect ? (
                    <span className="text-sm font-medium text-green-600 bg-green-50 px-3 py-1 rounded-full dark:bg-green-950/30 dark:text-green-400">
                      ✓ Correct
                    </span>
                  ) : (
                    <span className="text-sm font-medium text-red-600 bg-red-50 px-3 py-1 rounded-full dark:bg-red-950/30 dark:text-red-400">
                      ✗ Incorrect
                    </span>
                  )}
                </div>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewMode(prev => prev === 'single' ? 'all' : 'single')}
                className="text-slate-700 dark:text-slate-300 ml-auto sm:ml-0"
              >
                {viewMode === 'single' ? (
                  <>
                    <LayoutList className="h-4 w-4 mr-2" />
                    Show All Questions
                  </>
                ) : (
                  <>
                    <Square className="h-4 w-4 mr-2" />
                    Show Question By Question
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {viewMode === 'single' ? (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
          <QuestionCard
            question={currentQuestion}
            selectedAnswer={currentAnswer.selectedAnswer}
            onSelectOption={() => {}}
            showResult={true}
          />

          <div className="flex flex-col md:flex-row items-center justify-between gap-3 md:gap-0 mt-6">
            <div className="flex w-full md:w-auto gap-3 md:gap-0 justify-between order-2 md:order-1">
              <Button
                variant="outline"
                onClick={() => setCurrentIndex(prev => prev - 1)}
                disabled={isFirstQuestion}
                className="flex-1 md:flex-none min-h-[3rem] md:min-h-[2.5rem] text-slate-700 dark:text-slate-300"
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Previous
              </Button>
              
              {/* Mobile Next Button */}
              <Button
                variant="outline"
                onClick={() => setCurrentIndex(prev => prev + 1)}
                disabled={isLastQuestion}
                className="flex-1 md:hidden min-h-[3rem] text-slate-700 dark:text-slate-300"
              >
                Next
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>

            <Button
              variant="outline"
              onClick={() => onShowDiscussion(currentQuestion.id)}
              className="w-full md:w-auto order-1 md:order-2 text-indigo-700 border-indigo-300 hover:bg-indigo-50 min-h-[3rem] md:min-h-[2.5rem] dark:text-indigo-300 dark:border-indigo-700 dark:hover:bg-indigo-950/30"
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              View Discussion
            </Button>

            {/* Desktop Next Button */}
            <Button
              variant="outline"
              onClick={() => setCurrentIndex(prev => prev + 1)}
              disabled={isLastQuestion}
              className="hidden md:flex order-3 text-slate-700 dark:text-slate-300"
            >
              Next
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      ) : (
        <AllQuestionsView 
          questions={questions} 
          answers={answers} 
          onShowDiscussion={onShowDiscussion} 
        />
      )}
    </div>
  );
};

export default ReviewPanel;
