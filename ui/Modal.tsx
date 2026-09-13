import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { IconButton } from './Button.js';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Accessible name of the × button, e.g. "Schließen" or "Close". */
  closeLabel: string;
  children: ReactNode;
  /** Right-aligned action row below the body, typically Cancel + Save buttons. */
  footer?: ReactNode;
  size?: 'md' | 'lg' | 'xl';
}

const widths = { md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

const FOCUSABLE =
  'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

/**
 * A dialog over a dimmed backdrop. It closes on Escape and on a click on the
 * backdrop. On open, focus moves to the first field (or the panel) and Tab is kept
 * inside; on close, focus goes back to whatever opened it.
 */
export function Modal({ open, onClose, title, closeLabel, children, footer, size = 'md' }: ModalProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  // Held in a ref so a parent re-rendering with a new inline onClose doesn't re-run
  // the effect below, which would steal focus back to the first field mid-typing.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const panel = panelRef.current!;
    // Skip the × in the header: landing on the first field is what the user wants.
    const first = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].find((el) => !el.dataset.modalClose);
    (first ?? panel).focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (items.length === 0) return e.preventDefault();
      const firstItem = items[0]!;
      const lastItem = items[items.length - 1]!;
      if (e.shiftKey && (document.activeElement === firstItem || document.activeElement === panel)) {
        e.preventDefault();
        lastItem.focus();
      } else if (!e.shiftKey && document.activeElement === lastItem) {
        e.preventDefault();
        firstItem.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      opener?.focus();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 p-4 overflow-auto"
      // mousedown, not click: a text selection dragged out of a field onto the
      // backdrop ends in a click there, and must not throw the form away.
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`mt-10 w-full ${widths[size]} rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl outline-none`}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700">
          <h2 id={titleId} className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            {title}
          </h2>
          <IconButton label={closeLabel} icon={<X size={18} />} onClick={onClose} data-modal-close="true" />
        </div>
        <div className="p-6 space-y-4">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 dark:border-slate-700">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
