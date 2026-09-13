import { useState, type CSSProperties, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { ChevronLeft, type LucideIcon } from 'lucide-react';
import { AppSwitcher } from './AppSwitcher.js';
import type { AppId } from './apps.js';
import { DarkModeContext, useDarkMode } from './theme.js';
import { ThemeToggle } from './ThemeToggle.js';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Match the path exactly. Defaults to true for "/", which would otherwise be active everywhere. */
  end?: boolean;
}

export interface AppShellProps {
  /** The brand at the top of the sidebar, handed to `AppSwitcher`. */
  app: { id: AppId; icon: ReactNode; label: string };
  nav: readonly NavItem[];
  /** Shown in the bottom block, above the theme toggle. */
  settings?: NavItem;
  labels: {
    /** Accessible name of the main navigation, e.g. "Hauptnavigation". */
    navigation: string;
    collapse: string;
    expand: string;
    lightMode: string;
    darkMode: string;
  };
  /** Remember the collapsed state in localStorage under this key. */
  storageKey?: string;
  /** Rendered between the brand and the navigation, e.g. a primary "New" button. */
  top?: (collapsed: boolean) => ReactNode;
  /** Rendered at the start of the bottom block, e.g. a profile switch. */
  footer?: (collapsed: boolean) => ReactNode;
  /** Extra classes on the page wrapper, e.g. a minimum width. */
  className?: string;
  /** Extra classes on `<main>`, e.g. `h-screen overflow-auto` for a page that scrolls inside itself. */
  mainClassName?: string;
  children: ReactNode;
}

function readCollapsed(storageKey: string | undefined): boolean {
  if (!storageKey) return false;
  try {
    return localStorage.getItem(storageKey) === 'true';
  } catch {
    return false;
  }
}

/** Nav link classes, exported so app-specific sidebar content can match the look. */
export function navLinkClass(collapsed: boolean, isActive: boolean) {
  return `flex items-center rounded-lg text-sm transition-colors ${collapsed ? 'justify-center py-2' : 'gap-3 px-3 py-2'} ${
    isActive
      ? 'bg-accent-50 dark:bg-accent-900/30 text-accent-700 dark:text-accent-300 font-medium'
      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
  }`;
}

function SidebarLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end ?? item.to === '/'}
      title={collapsed ? item.label : undefined}
      aria-label={collapsed ? item.label : undefined}
      className={({ isActive }) => navLinkClass(collapsed, isActive)}
    >
      <Icon size={17} className="shrink-0" aria-hidden />
      {!collapsed && <span className="whitespace-nowrap">{item.label}</span>}
    </NavLink>
  );
}

/**
 * The layout every app shares: a collapsible sidebar with the app switcher, the
 * navigation, the theme toggle and a collapse button, next to the page. It also owns
 * the dark mode state and provides it to `useIsDark`. Must sit inside a router.
 */
export function AppShell({
  app,
  nav,
  settings,
  labels,
  storageKey,
  top,
  footer,
  className = '',
  mainClassName = '',
  children,
}: AppShellProps) {
  const { isDark, toggle } = useDarkMode();
  const [collapsed, setCollapsed] = useState(() => readCollapsed(storageKey));

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      if (storageKey) {
        try {
          localStorage.setItem(storageKey, String(next));
        } catch {
          // Storage refused: the sidebar still collapses, it just won't remember.
        }
      }
      return next;
    });
  }

  const pad = collapsed ? 'px-2' : 'px-3';

  return (
    <DarkModeContext value={isDark}>
      <div className={`flex min-h-screen bg-slate-50 dark:bg-slate-900 ${className}`}>
        <aside
          className={`fixed left-0 top-0 z-30 flex h-screen flex-col border-r border-slate-200 bg-white transition-all duration-300 ease-sidebar dark:border-slate-700/60 dark:bg-slate-900 ${
            collapsed ? 'w-14' : 'w-56'
          }`}
        >
          <div
            className={`flex h-[68px] shrink-0 items-center border-b border-slate-100 dark:border-slate-700/60 ${
              collapsed ? 'justify-center' : 'gap-2 px-5'
            }`}
          >
            <AppSwitcher current={app.id} icon={app.icon} label={app.label} collapsed={collapsed} />
          </div>

          {top && <div className={`pt-3 ${pad}`}>{top(collapsed)}</div>}

          <nav aria-label={labels.navigation} className={`flex-1 space-y-1 overflow-hidden py-4 ${pad}`}>
            {nav.map((item) => (
              <SidebarLink key={item.to} item={item} collapsed={collapsed} />
            ))}
          </nav>

          <div className={`space-y-1 border-t border-slate-100 py-3 dark:border-slate-700/60 ${pad}`}>
            {footer?.(collapsed)}
            {settings && <SidebarLink item={settings} collapsed={collapsed} />}
            <ThemeToggle
              isDark={isDark}
              onToggle={toggle}
              collapsed={collapsed}
              lightLabel={labels.lightMode}
              darkLabel={labels.darkMode}
            />
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-expanded={!collapsed}
              aria-label={collapsed ? labels.expand : labels.collapse}
              title={collapsed ? labels.expand : undefined}
              className={`flex w-full items-center rounded-lg py-2 text-sm text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300 cursor-pointer ${
                collapsed ? 'justify-center' : 'gap-3 px-3'
              }`}
            >
              <ChevronLeft
                size={17}
                aria-hidden
                className={`shrink-0 transition-transform duration-300 ease-sidebar ${collapsed ? 'rotate-180' : 'rotate-0'}`}
              />
              {!collapsed && <span className="whitespace-nowrap">{labels.collapse}</span>}
            </button>
          </div>
        </aside>

        <main
          className={`min-w-0 flex-1 p-8 transition-all duration-300 ease-sidebar ${collapsed ? 'ml-14' : 'ml-56'} ${mainClassName}`}
          style={{ '--sidebar-width': collapsed ? '3.5rem' : '14rem' } as CSSProperties}
        >
          {children}
        </main>
      </div>
    </DarkModeContext>
  );
}
