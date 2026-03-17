export const FEEDBACK_URGENCY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

export const FEEDBACK_CATEGORY_OPTIONS = [
  { value: 'technical', label: 'Technical' },
  { value: 'content', label: 'Content' },
  { value: 'account', label: 'Account' },
  { value: 'request', label: 'Request' },
  { value: 'other', label: 'Other' },
];

const PRESETS = {
  global: {
    label: 'General Feedback',
    reasons: [
      'Report a bug',
      'Suggest an improvement',
      'Ask for a new feature',
      'Share general feedback',
    ],
    suggestedCategory: 'other',
  },
  courses_page: {
    label: 'Courses Page',
    reasons: [
      'Request a new course',
      'Course list looks incorrect',
      'Course information is outdated',
      'Filtering could be better',
    ],
    suggestedCategory: 'content',
  },
  quiz_attempt: {
    label: 'Quiz Attempt',
    reasons: [
      'Question appears incorrect',
      'Timer/attempt behavior issue',
      'Quiz is too easy or too hard',
      'Need clarification on instructions',
    ],
    suggestedCategory: 'technical',
  },
  question_card: {
    label: 'Question',
    reasons: [
      'Possible wrong answer key',
      'Question wording is unclear',
      'Explanation is insufficient',
      'Formatting issue (e.g., LaTeX)',
    ],
    suggestedCategory: 'content',
  },
  quiz_detail: {
    label: 'Quiz Details',
    reasons: [
      'Quiz metadata is inaccurate',
      'Missing prerequisite information',
      'Recommend related resources',
    ],
    suggestedCategory: 'content',
  },
  course_detail: {
    label: 'Course Details',
    reasons: [
      'Course description issue',
      'Missing expected quiz',
      'Need clearer course scope',
    ],
    suggestedCategory: 'content',
  },
};

export const getFeedbackPreset = (contextKey) => {
  const key = String(contextKey || 'global').trim();
  return PRESETS[key] || PRESETS.global;
};
