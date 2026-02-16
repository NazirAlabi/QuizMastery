import React from 'react';
import QuestionCard from '@/components/quiz/QuestionCard.jsx';
import { Button } from '@/components/ui/button.jsx';
import { MessageSquare } from 'lucide-react';

const AllQuestionsView = ({ questions, answers, onShowDiscussion }) => {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {questions.map((question, index) => {
        const answer = answers.find(a => a.questionId === question.id);
        return (
          <div key={question.id} className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span className="bg-slate-100 text-slate-600 text-sm py-1 px-2 rounded-md dark:bg-slate-800 dark:text-slate-400">
                  #{index + 1}
                </span>
                <span className="text-sm font-normal text-slate-500 dark:text-slate-400">
                  {question.topic}
                </span>
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onShowDiscussion(question.id)}
                className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:text-indigo-300 dark:hover:bg-indigo-950/30 self-start sm:self-auto"
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Discussion
              </Button>
            </div>
            
            <QuestionCard
              question={question}
              selectedAnswer={answer?.selectedAnswer}
              onSelectOption={() => {}}
              showResult={true}
            />
            
            <div className="w-full h-px bg-slate-200 dark:bg-slate-800 my-4 last:hidden" />
          </div>
        );
      })}
    </div>
  );
};

export default AllQuestionsView;