import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Input } from '@/components/ui/input.jsx';
import { useToast } from '@/components/ui/use-toast.jsx';
import { useAuth } from '@/hooks/useAuth.js';
import { createFeedbackEntry } from '@/api/api.js';
import {
  FEEDBACK_CATEGORY_OPTIONS,
  FEEDBACK_URGENCY_OPTIONS,
  getFeedbackPreset,
} from '@/config/feedbackPresets.js';
import { getUserFriendlyErrorMessage } from '@/utils/errorHandling.js';

const FeedbackContext = createContext(null);

const DEFAULT_MODAL_STATE = {
  contextKey: 'global',
  contextLabel: '',
  subjectType: '',
  subjectId: '',
  subjectTitle: '',
};

const FeedbackModal = ({ open, modalState, onClose }) => {
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();
  const preset = getFeedbackPreset(modalState.contextKey);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reason, setReason] = useState('');
  const [urgency, setUrgency] = useState('');
  const [category, setCategory] = useState(preset.suggestedCategory || '');
  const [subject, setSubject] = useState('');
  const [details, setDetails] = useState('');

  React.useEffect(() => {
    if (!open) return;
    setReason('');
    setUrgency('');
    setCategory(getFeedbackPreset(modalState.contextKey).suggestedCategory || '');
    setSubject(String(modalState.subjectTitle || '').trim());
    setDetails('');
  }, [modalState.contextKey, modalState.subjectTitle, open]);

  if (!open) return null;

  const handleSubmit = async (event) => {
    event.preventDefault();

    setIsSubmitting(true);
    try {
      await createFeedbackEntry({
        reason: reason || null,
        urgency: urgency || null,
        category: category || null,
        subject: subject.trim() || null,
        details: details.trim() || null,
        contextKey: modalState.contextKey,
        contextLabel: modalState.contextLabel || preset.label,
        subjectType: modalState.subjectType || null,
        subjectId: modalState.subjectId || null,
        sourcePath: window.location.pathname,
        sourceSearch: window.location.search,
        user: isAuthenticated
          ? {
            uid: user?.uid || user?.id || null,
            email: user?.email || null,
            displayName: user?.displayName || null,
            isGuest: Boolean(user?.isGuest),
          }
          : null,
      });

      toast({
        title: 'Feedback sent',
        description: 'Thanks for helping improve QuizMaster.',
      });
      onClose();
    } catch (error) {
      toast({
        title: 'Unable to send feedback',
        description: getUserFriendlyErrorMessage(error, 'Please try again.'),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="mx-auto mt-6 w-full max-w-2xl rounded-xl border border-slate-300 bg-slate-100 shadow-2xl dark:border-slate-800 dark:bg-slate-950">
        <div className="flex items-center justify-between border-b border-slate-300 px-4 py-3 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Send Feedback</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Context: {modalState.contextLabel || preset.label}
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close feedback form">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-4 md:p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="feedback-reason">Suggested reason (optional)</Label>
              <select
                id="feedback-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
              >
                <option value="">Choose a reason</option>
                {preset.reasons.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="feedback-urgency">Urgency (optional)</Label>
              <select
                id="feedback-urgency"
                value={urgency}
                onChange={(event) => setUrgency(event.target.value)}
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
              >
                <option value="">Select urgency</option>
                {FEEDBACK_URGENCY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="feedback-category">Category (optional)</Label>
              <select
                id="feedback-category"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
              >
                <option value="">Select category</option>
                {FEEDBACK_CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="feedback-subject">Subject (optional)</Label>
              <Input
                id="feedback-subject"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="What is this about?"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="feedback-details">Details (optional)</Label>
            <textarea
              id="feedback-details"
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              rows={5}
              placeholder="Describe the issue, suggestion, or request."
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Sending...' : 'Send Feedback'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const FeedbackProvider = ({ children }) => {
  const [open, setOpen] = useState(false);
  const [modalState, setModalState] = useState(DEFAULT_MODAL_STATE);

  const openFeedback = useCallback((nextState = {}) => {
    setModalState({
      ...DEFAULT_MODAL_STATE,
      ...nextState,
    });
    setOpen(true);
  }, []);

  const closeFeedback = useCallback(() => {
    setOpen(false);
    setModalState(DEFAULT_MODAL_STATE);
  }, []);

  const value = useMemo(
    () => ({
      openFeedback,
      closeFeedback,
      isOpen: open,
    }),
    [closeFeedback, open, openFeedback]
  );

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <FeedbackModal open={open} modalState={modalState} onClose={closeFeedback} />
    </FeedbackContext.Provider>
  );
};

export const useFeedback = () => {
  const context = useContext(FeedbackContext);
  if (!context) {
    throw new Error('useFeedback must be used within a FeedbackProvider');
  }
  return context;
};
