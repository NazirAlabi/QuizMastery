import React, { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth.js';
import { useTheme } from '@/context/ThemeContext.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { GraduationCap, BookOpen, Home, LogOut, Menu, X, Sun, Moon, Wrench, Settings, LineChart } from 'lucide-react';
import { appendReturnUrl } from '@/utils/returnUrl.js';

const getRelativeTimeGreeting = (date = new Date()) => {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};

const Navbar = ({ onOpenSettings }) => {
  const {
    user,
    logout,
    isGuestUser,
    isDevFeaturesEnabled,
    canToggleDevFeatures,
    toggleDevFeatures,
    isAuthenticated,
  } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const returnUrl = useMemo(
    () => `${location.pathname}${location.search}${location.hash}`,
    [location.hash, location.pathname, location.search]
  );
  const authPromptBaseUrl = useMemo(() => appendReturnUrl('/auth-prompt', returnUrl), [returnUrl]);
  const authPromptUrlFor = (intent) =>
    `${authPromptBaseUrl}${authPromptBaseUrl.includes('?') ? '&' : '?'}intent=${intent}`;
  const loginUrl = useMemo(() => appendReturnUrl('/login', returnUrl), [returnUrl]);
  const registerUrl = useMemo(() => appendReturnUrl('/register', returnUrl), [returnUrl]);
  const canOpenSettings = typeof onOpenSettings === 'function' && isAuthenticated;
  const registeredEmail = !isGuestUser ? String(user?.email || '').trim() : '';
  const showSignedInAs = isAuthenticated && !isGuestUser && Boolean(registeredEmail);
  const showGuestLabel = isAuthenticated && isGuestUser;
  const greetingName =
    isAuthenticated && !isGuestUser ? user?.displayName || registeredEmail || '' : '';
  const greeting = greetingName ? `${getRelativeTimeGreeting(now)}, ${greetingName}` : getRelativeTimeGreeting(now);

  React.useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/');
    setIsMenuOpen(false);
  };

  return (
    <nav className="bg-slate-100/50 border-b backdrop-blur-xl border-slate-300 sticky top-0 z-50 shadow-sm dark:bg-slate-900/50 dark:border-slate-800">
      <div className="max-w-[95%] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 text-indigo-700 hover:text-indigo-800 transition-colors dark:text-indigo-400 dark:hover:text-indigo-300">
            <GraduationCap className="h-8 w-8" />
            <div className="flex flex-col leading-tight">
              <span className="text-xl font-bold">QuizMaster</span>
              <span className="text-xs text-slate-600 dark:text-slate-400">{greeting}</span>
            </div>
            {isDevFeaturesEnabled && (
              <Badge
                variant="outline"
                className="text-[10px] uppercase tracking-wide bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
              >
                Dev Mode
              </Badge>
            )}
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" className="text-slate-700 hover:text-indigo-700 dark:text-slate-300 dark:hover:text-indigo-400">
                <Home className="h-4 w-4 mr-2" />
                Home
              </Button>
            </Link>
            <Link to="/quizzes">
              <Button variant="ghost" className="text-slate-700 hover:text-indigo-700 dark:text-slate-300 dark:hover:text-indigo-400">
                <GraduationCap className="h-4 w-4 mr-2" />
                Quizzes
              </Button>
            </Link>
            <Link to="/courses">
              <Button variant="ghost" className="text-slate-700 hover:text-indigo-700 dark:text-slate-300 dark:hover:text-indigo-400">
                <BookOpen className="h-4 w-4 mr-2" />
                Courses
              </Button>
            </Link>
            <Link to="/insights">
              <Button variant="ghost" className="text-slate-700 hover:text-indigo-700 dark:text-slate-300 dark:hover:text-indigo-400">
                <LineChart className="h-4 w-4 mr-2" />
                Progress & History
              </Button>
            </Link>
            {isDevFeaturesEnabled && (
              <Link to="/dev/content">
                <Button variant="ghost" className="text-slate-700 hover:text-indigo-700 dark:text-slate-300 dark:hover:text-indigo-400">
                  <Wrench className="h-4 w-4 mr-2" />
                  Content
                </Button>
              </Link>
            )}
            {isDevFeaturesEnabled && (
              <Link to="/dev/users">
                <Button variant="ghost" className="text-slate-700 hover:text-indigo-700 dark:text-slate-300 dark:hover:text-indigo-400">
                  <Wrench className="h-4 w-4 mr-2" />
                  Users
                </Button>
              </Link>
            )}

            <div className="flex items-center gap-3 pl-4 border-l border-slate-200 dark:border-slate-800">
              {canToggleDevFeatures && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={toggleDevFeatures}
                  className={
                    isDevFeaturesEnabled
                      ? 'border-amber-300 bg-amber-100 text-amber-800 hover:bg-amber-200 dark:border-amber-800 dark:bg-amber-950/40 dark:hover:bg-amber-950/70 dark:hover:border-amber-600 dark:text-amber-300'
                      : 'border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                  }
                >
                  <Wrench className="h-3 w-3 mr-1" />
                  {isDevFeaturesEnabled ? 'Dev Features On' : 'Dev Features Off'}
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                className="text-slate-700 hover:text-indigo-700 dark:text-slate-300 dark:hover:text-white aspect-square rounded-full p-2"
              >
                {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </Button>
              {canOpenSettings && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onOpenSettings();
                  }}
                  className="text-slate-700 dark:text-slate-300 border-none aspect-square rounded-full p-2"
                >
                  <Settings className="h-6 w-6" />
                </Button>
              )}

              {isAuthenticated ? (
                <>
                  {showSignedInAs || showGuestLabel ? (
                    <div className="text-sm text-right">
                      {showSignedInAs ? (
                        <>
                          <p className="text-slate-500 text-xs dark:text-slate-400">Signed in as</p>
                          <p className="font-medium text-slate-900 dark:text-slate-200">{registeredEmail}</p>
                        </>
                      ) : (
                        <p className="font-medium text-slate-900 dark:text-slate-200">Guest</p>
                      )}
                    </div>
                  ) : null}

                  {isGuestUser ? (
                    <div className="flex items-center gap-2">
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="text-slate-700 hover:text-indigo-700 dark:text-slate-300 dark:hover:text-indigo-300"
                      >
                        <Link to={authPromptUrlFor('register')}>Create account</Link>
                      </Button>
                      <Button
                        asChild
                        variant="ghost"
                        size="sm"
                        className="text-slate-700 hover:text-indigo-700 dark:text-slate-300 dark:hover:text-indigo-300"
                      >
                        <Link to={authPromptUrlFor('login')}>Log in</Link>
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleLogout}
                      className="text-slate-700 hover:text-red-600 hover:border-red-300 dark:text-slate-300 dark:border-slate-700 dark:hover:text-red-400 dark:hover:border-red-800"
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Sign Out
                    </Button>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <Button
                    asChild
                    variant="ghost"
                    size="sm"
                    className="text-slate-700 hover:text-indigo-700 dark:text-slate-300 dark:hover:text-indigo-300"
                  >
                    <Link to={loginUrl}>Sign In</Link>
                  </Button>
                  <Button asChild size="sm">
                    <Link to={registerUrl}>Register</Link>
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex items-center gap-2 md:hidden">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="text-slate-700 dark:text-slate-300"
            >
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-slate-700 dark:text-slate-300"
            >
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      {isMenuOpen && (
        <div className="md:hidden border-t border-slate-300 bg-slate-100 absolute w-full shadow-lg dark:bg-slate-950 dark:border-slate-800">
          <div className="px-4 pt-2 pb-6 space-y-4">
            <div className="pt-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              {showSignedInAs || showGuestLabel ? (
                showSignedInAs ? (
                  <>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Signed in as</p>
                    <p className="font-medium text-slate-900 truncate dark:text-slate-200">
                      {registeredEmail}
                    </p>
                  </>
                ) : (
                  <p className="font-medium text-slate-900 truncate dark:text-slate-200">Guest</p>
                )
              ) : null}
              {canToggleDevFeatures && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={toggleDevFeatures}
                  className={
                    isDevFeaturesEnabled
                      ? 'mt-2 border-amber-300 bg-amber-100 text-amber-800 hover:bg-amber-200 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                      : 'mt-2 border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                  }
                >
                  <Wrench className="h-3 w-3 mr-1" />
                  {isDevFeaturesEnabled ? 'Dev Features On' : 'Dev Features Off'}
                </Button>
              )}
            </div>
            
            <Link 
              to="/" 
              onClick={() => setIsMenuOpen(false)}
              className="block"
            >
              <Button variant="ghost" className="w-full justify-start text-slate-700 hover:text-indigo-700 h-12 text-base dark:text-slate-300 dark:hover:text-indigo-400">
                <Home className="h-5 w-5 mr-3" />
                Home
              </Button>
            </Link>
            <Link 
              to="/quizzes" 
              onClick={() => setIsMenuOpen(false)}
              className="block"
            >
              <Button variant="ghost" className="w-full justify-start text-slate-700 hover:text-indigo-700 h-12 text-base dark:text-slate-300 dark:hover:text-indigo-400">
                <GraduationCap className="h-5 w-5 mr-3" />
                Quizzes
              </Button>
            </Link>
            <Link
              to="/courses"
              onClick={() => setIsMenuOpen(false)}
              className="block"
            >
              <Button variant="ghost" className="w-full justify-start text-slate-700 hover:text-indigo-700 h-12 text-base dark:text-slate-300 dark:hover:text-indigo-400">
                <BookOpen className="h-5 w-5 mr-3" />
                Courses
              </Button>
            </Link>
            <Link
              to="/insights"
              onClick={() => setIsMenuOpen(false)}
              className="block"
            >
              <Button variant="ghost" className="w-full justify-start text-slate-700 hover:text-indigo-700 h-12 text-base dark:text-slate-300 dark:hover:text-indigo-400">
                <LineChart className="h-5 w-5 mr-3" />
                Progress & History
              </Button>
            </Link>
            {isDevFeaturesEnabled && (
              <Link
                to="/dev/content"
                onClick={() => setIsMenuOpen(false)}
                className="block"
              >
                <Button variant="ghost" className="w-full justify-start text-slate-700 hover:text-indigo-700 h-12 text-base dark:text-slate-300 dark:hover:text-indigo-400">
                  <Wrench className="h-5 w-5 mr-3" />
                  Content Dashboard
                </Button>
              </Link>
            )}
            {isDevFeaturesEnabled && (
              <Link
                to="/dev/users"
                onClick={() => setIsMenuOpen(false)}
                className="block"
              >
                <Button variant="ghost" className="w-full justify-start text-slate-700 hover:text-indigo-700 h-12 text-base dark:text-slate-300 dark:hover:text-indigo-400">
                  <Wrench className="h-5 w-5 mr-3" />
                  Users Dashboard
                </Button>
              </Link>
            )}

            {canOpenSettings && (
              <Button
                variant="ghost"
                onClick={() => {
                  onOpenSettings();
                  setIsMenuOpen(false);
                }}
                className="w-full justify-start text-slate-700 hover:text-indigo-700 h-12 text-base dark:text-slate-300 dark:hover:text-indigo-400"
              >
                <Settings className="h-5 w-5 mr-3" />
                Settings
              </Button>
            )}
            {isAuthenticated ? (
              isGuestUser ? (
                <>
                  <Button
                    asChild
                    variant="outline"
                    className="w-full justify-start text-slate-700 hover:text-indigo-700 hover:border-indigo-300 h-12 text-base dark:text-slate-300 dark:border-slate-700 dark:hover:text-indigo-300"
                  >
                    <Link to={authPromptUrlFor('register')} onClick={() => setIsMenuOpen(false)}>
                      Create account
                    </Link>
                  </Button>
                  <Button
                    asChild
                    variant="ghost"
                    className="w-full justify-start text-slate-700 hover:text-indigo-700 h-12 text-base dark:text-slate-300 dark:hover:text-indigo-400"
                  >
                    <Link to={authPromptUrlFor('login')} onClick={() => setIsMenuOpen(false)}>
                      Log in
                    </Link>
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  onClick={handleLogout}
                  className="w-full justify-start text-slate-700 hover:text-red-600 hover:border-red-300 h-12 text-base dark:text-slate-300 dark:border-slate-700 dark:hover:text-red-400"
                >
                  <LogOut className="h-5 w-5 mr-3" />
                  Sign Out
                </Button>
              )
            ) : (
              <>
                <Button
                  asChild
                  variant="ghost"
                  className="w-full justify-start text-slate-700 hover:text-indigo-700 h-12 text-base dark:text-slate-300 dark:hover:text-indigo-400"
                >
                  <Link to={loginUrl} onClick={() => setIsMenuOpen(false)}>
                    Sign In
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="w-full justify-start text-slate-700 hover:text-indigo-700 hover:border-indigo-300 h-12 text-base dark:text-slate-300 dark:border-slate-700 dark:hover:text-indigo-300"
                >
                  <Link to={registerUrl} onClick={() => setIsMenuOpen(false)}>
                    Register
                  </Link>
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
