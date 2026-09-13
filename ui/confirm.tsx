import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button } from './Button.js';
import { Modal } from './Modal.js';

export interface ConfirmOptions {
  title: string;
  /** Optional detail below the title. */
  message?: ReactNode;
  /** Overrides the provider's default, e.g. "Trotzdem exportieren". */
  confirmLabel?: string;
  cancelLabel?: string;
  closeLabel?: string;
  /** Red confirm button, for anything that deletes or cannot be undone. */
  danger?: boolean;
}

export interface ConfirmLabels {
  confirm: string;
  cancel: string;
  close: string;
}

type Confirm = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Confirm | null>(null);

/**
 * Asks the user to confirm, and resolves to true only if they do. Replaces
 * `window.confirm`, which cannot be styled and names the site rather than the action:
 *
 *     if (!(await confirm({ title: 'Eintrag löschen?', danger: true }))) return;
 */
export function useConfirm(): Confirm {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error('useConfirm must be used inside a <ConfirmProvider>');
  return confirm;
}

interface Pending extends ConfirmOptions {
  resolve: (ok: boolean) => void;
}

/** Holds the one confirmation dialog the app uses. Put it inside the router and the gates. */
export function ConfirmProvider({ labels, children }: { labels: ConfirmLabels; children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  const confirm = useCallback<Confirm>(
    (options) =>
      new Promise<boolean>((resolve) => {
        setPending((current) => {
          // A second question replaces the first, which was never answered.
          current?.resolve(false);
          return { ...options, resolve };
        });
      }),
    [],
  );

  function settle(ok: boolean) {
    setPending((current) => {
      current?.resolve(ok);
      return null;
    });
  }

  // The dialog is rendered next to the app, not above it in the tree, so a re-render
  // of the page underneath can't unmount the question that is being asked.
  const value = useMemo(() => confirm, [confirm]);

  return (
    <ConfirmContext value={value}>
      {children}
      <Modal
        open={pending !== null}
        onClose={() => settle(false)}
        title={pending?.title ?? ''}
        closeLabel={pending?.closeLabel ?? labels.close}
        // Cancel, not confirm: a reflexive Enter must never delete anything.
        initialFocus={cancelRef}
        footer={
          <>
            <Button ref={cancelRef} variant="secondary" onClick={() => settle(false)}>
              {pending?.cancelLabel ?? labels.cancel}
            </Button>
            <Button variant={pending?.danger ? 'danger' : 'primary'} onClick={() => settle(true)}>
              {pending?.confirmLabel ?? labels.confirm}
            </Button>
          </>
        }
      >
        {pending?.message && <div className="text-sm text-slate-600 dark:text-slate-300">{pending.message}</div>}
      </Modal>
    </ConfirmContext>
  );
}
