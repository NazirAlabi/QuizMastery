import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Button } from '@/components/ui/button.jsx';
import { useToast } from '@/components/ui/use-toast.jsx';
import { appendReturnUrl, resolveReturnUrl } from '@/utils/returnUrl.js';

const AuthPrompt = () => {
  const { createGuest, isAuthenticated, isGuestUser, isLoading } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const returnUrl = useMemo(
    () => resolveReturnUrl(searchParams.get('returnUrl'), '/courses'),
    [searchParams]
  );
  const loginLink = useMemo(() => appendReturnUrl('/login', returnUrl), [returnUrl]);
  const registerLink = useMemo(() => appendReturnUrl('/register', returnUrl), [returnUrl]);

  useEffect(() => {
    if (!isLoading && isAuthenticated && !isGuestUser) {
      navigate(returnUrl, { replace: true });
    }
  }, [isAuthenticated, isGuestUser, isLoading, navigate, returnUrl]);

  const handleGuestSubmit = async (event) => {
    event.preventDefault();
    const normalizedName = displayName.trim();
    if (!normalizedName) {
      toast({
        title: 'Display name required',
        description: 'Please enter a name to continue as a guest.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    const result = await createGuest(normalizedName);
    if (result.success) {
      toast({
        title: 'Guest session ready',
        description: 'You can start your quiz now.',
      });
      navigate(returnUrl, { replace: true });
    } else {
      toast({
        title: 'Guest sign-in failed',
        description: result.error || 'Unable to create a guest session. Please try again.',
        variant: 'destructive',
      });
    }
    setIsSubmitting(false);
  };

  return (
    <>
      <Helmet>
        <title>Continue - QuizMaster</title>
        <meta name="description" content="Choose how you want to continue before starting this action." />
      </Helmet>

      <div className="min-h-screen flex items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-3xl space-y-6">
          <div className="text-center">
            <Link
              to="/"
              className="inline-flex items-center justify-center gap-2 mb-4 text-indigo-700 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
            >
              <GraduationCap className="h-10 w-10 md:h-12 md:w-12" />
              <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white">QuizMaster</h1>
            </Link>
            <p className="text-slate-600 text-sm md:text-base dark:text-slate-300">
              Choose how you would like to continue.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="text-lg">Sign In</CardTitle>
                <CardDescription>Use your existing account and keep your progress.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full" variant="outline">
                  <Link to={loginLink}>Log in</Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="h-full border-indigo-200 dark:border-indigo-900">
              <CardHeader>
                <CardTitle className="text-lg">Create Account</CardTitle>
                <CardDescription>Register to save progress and unlock unlimited attempts.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-indigo-500 dark:hover:bg-indigo-600">
                  <Link to={registerLink}>Register</Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="h-full">
              <CardHeader>
                <CardTitle className="text-lg">Continue as Guest</CardTitle>
                <CardDescription>Try up to two attempts before creating an account.</CardDescription>
              </CardHeader>
              <CardContent>
                {isAuthenticated && isGuestUser ? (
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    You are already signed in as a guest. Create an account or log in to keep your work.
                  </p>
                ) : (
                  <form onSubmit={handleGuestSubmit} className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="guest-name">Display Name</Label>
                      <Input
                        id="guest-name"
                        value={displayName}
                        onChange={(event) => setDisplayName(event.target.value)}
                        placeholder="Your name"
                        required
                        maxLength={80}
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={isSubmitting || isAuthenticated}
                    >
                      {isSubmitting ? 'Creating guest...' : 'Continue as Guest'}
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
};

export default AuthPrompt;
