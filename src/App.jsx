import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/hooks/useAuth.js';
import { ThemeProvider } from '@/context/ThemeContext.jsx';
import { Toaster } from '@/components/ui/toaster.jsx';
import WallpaperToggleButton from '@/components/layout/WallpaperToggleButton.jsx';
import SiteFooter from '@/components/layout/SiteFooter.jsx';
const Login = lazy(() => import('@/pages/Login.jsx'));
const Register = lazy(() => import('@/pages/Register.jsx'));
const AuthPrompt = lazy(() => import('@/pages/AuthPrompt.jsx'));
const LandingPage = lazy(() => import('@/pages/LandingPage.jsx'));
const QuizList = lazy(() => import('@/pages/QuizList.jsx'));
const QuizReady = lazy(() => import('@/pages/QuizReady.jsx'));
const QuizPage = lazy(() => import('@/pages/QuizPage.jsx'));
const ResultsPage = lazy(() => import('@/pages/ResultsPage.jsx'));
const ProgressHistoryPage = lazy(() => import('@/pages/ProgressHistoryPage.jsx'));
const CoursesPage = lazy(() => import('@/pages/CoursesPage.jsx'));
const CourseDetailPage = lazy(() => import('@/pages/CourseDetailPage.jsx'));
const QuizDetailPage = lazy(() => import('@/pages/QuizDetailPage.jsx'));
const DevContentDashboard = lazy(() => import('@/pages/DevContentDashboard.jsx'));
const DevUsersDashboard = lazy(() => import('@/pages/DevUsersDashboard.jsx'));

const PageFallback = () => (
  <div className="min-h-screen flex items-center justify-center px-4">
    <div className="text-center">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto dark:border-indigo-400" />
      <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">Loading page...</p>
    </div>
  </div>
);

const renderRoute = (element) => <Suspense fallback={<PageFallback />}>{element}</Suspense>;

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <Routes>
            <Route path="/" element={renderRoute(<LandingPage />)} />
            <Route path="/auth-prompt" element={renderRoute(<AuthPrompt />)} />
            <Route path="/login" element={renderRoute(<Login />)} />
            <Route path="/register" element={renderRoute(<Register />)} />
            
            <Route
              path="/quizzes"
              element={renderRoute(<QuizList />)}
            />

            <Route
              path="/courses"
              element={renderRoute(<CoursesPage />)}
            />

            <Route
              path="/courses/:id"
              element={renderRoute(<CourseDetailPage />)}
            />

            <Route
              path="/quizzes/:id"
              element={renderRoute(<QuizDetailPage />)}
            />

            <Route
              path="/dev/content"
              element={renderRoute(<DevContentDashboard />)}
            />

            <Route
              path="/dev/users"
              element={renderRoute(<DevUsersDashboard />)}
            />
            
            <Route
              path="/quiz/:id/ready"
              element={renderRoute(<QuizReady />)}
            />

            <Route
              path="/quiz/:id"
              element={renderRoute(<QuizPage />)}
            />
            
            <Route
              path="/results/:attemptId"
              element={renderRoute(<ResultsPage />)}
            />

            <Route
              path="/insights"
              element={renderRoute(<ProgressHistoryPage />)}
            />
            
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <SiteFooter />
          <WallpaperToggleButton />
          <Toaster />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
