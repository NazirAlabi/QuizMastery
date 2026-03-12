import React, { useMemo, useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/hooks/useAuth.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Button } from '@/components/ui/button.jsx';
import { GraduationCap } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast.jsx';
import { appendReturnUrl, resolveReturnUrl } from '@/utils/returnUrl.js';

const Register = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast({
        title: 'Passwords do not match',
        description: 'Please make sure your passwords match',
        variant: 'destructive'
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: 'Password too short',
        description: 'Password must be at least 6 characters',
        variant: 'destructive'
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

    const result = await register(email, password, name);

    if (result.success) {
      toast({
        title: isGuestUser ? 'Guest account upgraded!' : 'Account created!',
        description: isGuestUser ? 'Your previous attempts were kept.' : 'Welcome to QuizMaster',
      });
      navigate(returnUrl, { replace: true });
    } else {
      toast({
        title: 'Registration Failed',
        description: result.error || 'Could not create account',
        variant: 'destructive'
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
                    onChange={(e) => setName(e.target.value)}
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
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-12 text-base w-full"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm md:text-base">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-12 text-base w-full"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-sm md:text-base">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="h-12 text-base w-full"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 text-base bg-indigo-600 hover:bg-indigo-700 text-white transition-all active:scale-[0.98] dark:bg-indigo-500 dark:hover:bg-indigo-600"
                  disabled={isLoading}
                >
                  {isLoading ? 'Creating account...' : 'Create Account'}
                </Button>

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
