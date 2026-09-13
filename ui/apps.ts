import { Briefcase, Building2, ChartColumn, Gift, House, SquareCheckBig, Wallet, type LucideIcon } from 'lucide-react';

export type AppId = 'dashboard' | 'budget' | 'todo' | 'freelance' | 'immo' | 'portfolio' | 'wishlist';

export interface AppEntry {
  id: AppId;
  name: string;
  description: string;
  url: string;
  icon: LucideIcon;
}

/**
 * Every web-* app, in menu order. This is the only place their URLs live: moving or
 * adding an app is an edit here and a release, and the fan-out carries it to all of
 * them.
 *
 * Every hostname is the one Render actually assigned, read from that app's own
 * render.yaml. Render usually appends a hash to the service name, so
 * `web-budget.onrender.com` is not where web-budget lives, and guessing that pattern
 * produces links that open a 404. web-freelance and web-wishlist happen to have no
 * hash, which is why the guess looks plausible.
 */
export const APPS: readonly AppEntry[] = [
  {
    id: 'dashboard',
    name: 'Home',
    description: 'Rooms, climate, plants and lights',
    url: 'https://web-dashboard-j809.onrender.com',
    icon: House,
  },
  {
    id: 'budget',
    name: 'Budget',
    description: 'Track expenses and income',
    url: 'https://web-budget-xhsg.onrender.com',
    icon: ChartColumn,
  },
  {
    id: 'todo',
    name: 'Tasks',
    description: 'Eisenhower matrix task list',
    url: 'https://web-todo-7ftt.onrender.com',
    icon: SquareCheckBig,
  },
  {
    id: 'freelance',
    name: 'Freelance',
    description: 'Time tracking and invoices',
    url: 'https://web-freelance.onrender.com',
    icon: Briefcase,
  },
  {
    id: 'immo',
    name: 'Immo',
    description: 'Loans, rent and property costs',
    url: 'https://web-immo-w4dd.onrender.com',
    icon: Building2,
  },
  {
    id: 'portfolio',
    name: 'Portfolio',
    description: 'Net worth, assets and dividends',
    url: 'https://web-portfolio-ehlv.onrender.com',
    icon: Wallet,
  },
  {
    id: 'wishlist',
    name: 'Wishlist',
    description: 'Products you want and what they cost now',
    url: 'https://web-wishlist.onrender.com',
    icon: Gift,
  },
];
