import { Moon, Sun } from 'lucide-react';

export interface ThemeToggleProps {
  isDark: boolean;
  onToggle: () => void;
  collapsed: boolean;
  /** Shown while dark, e.g. "Hellmodus". */
  lightLabel: string;
  /** Shown while light, e.g. "Dunkelmodus". */
  darkLabel: string;
}

/** The sidebar's light/dark switch. The sun and moon slide past each other. */
export function ThemeToggle({ isDark, onToggle, collapsed, lightLabel, darkLabel }: ThemeToggleProps) {
  const label = isDark ? lightLabel : darkLabel;
  return (
    <button
      type="button"
      onClick={onToggle}
      title={label}
      aria-label={collapsed ? label : undefined}
      className={`w-full flex items-center rounded-lg text-sm text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer py-2 ${
        collapsed ? 'justify-center' : 'gap-3 px-3'
      }`}
    >
      <span className="relative w-[17px] h-[17px] shrink-0 overflow-hidden block">
        <Moon
          size={17}
          className={`absolute inset-0 transition-all duration-300 ease-in-out ${
            isDark ? 'translate-y-full opacity-0' : 'translate-y-0 opacity-100'
          }`}
        />
        <Sun
          size={17}
          className={`absolute inset-0 transition-all duration-300 ease-in-out ${
            isDark ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
          }`}
        />
      </span>
      {!collapsed && <span className="whitespace-nowrap">{label}</span>}
    </button>
  );
}
