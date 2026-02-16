import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') || 'light';
    }
    return 'light';
  });
  const [wallpaperSet, setWallpaperSet] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('wallpaperSet');
      return saved === 'zigzag' || saved === 'prism' ? saved : 'prism';
    }
    return 'prism';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    root.setAttribute('data-wallpaper', wallpaperSet);
    localStorage.setItem('theme', theme);
    localStorage.setItem('wallpaperSet', wallpaperSet);
  }, [theme, wallpaperSet]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };
  
  const toggleWallpaper = () => {
    setWallpaperSet(prev => (prev === 'zigzag' ? 'prism' : 'zigzag'));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, wallpaperSet, toggleWallpaper }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
};
