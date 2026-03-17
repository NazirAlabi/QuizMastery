import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

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
  const [uiScale, setUiScale] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('uiScale');
      if (saved === 'compact' || saved === 'default' || saved === 'comfortable') {
        return saved;
      }
      return window.innerWidth < 768 ? 'comfortable' : 'default';
    }
    return 'default';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    root.setAttribute('data-wallpaper', wallpaperSet);
    root.setAttribute('data-ui-scale', uiScale);
    localStorage.setItem('theme', theme);
    localStorage.setItem('wallpaperSet', wallpaperSet);
    localStorage.setItem('uiScale', uiScale);
  }, [theme, wallpaperSet, uiScale]);

  const toggleTheme = useCallback(() => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  }, []);
  
  const toggleWallpaper = useCallback(() => {
    setWallpaperSet(prev => (prev === 'zigzag' ? 'prism' : 'zigzag'));
  }, []);

  const value = useMemo(
    () => ({ theme, toggleTheme, wallpaperSet, toggleWallpaper, uiScale, setUiScale }),
    [theme, toggleTheme, wallpaperSet, toggleWallpaper, uiScale, setUiScale]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
};
