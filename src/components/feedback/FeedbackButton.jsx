import React from 'react';
import { MessageSquareText } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { useFeedback } from '@/context/FeedbackContext.jsx';

const FeedbackButton = ({
  contextKey = 'global',
  contextLabel = '',
  subjectType = '',
  subjectId = '',
  subjectTitle = '',
  label = 'Feedback',
  variant = 'outline',
  className = '',
  size = 'sm',
}) => {
  const { openFeedback } = useFeedback();

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      className={className}
      onClick={() =>
        openFeedback({
          contextKey,
          contextLabel,
          subjectType,
          subjectId,
          subjectTitle,
        })
      }
    >
      <MessageSquareText className="h-4 w-4 mr-2" />
      {label}
    </Button>
  );
};

export default FeedbackButton;
