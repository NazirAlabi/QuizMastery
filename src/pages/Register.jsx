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

const Register = () => {
  const [staySignedIn, setStaySignedIn] = useState(() => {
    try {
      if (typeof window === 'undefined') return true;
      return window.localStorage.getItem('quizmaster_auth_persistence_pref_v1') !== 'session';
    } catch {
      return true;
    }
  });
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { register, isGuestUser } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const isGuestLimitRedirect = searchParams.get('reason') === 'guest-attempt-limit';
  const returnUrl = useMemo(
    () => resolveReturnUrl(searchParams.get('returnUrl'), '/courses'),
    [searchParams]
  );
  const loginLink = useMemo(() => appendReturnUrl('/login', returnUrl), [returnUrl]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (password !== confirmPassword) {
      toast({
        title: 'Passwords do not match',
        description: 'Please make sure your passwords match',
        variant: 'destructive',
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: 'Password too short',
        description: 'Password must be at least 6 characters',
        variant: 'destructive',
      });
      return;
    }

    if (!name.trim()) {
      toast({
        title: 'Display name required',
        description: 'Please enter a name to continue.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    const result = await register(email, password, name, { staySignedIn });

    if (result.success) {
      toast({
        title: isGuestUser ? 'Guest account upgraded!' : 'Account created!',
        description: isGuestUser ? 'Your previous attempts were kept.' : 'Welcome to QuizMaster',
      });
      navigate(returnUrl, { replace: true });
    } else {
      toast({
        title: 'Registration Failed',
        description: getUserFriendlyErrorMessage(result.error, 'Could not create account'),
        variant: 'destructive',
      });
    }

    setIsLoading(false);
  };

  return (
    <>
      <Helmet>
        <title>Register - QuizMaster</title>
        <meta name="description" content="Create an account to start taking quizzes and tracking your progress" />
      </Helmet>

      <div className="min-h-screen flex items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-md">
          <div className="text-center mb-6 md:mb-8">
            <Link to="/" className="inline-flex items-center justify-center gap-2 mb-4 text-indigo-700 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300">
              <GraduationCap className="h-10 w-10 md:h-12 md:w-12" />
              <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white">QuizMaster</h1>
            </Link>
            <p className="text-slate-600 text-sm md:text-base dark:text-slate-300">Start your learning journey today</p>
          </div>

          <Card className="w-full shadow-lg">
            <CardHeader className="space-y-1 px-6 pt-6 pb-4">
              <CardTitle className="text-xl md:text-2xl text-center">Create Account</CardTitle>
              <CardDescription className="text-center text-sm md:text-base">
                {isGuestLimitRedirect
                  ? 'You used your 2 free guest attempts. Create your account to continue.'
                  : 'Sign up to access all quizzes and features'}
              </CardDescription>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm md:text-base">Display Name</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Jane Doe"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    required
                    maxLength={80}
                    className="h-12 text-base w-full"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm md:text-base">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="student@university.edu"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    className="h-12 text-base w-full"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm md:text-base">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      required
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

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-sm md:text-base">Confirm Password</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      required
                      className="h-12 text-base w-full pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((previous) => !previous)}
                      className="absolute inset-y-0 right-2 inline-flex items-center px-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                      aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 text-base bg-indigo-600 hover:bg-indigo-700 text-white transition-all active:scale-[0.98] dark:bg-indigo-500 dark:hover:bg-indigo-600"
                  disabled={isLoading}
                >
                  {isLoading ? 'Creating account...' : 'Create Account'}
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

                <p className="text-center text-sm md:text-base text-slate-600 dark:text-slate-400">
                  Already have an account?{' '}
                  <Link to={loginLink} className="text-indigo-600 hover:text-indigo-700 font-medium p-1 dark:text-indigo-400 dark:hover:text-indigo-300">
                    Sign in here
                  </Link>
                </p>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
};

export default Register;
