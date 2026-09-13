import { useCallback, useState } from 'react';
import { ChevronDown, ChevronsUpDown, ChevronUp } from 'lucide-react';

export type SortDirection = 'asc' | 'desc';

export interface SortState<K extends string> {
  key: K;
  dir: SortDirection;
}

/** Clicking the active column flips it; clicking another starts ascending. */
export function nextSort<K extends string>(current: SortState<K>, key: K): SortState<K> {
  if (current.key !== key) return { key, dir: 'asc' };
  return { key, dir: current.dir === 'asc' ? 'desc' : 'asc' };
}

const collator = new Intl.Collator('de', { numeric: true, sensitivity: 'base' });

/**
 * Orders two cell values: numbers numerically, strings with a German, number-aware
 * collation ("Ä" next to "A", "10" after "9"). Empty values (null, undefined, "")
 * go last in both directions, so flipping a column never floods the top with blanks.
 */
export function compareValues(a: unknown, b: unknown, dir: SortDirection): number {
  const aEmpty = a == null || a === '';
  const bEmpty = b == null || b === '';
  if (aEmpty || bEmpty) return aEmpty === bEmpty ? 0 : aEmpty ? 1 : -1;
  const order =
    typeof a === 'number' && typeof b === 'number'
      ? a - b
      : a instanceof Date && b instanceof Date
        ? a.getTime() - b.getTime()
        : collator.compare(String(a), String(b));
  return dir === 'asc' ? order : -order;
}

export interface UseSortOptions<K extends string> {
  /** Remember the order in localStorage under this key. */
  storageKey?: string;
  /** The columns that exist, so a stored order for a removed column falls back to `initial`. */
  keys?: readonly K[];
}

/**
 * Sort state for a table. Returns the current order, `toggle` for a header click,
 * and `thProps(key)` to spread onto a `<SortableTh>`.
 */
export function useSort<K extends string>(initial: SortState<K>, { storageKey, keys }: UseSortOptions<K> = {}) {
  const [sort, setSort] = useState<SortState<K>>(() => {
    if (!storageKey) return initial;
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey) ?? 'null') as SortState<K> | null;
      const validKey = parsed && (!keys || keys.includes(parsed.key));
      return validKey && (parsed.dir === 'asc' || parsed.dir === 'desc') ? parsed : initial;
    } catch {
      return initial;
    }
  });

  const toggle = useCallback(
    (key: K) => {
      setSort((current) => {
        const next = nextSort(current, key);
        if (storageKey) {
          try {
            localStorage.setItem(storageKey, JSON.stringify(next));
          } catch {
            // A browser that refuses storage still sorts; it just forgets.
          }
        }
        return next;
      });
    },
    [storageKey],
  );

  const thProps = (key: K) => ({ active: sort.key === key, direction: sort.dir, onClick: () => toggle(key) });

  return { sort, toggle, thProps };
}

export interface SortableThProps {
  label: string;
  active: boolean;
  direction: SortDirection;
  onClick: () => void;
  align?: 'left' | 'right';
  /** Tooltip, e.g. `Nach ${label} sortieren`. */
  sortLabel?: string;
  className?: string;
}

/**
 * A column header that sorts its table. A button inside the `<th>` (not a click
 * handler on it) makes the column reachable by keyboard, and `aria-sort` tells a
 * screen reader which column the order comes from. Inactive columns keep a faint
 * two-way chevron, so a sortable header is discoverable before anyone clicks it.
 */
export function SortableTh({
  label,
  active,
  direction,
  onClick,
  align = 'left',
  sortLabel,
  className,
}: SortableThProps) {
  const Icon = !active ? ChevronsUpDown : direction === 'asc' ? ChevronUp : ChevronDown;
  return (
    <th
      className={
        className ??
        `px-4 py-3 font-medium text-xs uppercase tracking-wider text-slate-500 ${align === 'right' ? 'text-right' : 'text-left'}`
      }
      aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        onClick={onClick}
        title={sortLabel}
        className={`inline-flex items-center gap-1 uppercase tracking-wider cursor-pointer hover:text-slate-700 dark:hover:text-slate-300 ${
          align === 'right' ? 'flex-row-reverse' : ''
        } ${active ? 'text-slate-700 dark:text-slate-300' : ''}`}
      >
        {label}
        <Icon size={13} className={active ? '' : 'opacity-30'} />
      </button>
    </th>
  );
}
