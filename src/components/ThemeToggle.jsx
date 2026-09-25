import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { T } from '../shared';
import { useTheme } from '../lib/theme.jsx';

export default function ThemeToggle({ withLabel = false }) {
  const { theme, toggle } = useTheme();
  const next = theme === 'light' ? 'dark' : 'light';
  const Icon = theme === 'light' ? Moon : Sun;

  return (
    <button
      onClick={toggle}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      className={`flex items-center gap-2 transition-colors hover:bg-[var(--wash)] ${withLabel ? 'w-full justify-start px-3 py-2 rounded-xl text-sm' : 'w-9 h-9 justify-center rounded-full'}`}
      style={{ color: T.muted, border: withLabel ? 'none' : `1px solid ${T.line}` }}
    >
      <Icon size={withLabel ? 14 : 16} />
      {withLabel && <span>{theme === 'light' ? 'Dark mode' : 'Light mode'}</span>}
    </button>
  );
}
