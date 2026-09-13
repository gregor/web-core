// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, renderHook, act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  Button,
  Field,
  IconButton,
  Input,
  Modal,
  SortableTh,
  ThemeToggle,
  compareValues,
  formatDateDE,
  formatEUR,
  formatNumber,
  useSort,
} from '../ui/index.js';

// No vitest globals here, so Testing Library cannot register its own cleanup.
afterEach(cleanup);

describe('Button', () => {
  it('defaults to type="button", so it never submits a form by accident', async () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Button>Abbrechen</Button>
      </form>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('applies the variant and forwards native props', () => {
    render(
      <Button variant="danger" form="f" data-x="1">
        Löschen
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Löschen' });
    expect(button).toHaveClass('bg-rose-600');
    expect(button).toHaveAttribute('form', 'f');
  });

  it('is disabled and busy while pending, keeping its label for width', async () => {
    const onClick = vi.fn();
    render(
      <Button pending onClick={onClick}>
        Speichern
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Speichern' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('gives an IconButton its label as accessible name and tooltip', () => {
    render(<IconButton label="Bearbeiten" icon={<svg />} />);
    expect(screen.getByRole('button', { name: 'Bearbeiten' })).toHaveAttribute('title', 'Bearbeiten');
  });
});

describe('Field', () => {
  it('labels its control', () => {
    render(
      <Field label="Firma" hint="Wie auf der Rechnung">
        <Input />
      </Field>,
    );
    expect(screen.getByLabelText('Firma')).toBeInstanceOf(HTMLInputElement);
    expect(screen.getByText('Wie auf der Rechnung')).toBeInTheDocument();
  });
});

function ModalHarness({ onClose = () => {} }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Öffnen</button>
      <Modal
        open={open}
        onClose={() => {
          onClose();
          setOpen(false);
        }}
        title="Neuer Eintrag"
        closeLabel="Schließen"
        footer={<Button>Speichern</Button>}
      >
        <input aria-label="Name" />
      </Modal>
    </>
  );
}

describe('Modal', () => {
  it('is a labelled dialog that focuses its first field, not the ×', async () => {
    render(<ModalHarness />);
    await userEvent.click(screen.getByRole('button', { name: 'Öffnen' }));
    expect(screen.getByRole('dialog', { name: 'Neuer Eintrag' })).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByLabelText('Name')).toHaveFocus();
  });

  it('closes on Escape and returns focus to the opener', async () => {
    const user = userEvent.setup();
    render(<ModalHarness />);
    const opener = screen.getByRole('button', { name: 'Öffnen' });
    await user.click(opener);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it('keeps Tab inside the dialog', async () => {
    const user = userEvent.setup();
    render(<ModalHarness />);
    await user.click(screen.getByRole('button', { name: 'Öffnen' }));
    // Order: × (header), Name, Speichern. Tab from the last wraps to the first.
    await user.tab();
    expect(screen.getByRole('button', { name: 'Speichern' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Schließen' })).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Speichern' })).toHaveFocus();
  });

  it('closes on a backdrop click but not on a click inside', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<ModalHarness onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'Öffnen' }));
    await user.click(screen.getByLabelText('Name'));
    expect(onClose).not.toHaveBeenCalled();
    await user.click(screen.getByRole('dialog').parentElement!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

const table = (ui: React.ReactNode) =>
  render(
    <table>
      <thead>
        <tr>{ui}</tr>
      </thead>
    </table>,
  );

describe('SortableTh', () => {
  it('is a button, so the column is reachable by keyboard', async () => {
    const onClick = vi.fn();
    table(<SortableTh label="Startpreis" active={false} direction="asc" onClick={onClick} />);
    const button = screen.getByRole('button', { name: /Startpreis/ });
    await userEvent.click(button);
    button.focus();
    await userEvent.keyboard('{Enter}');
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it('tells a screen reader which column the order comes from', () => {
    const { container } = table(
      <>
        <SortableTh label="Firma" active direction="desc" onClick={() => {}} />
        <SortableTh label="Produkt" active={false} direction="asc" onClick={() => {}} />
      </>,
    );
    const headers = container.querySelectorAll('th');
    expect(headers[0]).toHaveAttribute('aria-sort', 'descending');
    expect(headers[1]).toHaveAttribute('aria-sort', 'none');
  });
});

describe('useSort', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('flips the active column and starts a new one ascending', () => {
    const { result } = renderHook(() => useSort<'a' | 'b'>({ key: 'a', dir: 'asc' }));
    act(() => result.current.toggle('a'));
    expect(result.current.sort).toEqual({ key: 'a', dir: 'desc' });
    act(() => result.current.toggle('b'));
    expect(result.current.sort).toEqual({ key: 'b', dir: 'asc' });
    expect(result.current.thProps('b')).toMatchObject({ active: true, direction: 'asc' });
  });

  it('remembers the order, and ignores a stored column that no longer exists', () => {
    const keys = ['a', 'b'] as const;
    const first = renderHook(() => useSort({ key: 'a' as const, dir: 'asc' }, { storageKey: 's', keys }));
    act(() => first.result.current.toggle('b'));
    expect(
      renderHook(() => useSort({ key: 'a' as const, dir: 'asc' }, { storageKey: 's', keys })).result.current.sort,
    ).toEqual({ key: 'b', dir: 'asc' });

    localStorage.setItem('s', JSON.stringify({ key: 'gone', dir: 'asc' }));
    expect(
      renderHook(() => useSort({ key: 'a' as const, dir: 'asc' }, { storageKey: 's', keys })).result.current.sort,
    ).toEqual({ key: 'a', dir: 'asc' });
  });

  it('still sorts when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    const { result } = renderHook(() => useSort({ key: 'a', dir: 'asc' }, { storageKey: 's' }));
    act(() => result.current.toggle('a'));
    expect(result.current.sort.dir).toBe('desc');
  });
});

describe('compareValues', () => {
  it('orders numbers, German strings and dates, with blanks last both ways', () => {
    const values = ['Zebra', '', 'Äpfel', null, 'apfel 10', 'apfel 9'];
    // "Äpfel" collates as "apfel", a prefix of the others; "9" before "10" numerically.
    expect([...values].sort((a, b) => compareValues(a, b, 'asc'))).toEqual([
      'Äpfel',
      'apfel 9',
      'apfel 10',
      'Zebra',
      '',
      null,
    ]);
    expect([3, undefined, 20].sort((a, b) => compareValues(a, b, 'desc'))).toEqual([20, 3, undefined]);
    expect(compareValues(new Date(2026, 0, 2), new Date(2026, 0, 1), 'asc')).toBeGreaterThan(0);
  });
});

describe('ThemeToggle', () => {
  it('shows the label for the mode it switches to', () => {
    const props = { onToggle: () => {}, collapsed: false, lightLabel: 'Hellmodus', darkLabel: 'Dunkelmodus' };
    const { rerender } = render(<ThemeToggle isDark={false} {...props} />);
    expect(screen.getByRole('button', { name: 'Dunkelmodus' })).toBeInTheDocument();
    rerender(<ThemeToggle isDark {...props} collapsed />);
    expect(screen.getByRole('button', { name: 'Hellmodus' })).toBeInTheDocument();
  });
});

describe('format', () => {
  // Intl output uses a narrow no-break space before €.
  const plain = (s: string) => s.replace(/\s/g, ' ');

  it('formats euros, numbers and dates the German way', () => {
    expect(plain(formatEUR(1234.5))).toBe('1.234,50 €');
    expect(plain(formatEUR(1234.5, { whole: true }))).toBe('1.235 €');
    expect(formatNumber(1234.5, 2)).toBe('1.234,50');
    expect(formatNumber(0.12345)).toBe('0,123');
    expect(formatDateDE('2026-09-03')).toBe('03.09.2026');
    expect(formatDateDE(new Date(2026, 11, 24))).toBe('24.12.2026');
  });
});
