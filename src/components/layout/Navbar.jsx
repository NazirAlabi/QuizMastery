import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth.js';
import { useTheme } from '@/context/ThemeContext.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { GraduationCap, LogOut, Menu, X, Sun, Moon, Wrench } from 'lucide-react';

const Navbar = () => {
  const { user, logout, isDevFeaturesEnabled } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
    setIsMenuOpen(false);
  };

  return (
    <nav className="bg-slate-100 border-b border-slate-300 sticky top-0 z-50 shadow-sm dark:bg-slate-950 dark:border-slate-800">
      <div className="max-w-[95%] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/quizzes" className="flex items-center gap-2 text-indigo-700 hover:text-indigo-800 transition-colors dark:text-indigo-400 dark:hover:text-indigo-300">
            <GraduationCap className="h-8 w-8" />
            <span className="text-xl font-bold">QuizMaster</span>
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
            <Link to="/quizzes">
              <Button variant="ghost" className="text-slate-700 hover:text-indigo-700 dark:text-slate-300 dark:hover:text-indigo-400">
                <GraduationCap className="h-4 w-4 mr-2" />
                Quizzes
              </Button>
            </Link>

            <div className="flex items-center gap-3 pl-4 border-l border-slate-200 dark:border-slate-800">
              {isDevFeaturesEnabled && (
                <Badge className="bg-amber-600 hover:bg-amber-600 text-white">
                  <Wrench className="h-3 w-3 mr-1" />
                  Dev Features On
                </Badge>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                className="text-slate-700 hover:text-indigo-700 dark:text-slate-300 dark:hover:text-indigo-400"
              >
                {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </Button>

              <div className="text-sm text-right">
                <p className="text-slate-500 text-xs dark:text-slate-400">Signed in as</p>
                <p className="font-medium text-slate-900 dark:text-slate-200">{user?.email}</p>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleLogout}
                className="text-slate-700 hover:text-red-600 hover:border-red-300 dark:text-slate-300 dark:border-slate-700 dark:hover:text-red-400 dark:hover:border-red-800"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
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
              <p className="text-xs text-slate-500 dark:text-slate-400">Signed in as</p>
              <p className="font-medium text-slate-900 truncate dark:text-slate-200">{user?.email}</p>
              {isDevFeaturesEnabled && (
                <Badge className="mt-2 bg-amber-600 hover:bg-amber-600 text-white">
                  <Wrench className="h-3 w-3 mr-1" />
                  Dev Features On
                </Badge>
              )}
            </div>
            
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

            <Button 
              variant="outline" 
              onClick={handleLogout}
              className="w-full justify-start text-slate-700 hover:text-red-600 hover:border-red-300 h-12 text-base dark:text-slate-300 dark:border-slate-700 dark:hover:text-red-400"
            >
              <LogOut className="h-5 w-5 mr-3" />
              Logout
            </Button>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
