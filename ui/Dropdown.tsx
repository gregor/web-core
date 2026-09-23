import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { Check, ChevronDown, X } from 'lucide-react';

export interface DropdownOption<T extends string = string> {
  value: T;
  label: string;
  /** Rendered before the label, in the list and in the trigger (e.g. a coloured category icon). */
  icon?: ReactNode;
}

interface PopoverPosition {
  top: number;
  left: number;
  minWidth: number;
  maxHeight: number;
}

const triggerBase =
  'inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-3 py-2 text-sm text-left text-slate-700 dark:text-slate-200 transition-colors cursor-pointer hover:border-slate-300 dark:hover:border-slate-600 outline-none focus-visible:border-accent-500 focus-visible:ring-2 focus-visible:ring-accent-500/10 disabled:cursor-not-allowed disabled:opacity-50';

/**
 * The wrapper's default width, dropped as soon as the caller sets one. Both on the same
 * element would conflict, and Tailwind's output order, not the class order, decides
 * which wins; a trigger-side min-width could not be overridden at all.
 */
function widthClass(className: string) {
  return /(^|\s)(min-)?w-/.test(className) ? className : `min-w-36 ${className}`;
}

const optionBase = 'w-full flex items-center gap-2 px-3 py-2 text-sm text-left cursor-pointer outline-none';

/**
 * The open/close, positioning and keyboard handling both dropdowns share.
 *
 * The list is `position: fixed`, measured from the trigger, so it is never clipped
 * by a table's or dialog's `overflow`. That position goes stale when anything
 * scrolls, so the list closes on scroll and resize instead of drifting away.
 */
function usePopover(optionCount: number, initialIndex: () => number) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [position, setPosition] = useState<PopoverPosition | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return setPosition(null);
    const rect = triggerRef.current.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom - 8;
    setPosition({
      top: rect.bottom + 4,
      left: rect.left,
      minWidth: rect.width,
      maxHeight: Math.max(120, Math.min(below, 320)),
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onScroll(e: Event) {
      if (!listRef.current?.contains(e.target as Node)) setOpen(false);
    }
    const onResize = () => setOpen(false);
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('scroll', onScroll, { capture: true, passive: true });
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('scroll', onScroll, { capture: true });
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  useEffect(() => {
    // Optional call: jsdom, where the apps' tests run, has no scrollIntoView.
    if (open && active >= 0) {
      listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView?.({ block: 'nearest' });
    }
  }, [open, active]);

  function show() {
    setActive(initialIndex());
    setOpen(true);
  }

  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  /** Keys on the trigger. Returns true when the key was handled. `pick` acts on the active option. */
  function onKeyDown(e: ReactKeyboardEvent, pick: (index: number) => void) {
    const last = optionCount - 1;
    const keys: Record<string, () => void> = {
      ArrowDown: () => (open ? setActive((i) => (i >= last ? 0 : i + 1)) : show()),
      ArrowUp: () => (open ? setActive((i) => (i <= 0 ? last : i - 1)) : show()),
      Home: () => open && setActive(0),
      End: () => open && setActive(last),
      Enter: () => (open ? active >= 0 && pick(active) : show()),
      ' ': () => (open ? active >= 0 && pick(active) : show()),
      Escape: () => open && close(),
      Tab: () => open && setOpen(false),
    };
    const handler = keys[e.key];
    if (!handler) return;
    if (e.key !== 'Tab') e.preventDefault();
    // Escape on an open list closes only the list, not a dialog it sits in.
    if (e.key === 'Escape' && open) e.stopPropagation();
    handler();
  }

  const listStyle = position
    ? { top: position.top, left: position.left, minWidth: position.minWidth, maxHeight: position.maxHeight }
    : undefined;

  return {
    open,
    setOpen,
    active,
    setActive,
    show,
    close,
    onKeyDown,
    wrapperRef,
    triggerRef,
    listRef,
    listId,
    listStyle,
  };
}

function Popover({
  id,
  label,
  multiple,
  style,
  listRef,
  children,
}: {
  id: string;
  label: string;
  multiple?: boolean;
  style: CSSProperties | undefined;
  listRef: RefObject<HTMLDivElement | null>;
  children: ReactNode;
}) {
  if (!style) return null;
  return (
    <div
      ref={listRef}
      id={id}
      role="listbox"
      aria-label={label}
      aria-multiselectable={multiple || undefined}
      // Inside a <label> (as in Field) a click on an option would be forwarded to the
      // trigger and reopen or close the list; cancelling the default stops that.
      onClick={(e) => e.preventDefault()}
      style={{ position: 'fixed', ...style }}
      className="z-[60] max-w-80 overflow-y-auto overscroll-contain rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-1 shadow-lg"
    >
      {children}
    </div>
  );
}

function ClearButton({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClear}
      className="absolute right-8 top-1/2 -translate-y-1/2 flex h-4 w-4 items-center justify-center rounded-full bg-slate-200 text-slate-500 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-400 dark:hover:bg-slate-600 cursor-pointer"
    >
      <X size={10} strokeWidth={2.5} />
    </button>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <ChevronDown
      size={14}
      aria-hidden
      className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
    />
  );
}

export interface DropdownProps<T extends string> {
  options: readonly DropdownOption<T>[];
  value: T | '';
  onChange: (value: T | '') => void;
  /** Shown while nothing is selected, and the list's accessible name. */
  placeholder: string;
  /** Adds a × that resets the value to '' — its accessible name, e.g. "Filter entfernen". */
  clearLabel?: string;
  disabled?: boolean;
  /** Classes on the wrapper. A width (`w-full`, `w-40`, `min-w-0`) replaces the default `min-w-36`. */
  className?: string;
  /** Accessible name of the trigger when there is no visible label next to it. */
  'aria-label'?: string;
}

/**
 * A single-choice dropdown with a styled list. For a plain form field the native
 * `Select` is simpler and better on phones; use this where options carry icons, or
 * where the list has to match the app (filters, compact toolbars).
 */
export function Dropdown<T extends string>({
  options,
  value,
  onChange,
  placeholder,
  clearLabel,
  disabled,
  className = '',
  'aria-label': ariaLabel,
}: DropdownProps<T>) {
  const selectedIndex = options.findIndex((o) => o.value === value);
  const {
    open,
    setOpen,
    active,
    setActive,
    show,
    close,
    onKeyDown,
    wrapperRef,
    triggerRef,
    listRef,
    listId,
    listStyle,
  } = usePopover(options.length, () => Math.max(0, selectedIndex));
  const selected = options[selectedIndex];
  const showClear = !!clearLabel && value !== '' && !disabled;

  function pick(index: number) {
    const option = options[index];
    if (option) onChange(option.value);
    close();
  }

  return (
    <div ref={wrapperRef} className={`relative inline-block ${widthClass(className)}`}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        aria-label={ariaLabel}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={(e) => onKeyDown(e, pick)}
        className={`${triggerBase} w-full ${showClear ? 'pr-14' : 'pr-9'}`}
      >
        {selected?.icon && <span className="shrink-0">{selected.icon}</span>}
        <span className={`flex-1 truncate ${selected ? '' : 'text-slate-400 dark:text-slate-500'}`}>
          {selected?.label ?? placeholder}
        </span>
      </button>
      {showClear && <ClearButton label={clearLabel} onClear={() => onChange('')} />}
      <Chevron open={open} />

      {open && (
        <Popover id={listId} label={ariaLabel ?? placeholder} style={listStyle} listRef={listRef}>
          {options.map((option, i) => {
            const isSelected = i === selectedIndex;
            return (
              <div
                key={option.value}
                id={`${listId}-${i}`}
                data-index={i}
                role="option"
                aria-selected={isSelected}
                onPointerMove={() => setActive(i)}
                // mousedown would blur the trigger first and move focus to the body.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(i)}
                className={`${optionBase} ${i === active ? 'bg-slate-50 dark:bg-slate-700/50' : ''} ${
                  isSelected ? 'text-accent-700 dark:text-accent-300 font-medium' : 'text-slate-700 dark:text-slate-200'
                }`}
              >
                {option.icon && <span className="shrink-0">{option.icon}</span>}
                <span className="flex-1 truncate">{option.label}</span>
                {isSelected && <Check size={14} className="shrink-0 text-accent-600 dark:text-accent-400" />}
              </div>
            );
          })}
        </Popover>
      )}
    </div>
  );
}

export interface MultiDropdownProps<T extends string> {
  options: readonly DropdownOption<T>[];
  selected: ReadonlySet<T>;
  onChange: (selected: Set<T>) => void;
  /** Shown while nothing is selected (e.g. "Alle Kategorien"), and the list's accessible name. */
  placeholder: string;
  /**
   * What the trigger says once something is selected:
   * - a function, e.g. `(n) => `${n} Kategorien`` — one selection still shows its label
   * - omitted — the placeholder stays, with a count badge next to it
   */
  summary?: (count: number) => string;
  /** Adds a × that clears the selection — its accessible name. */
  clearLabel?: string;
  /** Shown in the list when there are no options. */
  emptyLabel?: string;
  disabled?: boolean;
  /** Classes on the wrapper. A width (`w-full`, `w-40`, `min-w-0`) replaces the default `min-w-36`. */
  className?: string;
}

/** A dropdown of checkboxes. The list stays open while options are toggled. */
export function MultiDropdown<T extends string>({
  options,
  selected,
  onChange,
  placeholder,
  summary,
  clearLabel,
  emptyLabel,
  disabled,
  className = '',
}: MultiDropdownProps<T>) {
  const { open, setOpen, active, setActive, show, onKeyDown, wrapperRef, triggerRef, listRef, listId, listStyle } =
    usePopover(options.length, () => 0);
  const count = selected.size;
  const showClear = !!clearLabel && count > 0 && !disabled;

  function toggle(index: number) {
    const option = options[index];
    if (!option) return;
    const next = new Set(selected);
    if (next.has(option.value)) next.delete(option.value);
    else next.add(option.value);
    onChange(next);
  }

  let text = placeholder;
  if (count > 0 && summary) {
    text = count === 1 ? (options.find((o) => selected.has(o.value))?.label ?? summary(1)) : summary(count);
  }

  return (
    <div ref={wrapperRef} className={`relative inline-block ${widthClass(className)}`}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={(e) => onKeyDown(e, toggle)}
        className={`${triggerBase} w-full ${showClear ? 'pr-14' : 'pr-9'}`}
      >
        <span className={`flex-1 truncate ${count === 0 ? 'text-slate-400 dark:text-slate-500' : ''}`}>{text}</span>
        {count > 0 && !summary && (
          <span className="shrink-0 rounded-full bg-accent-100 px-1.5 py-0.5 text-xs font-medium leading-none text-accent-700 dark:bg-accent-900/40 dark:text-accent-300">
            {count}
          </span>
        )}
      </button>
      {showClear && <ClearButton label={clearLabel} onClear={() => onChange(new Set())} />}
      <Chevron open={open} />

      {open && (
        <Popover id={listId} label={placeholder} multiple style={listStyle} listRef={listRef}>
          {options.length === 0 && emptyLabel && (
            <p className="px-3 py-2 text-sm italic text-slate-400">{emptyLabel}</p>
          )}
          {options.map((option, i) => {
            const checked = selected.has(option.value);
            return (
              <div
                key={option.value}
                id={`${listId}-${i}`}
                data-index={i}
                role="option"
                aria-selected={checked}
                onPointerMove={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => toggle(i)}
                className={`${optionBase} text-slate-700 dark:text-slate-200 ${i === active ? 'bg-slate-50 dark:bg-slate-700/50' : ''}`}
              >
                <span
                  aria-hidden
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                    checked ? 'border-accent-600 bg-accent-600' : 'border-slate-300 dark:border-slate-600'
                  }`}
                >
                  {checked && <Check size={10} strokeWidth={3} className="text-white" />}
                </span>
                {option.icon && <span className="shrink-0">{option.icon}</span>}
                <span className="flex-1 truncate">{option.label}</span>
              </div>
            );
          })}
        </Popover>
      )}
    </div>
  );
}
