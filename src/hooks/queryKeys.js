export const queryKeys = {
  courses: ['courses'],
  course: (courseId) => ['course', String(courseId || '')],
  quizzes: ['quizzes'],
  quiz: (quizId) => ['quiz', String(quizId || '')],
  quizPage: (quizId) => ['quiz-page', String(quizId || '')],
  attemptQuizSession: (attemptId) => ['attempt-quiz-session', String(attemptId || '')],
  results: (attemptId) => ['results', String(attemptId || '')],
  adminContentSnapshot: ['admin-content-snapshot'],
};
