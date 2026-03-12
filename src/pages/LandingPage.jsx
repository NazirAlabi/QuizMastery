import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, FlaskConical, GraduationCap, LogIn, Rocket } from 'lucide-react';
import Navbar from '@/components/layout/Navbar.jsx';
import SettingsModal from '@/components/layout/SettingsModal.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { useAuth } from '@/hooks/useAuth.js';

const LandingPage = () => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { isGuestUser, isDevFeaturesEnabled } = useAuth();

  const quickLinks = useMemo(() => {
    const links = [
      {
        title: 'Explore Courses',
        description: 'Browse structured tracks and pick a topic to start with.',
        to: '/courses',
        icon: BookOpen,
      },
      {
        title: 'Browse Quizzes',
        description: 'Jump straight into quizzes and test your knowledge fast.',
        to: '/quizzes',
        icon: GraduationCap,
      },
      {
        title: isGuestUser ? 'Upgrade Account' : 'Create Account',
        description: 'Save your progress permanently and unlock unlimited attempts.',
        to: '/register',
        icon: Rocket,
      },
      {
        title: 'Sign In',
        description: 'Access your existing account and continue your learning streak.',
        to: '/login',
        icon: LogIn,
      },
    ];

    if (isDevFeaturesEnabled) {
      links.push(
        {
          title: 'Dev Content',
          description: 'Manage quizzes, questions, and content workflows.',
          to: '/dev/content',
          icon: FlaskConical,
        },
        {
          title: 'Dev Users',
          description: 'Review users, guest activity, and cleanup operations.',
          to: '/dev/users',
          icon: FlaskConical,
        }
      );
    }

    return links;
  }, [isDevFeaturesEnabled, isGuestUser]);

  return (
    <>
      <Helmet>
        <title>QuizMaster - Learn by Doing</title>
        <meta
          name="description"
          content="QuizMaster helps you learn through practical quizzes, instant feedback, and structured course pathways."
        />
      </Helmet>

      <div className="min-h-screen">
        <Navbar onOpenSettings={() => setIsSettingsOpen(true)} />
        <SettingsModal open={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

        <main className="max-w-[95%] mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 space-y-8">
          <section className="relative overflow-hidden rounded-2xl border border-slate-300 bg-gradient-to-br from-indigo-100 via-white to-cyan-100 p-6 md:p-10 dark:border-slate-700 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900">
            <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-indigo-400/20 blur-3xl dark:bg-indigo-500/20" />
            <div className="pointer-events-none absolute -bottom-16 left-1/3 h-48 w-48 rounded-full bg-cyan-400/20 blur-3xl dark:bg-cyan-500/20" />

            <div className="relative z-10 max-w-3xl space-y-4">
              <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-slate-900 dark:text-white">
                Master concepts faster with focused quizzes and guided practice.
              </h1>
              <p className="text-base md:text-lg text-slate-700 dark:text-slate-300">
                QuizMaster combines topic-based courses, quiz drills, and instant feedback so you can
                learn by doing. Create an account whenever you are ready to save your progress.
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                <Button asChild className="bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-indigo-500 dark:hover:bg-indigo-600">
                  <Link to="/courses">
                    Start With Courses
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/quizzes">Go To Quizzes</Link>
                </Button>
                <Button asChild variant="ghost">
                  <Link to="/register">{isGuestUser ? 'Upgrade Account' : 'Create Account'}</Link>
                </Button>
              </div>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Step 1: Pick a Path</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Choose a course or quiz topic and jump directly into practice.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Step 2: Attempt Quizzes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Answer questions with real-time progression and clear attempt flows.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Step 3: Review Results</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Analyze strengths and weak areas to guide your next study session.
                </p>
              </CardContent>
            </Card>
          </section>

          <section>
            <div className="mb-4">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Quick Links</h2>
              <p className="text-slate-600 dark:text-slate-400">
                Navigate to the main areas of the app.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {quickLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <Card key={link.title} className="h-full">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Icon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                        {link.title}
                      </CardTitle>
                      <CardDescription>{link.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button asChild variant="outline" className="w-full justify-between">
                        <Link to={link.to}>
                          Open
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        </main>
      </div>
    </>
  );
};

export default LandingPage;
