import React, { useMemo, useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Eye, EyeOff, GraduationCap } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Button } from '@/components/ui/button.jsx';
import { useToast } from '@/components/ui/use-toast.jsx';
import { appendReturnUrl, resolveReturnUrl } from '@/utils/returnUrl.js';
import { getUserFriendlyErrorMessage } from '@/utils/errorHandling.js';

const Login = () => {
  const [staySignedIn, setStaySignedIn] = useState(() => {
    try {
      if (typeof window === 'undefined') return true;
      return window.localStorage.getItem('quizmaster_auth_persistence_pref_v1') !== 'session';
    } catch {
      return true;
    }
  });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isForgotOpen, setIsForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotDisplayName, setForgotDisplayName] = useState('');
  const [isResetLoading, setIsResetLoading] = useState(false);
  const { login, requestPasswordReset } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const returnUrl = useMemo(
    () => resolveReturnUrl(searchParams.get('returnUrl'), '/courses'),
    [searchParams]
  );
  const registerLink = useMemo(() => appendReturnUrl('/register', returnUrl), [returnUrl]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsLoading(true);

    const result = await login(email, password, { staySignedIn });

    if (result.success) {
      toast({
        title: 'Welcome back!',
        description: 'Successfully logged in',
      });
      navigate(returnUrl, { replace: true });
    } else {
      toast({
        title: 'Login Failed',
        description: getUserFriendlyErrorMessage(result.error, 'Could not log in'),
        variant: 'destructive',
      });
    }

    setIsLoading(false);
  };

  const handleForgotPassword = async (event) => {
    event.preventDefault();
    setIsResetLoading(true);

    const result = await requestPasswordReset(forgotEmail, forgotDisplayName);
    if (result.success) {
      toast({
        title: 'Password reset email sent',
        description: `Check ${forgotEmail} for reset instructions.`,
      });
      setIsForgotOpen(false);
      setForgotDisplayName('');
      setForgotEmail('');
    } else {
      toast({
        title: 'Reset request failed',
        description: getUserFriendlyErrorMessage(result.error, 'Could not send reset email.'),
        variant: 'destructive',
      });
    }

    setIsResetLoading(false);
  };

  return (
    <>
      <Helmet>
        <title>Login - QuizMaster</title>
        <meta name="description" content="Login to access your quizzes and track your progress" />
      </Helmet>

      <div className="min-h-screen flex items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-md">
          <div className="text-center mb-6 md:mb-8">
            <Link to="/" className="inline-flex items-center justify-center gap-2 mb-4 text-indigo-700 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300">
              <GraduationCap className="h-10 w-10 md:h-12 md:w-12" />
              <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white">QuizMaster</h1>
            </Link>
            <p className="text-slate-600 text-sm md:text-base dark:text-slate-300">Master your knowledge, one quiz at a time</p>
          </div>

          <Card className="w-full shadow-lg">
            <CardHeader className="space-y-1 px-6 pt-6 pb-4">
              <CardTitle className="text-xl md:text-2xl text-center">Welcome Back</CardTitle>
              <CardDescription className="text-center text-sm md:text-base">Sign in to continue your learning journey</CardDescription>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6" autoComplete="on">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm md:text-base">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="student@university.edu"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    autoComplete="username"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    inputMode="email"
                    enterKeyHint="next"
                    className="h-12 text-base w-full"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm md:text-base">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      required
                      autoComplete="current-password"
                      enterKeyHint="go"
                      className="h-12 text-base w-full pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((previous) => !previous)}
                      className="absolute inset-y-0 right-2 inline-flex items-center px-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 text-base bg-indigo-600 hover:bg-indigo-700 text-white transition-all active:scale-[0.98] dark:bg-indigo-500 dark:hover:bg-indigo-600"
                  disabled={isLoading}
                >
                  {isLoading ? 'Signing in...' : 'Sign In'}
                </Button>

                <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <input
                    type="checkbox"
                    checked={staySignedIn}
                    onChange={(event) => setStaySignedIn(event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  Stay logged in on this device
                </label>
              </form>

              <div className="mt-4 space-y-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsForgotOpen((previous) => !previous);
                    setForgotEmail((previous) => previous || email);
                  }}
                  className="text-sm text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                >
                  {isForgotOpen ? 'Hide password reset' : 'Forgot password?'}
                </button>

                {isForgotOpen ? (
                  <form onSubmit={handleForgotPassword} className="space-y-3 rounded-lg border border-slate-300 p-3 dark:border-slate-700">
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      Enter your display name and email to receive a password reset link.
                    </p>
                    <div className="space-y-1">
                      <Label htmlFor="forgot-name">Display Name</Label>
                      <Input
                        id="forgot-name"
                        value={forgotDisplayName}
                        onChange={(event) => setForgotDisplayName(event.target.value)}
                        required
                        placeholder="Jane Doe"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="forgot-email">Email</Label>
                      <Input
                        id="forgot-email"
                        type="email"
                        value={forgotEmail}
                        onChange={(event) => setForgotEmail(event.target.value)}
                        required
                        placeholder="student@university.edu"
                      />
                    </div>
                    <Button type="submit" size="sm" disabled={isResetLoading}>
                      {isResetLoading ? 'Sending...' : 'Send Reset Email'}
                    </Button>
                  </form>
                ) : null}

                <p className="text-center text-sm md:text-base text-slate-600 dark:text-slate-400">
                  Don&apos;t have an account?{' '}
                  <Link to={registerLink} className="text-indigo-600 hover:text-indigo-700 font-medium p-1 dark:text-indigo-400 dark:hover:text-indigo-300">
                    Register here
                  </Link>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
};

export default Login;
