import React from 'react';
import { Images } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext.jsx';

const WallpaperToggleButton = () => {
  const { wallpaperSet, toggleWallpaper } = useTheme();
  const isZigZag = wallpaperSet === 'zigzag';
  const tooltip = isZigZag
    ? 'Switch to subtle prism wallpaper'
    : 'Switch back to zig-zag wallpaper';

  return (
    <div className="fixed bottom-3 right-3 z-50 group">
      <button
        type="button"
        onClick={toggleWallpaper}
        aria-label={tooltip}
        title={tooltip}
        className="h-8 w-8 rounded-full border border-slate-300/80 bg-slate-100/70 text-slate-700 shadow-md backdrop-blur-sm transition hover:bg-slate-200/80 dark:border-slate-700/80 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:bg-slate-800/80"
      >
        <Images className="h-4 w-4 mx-auto" />
      </button>
      <span className="pointer-events-none absolute bottom-10 right-0 whitespace-nowrap rounded-md border border-slate-300/90 bg-slate-100/90 px-2 py-1 text-xs text-slate-700 shadow-sm opacity-0 transition-opacity group-hover:opacity-100 dark:border-slate-700/90 dark:bg-slate-900/85 dark:text-slate-200">
        {tooltip}
      </span>
    </div>
  );
};

export default WallpaperToggleButton;
