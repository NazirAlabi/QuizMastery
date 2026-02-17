import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/hooks/useAuth.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Button } from '@/components/ui/button.jsx';
import { GraduationCap } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast.jsx';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    const result = await login(email, password);

    if (result.success) {
      toast({
        title: 'Welcome back!',
        description: 'Successfully logged in',
      });
      navigate('/quizzes');
    } else {
      toast({
        title: 'Login Failed',
        description: result.error || 'Invalid credentials',
        variant: 'destructive'
      });
    }

    setIsLoading(false);
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
            <div className="flex items-center justify-center gap-2 mb-4">
              <GraduationCap className="h-10 w-10 md:h-12 md:w-12 text-indigo-600 dark:text-indigo-400" />
              <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white">QuizMaster</h1>
            </div>
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
                    onChange={(e) => setEmail(e.target.value)}
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
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    enterKeyHint="go"
                    className="h-12 text-base w-full"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 text-base bg-indigo-600 hover:bg-indigo-700 text-white transition-all active:scale-[0.98] dark:bg-indigo-500 dark:hover:bg-indigo-600"
                  disabled={isLoading}
                >
                  {isLoading ? 'Signing in...' : 'Sign In'}
                </Button>

                <p className="text-center text-sm md:text-base text-slate-600 dark:text-slate-400">
                  Don't have an account?{' '}
                  <Link to="/register" className="text-indigo-600 hover:text-indigo-700 font-medium p-1 dark:text-indigo-400 dark:hover:text-indigo-300">
                    Register here
                  </Link>
                </p>

                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg dark:bg-blue-950/30 dark:border-blue-900">
                  <p className="text-xs md:text-sm text-blue-800 leading-relaxed dark:text-blue-200">
                    <strong>Demo Account:</strong><br />
                    Email: demo@university.edu<br />
                    Password: demo123
                  </p>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
};

export default Login;
