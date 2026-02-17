import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/hooks/useAuth.js';
import { ThemeProvider } from '@/context/ThemeContext.jsx';
import { Toaster } from '@/components/ui/toaster.jsx';
import ProtectedRoute from '@/components/ProtectedRoute.jsx';
import WallpaperToggleButton from '@/components/layout/WallpaperToggleButton.jsx';
import SiteFooter from '@/components/layout/SiteFooter.jsx';
import Login from '@/pages/Login.jsx';
import Register from '@/pages/Register.jsx';
import QuizList from '@/pages/QuizList.jsx';
import QuizReady from '@/pages/QuizReady.jsx';
import QuizPage from '@/pages/QuizPage.jsx';
import ResultsPage from '@/pages/ResultsPage.jsx';

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            
            <Route
              path="/quizzes"
              element={
                <ProtectedRoute>
                  <QuizList />
                </ProtectedRoute>
              }
            />
            
            <Route
              path="/quiz/:id/ready"
              element={
                <ProtectedRoute>
                  <QuizReady />
                </ProtectedRoute>
              }
            />

            <Route
              path="/quiz/:id"
              element={
                <ProtectedRoute>
                  <QuizPage />
                </ProtectedRoute>
              }
            />
            
            <Route
              path="/results/:attemptId"
              element={
                <ProtectedRoute>
                  <ResultsPage />
                </ProtectedRoute>
              }
            />
            
            <Route path="*" element={<Navigate to="/login" replace />} />
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
