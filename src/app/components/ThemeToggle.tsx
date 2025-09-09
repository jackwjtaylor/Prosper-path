"use client";
import React from "react";

type Theme = "light" | "dark";

export default function ThemeToggle() {
  const [theme, setTheme] = React.useState<Theme>(() => {
    if (typeof window === 'undefined') return 'dark';
    try {
      const t = (localStorage.getItem('theme') as Theme | null) || 'dark';
      return (t === 'light' || t === 'dark') ? t : 'dark';
    } catch { return 'dark'; }
  });

  React.useEffect(() => {
    try {
      localStorage.setItem('theme', theme);
      document.documentElement.setAttribute('data-theme', theme);
    } catch {}
  }, [theme]);

  return (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="h-8 px-3 rounded-md text-xs font-medium border shadow-sm bg-card"
      title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      aria-label="Toggle theme"
    >
      {theme === 'dark' ? 'Light' : 'Dark'}
    </button>
  );
}

