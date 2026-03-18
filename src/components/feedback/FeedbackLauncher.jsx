import React from 'react';
import { MessageSquareText } from 'lucide-react';
import { useFeedback } from '@/context/FeedbackContext.jsx';

const FeedbackLauncher = () => {
  const { openFeedback } = useFeedback();

  return (
    <div className="fixed bottom-4 left-4 z-50 md:bottom-6 md:left-6">
      <button
        type="button"
        onClick={() =>
          openFeedback({
            contextKey: 'global',
            contextLabel: 'General Feedback',
          })
        }
        className="inline-flex items-center gap-2 rounded-full border border-slate-300/80 bg-slate-100/85 px-3 py-2 text-sm font-medium text-slate-700 shadow-md backdrop-blur-sm transition hover:bg-slate-200/90 dark:border-slate-700/80 dark:bg-slate-900/80 dark:text-slate-100 dark:hover:bg-slate-800/90"
        title="Share feedback"
        aria-label="Share feedback"
      >
        <MessageSquareText className="h-4 w-4" />
        <span className="hidden sm:inline">Feedback</span>
      </button>
    </div>
  );
};

export default FeedbackLauncher;
