import React from 'react';
import { createPortal } from 'react-dom';
import { MessageSquareText } from 'lucide-react';
import { useFeedback } from '@/context/FeedbackContext.jsx';

const FeedbackLauncher = () => {
  const { openFeedback } = useFeedback();

  const launcher = (
    <div
      className="fixed left-4 z-[60] md:left-6"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}
    >
      <button
        type="button"
        onClick={() =>
          openFeedback({
            contextKey: 'global',
            contextLabel: 'General Feedback',
          })
        }
        className="inline-flex items-center gap-2 rounded-full border border-slate-300/80 bg-slate-100/95 px-3 py-2 text-sm font-medium text-slate-700 shadow-md transition hover:bg-slate-200/95 dark:border-slate-700/80 dark:bg-slate-900/95 dark:text-slate-100 dark:hover:bg-slate-800/95"
        title="Share feedback"
        aria-label="Share feedback"
      >
        <MessageSquareText className="h-4 w-4" />
        <span className="hidden sm:inline">Feedback</span>
      </button>
    </div>
  );

  if (typeof document === 'undefined') {
    return launcher;
  }

  return createPortal(launcher, document.body);
};

export default FeedbackLauncher;
