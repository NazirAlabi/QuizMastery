export const queryKeys = {
  courses: ['courses'],
  course: (courseId) => ['course', String(courseId || '')],
  quizzes: ['quizzes'],
  quiz: (quizId) => ['quiz', String(quizId || '')],
  quizPage: (quizId) => ['quiz-page', String(quizId || '')],
  attemptQuizSession: (attemptId) => ['attempt-quiz-session', String(attemptId || '')],
  results: (attemptId) => ['results', String(attemptId || '')],
  progressInsights: ['progress-insights'],
  adminContentSnapshot: ['admin-content-snapshot'],
  userAttempts: ['user-attempts'],
};
