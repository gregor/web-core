// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { useState, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, renderHook, act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Check } from 'lucide-react';
import {
  AppShell,
  Button,
  ConfirmProvider,
  EnvCheckGate,
  GoogleConnectGate,
  PasswordGate,
  useConfirm,
  Dropdown,
  Field,
  IconButton,
  Input,
  Modal,
  MultiDropdown,
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

describe('IconButton tone', () => {
  it('turns the hover red for danger', () => {
    render(<IconButton label="Löschen" icon={<svg />} tone="danger" />);
    expect(screen.getByRole('button', { name: 'Löschen' })).toHaveClass('hover:text-rose-500');
  });
});

describe('useSort firstDir', () => {
  it('starts a column in the direction firstDir gives it', () => {
    const firstDir = (key: string) => (key === 'amount' ? 'desc' : 'asc');
    const { result } = renderHook(() => useSort<'name' | 'amount'>({ key: 'name', dir: 'asc' }, { firstDir }));
    act(() => result.current.toggle('amount'));
    expect(result.current.sort).toEqual({ key: 'amount', dir: 'desc' });
    act(() => result.current.toggle('amount'));
    expect(result.current.sort).toEqual({ key: 'amount', dir: 'asc' });
    act(() => result.current.toggle('name'));
    expect(result.current.sort).toEqual({ key: 'name', dir: 'asc' });
  });
});

const FRUIT = [
  { value: 'apple', label: 'Apfel' },
  { value: 'pear', label: 'Birne' },
  { value: 'plum', label: 'Pflaume' },
] as const;

function DropdownHarness({ clearLabel }: { clearLabel?: string }) {
  const [value, setValue] = useState<'' | 'apple' | 'pear' | 'plum'>('');
  return (
    <>
      <Dropdown options={FRUIT} value={value} onChange={setValue} placeholder="Obst" clearLabel={clearLabel} />
      <output>{value}</output>
    </>
  );
}

describe('Dropdown', () => {
  it('opens a listbox and picks an option by click', async () => {
    const user = userEvent.setup();
    render(<DropdownHarness />);
    const trigger = screen.getByRole('button', { name: 'Obst' });
    expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await user.click(screen.getByRole('option', { name: 'Birne' }));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('pear');
    expect(trigger).toHaveTextContent('Birne');
    expect(trigger).toHaveFocus();
  });

  it('is operable by keyboard', async () => {
    const user = userEvent.setup();
    render(<DropdownHarness />);
    screen.getByRole('button', { name: 'Obst' }).focus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    expect(screen.getByRole('status')).toHaveTextContent('plum');
  });

  it('marks the selected option and clears through its own button', async () => {
    const user = userEvent.setup();
    render(<DropdownHarness clearLabel="Auswahl entfernen" />);
    expect(screen.queryByRole('button', { name: 'Auswahl entfernen' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Obst' }));
    await user.click(screen.getByRole('option', { name: 'Apfel' }));
    await user.click(screen.getByRole('button', { name: 'Apfel' }));
    expect(screen.getByRole('option', { name: 'Apfel' })).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Auswahl entfernen' }));
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('closes on Escape without closing the dialog around it', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Modal open onClose={onClose} title="Dialog" closeLabel="Schließen">
        <DropdownHarness />
      </Modal>,
    );
    await user.click(screen.getByRole('button', { name: 'Obst' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes on a click outside', async () => {
    const user = userEvent.setup();
    render(
      <>
        <DropdownHarness />
        <p>draußen</p>
      </>,
    );
    await user.click(screen.getByRole('button', { name: 'Obst' }));
    await user.click(screen.getByText('draußen'));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});

function MultiHarness({ summary }: { summary?: (n: number) => string }) {
  const [selected, setSelected] = useState<Set<'apple' | 'pear' | 'plum'>>(new Set());
  return (
    <MultiDropdown
      options={FRUIT}
      selected={selected}
      onChange={setSelected}
      placeholder="Alle Sorten"
      summary={summary}
      clearLabel="Filter entfernen"
    />
  );
}

describe('MultiDropdown', () => {
  it('toggles options and stays open', async () => {
    const user = userEvent.setup();
    render(<MultiHarness summary={(n) => `${n} Sorten`} />);
    const trigger = screen.getByRole('button', { name: 'Alle Sorten' });
    await user.click(trigger);
    expect(screen.getByRole('listbox')).toHaveAttribute('aria-multiselectable', 'true');
    await user.click(screen.getByRole('option', { name: 'Apfel' }));
    expect(trigger).toHaveTextContent('Apfel');
    await user.click(screen.getByRole('option', { name: 'Pflaume' }));
    expect(trigger).toHaveTextContent('2 Sorten');
    expect(screen.getByRole('option', { name: 'Pflaume' })).toHaveAttribute('aria-selected', 'true');
    await user.click(screen.getByRole('option', { name: 'Apfel' }));
    expect(trigger).toHaveTextContent('Pflaume');
  });

  it('shows a count badge without a summary, and clears', async () => {
    const user = userEvent.setup();
    render(<MultiHarness />);
    const trigger = screen.getByRole('button', { name: 'Alle Sorten' });
    trigger.focus();
    await user.keyboard('{ArrowDown}{Enter}{ArrowDown}{Enter}');
    expect(trigger).toHaveTextContent('Alle Sorten2');
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Filter entfernen' }));
    expect(trigger).toHaveTextContent('Alle Sorten');
    expect(screen.queryByRole('button', { name: 'Filter entfernen' })).not.toBeInTheDocument();
  });
});

describe('Dropdown width', () => {
  it('has a default min width that a caller-set width replaces', () => {
    const { container, rerender } = render(
      <Dropdown options={FRUIT} value="" onChange={() => {}} placeholder="Obst" />,
    );
    expect(container.firstChild).toHaveClass('min-w-36');
    rerender(<Dropdown options={FRUIT} value="" onChange={() => {}} placeholder="Obst" className="w-full" />);
    expect(container.firstChild).toHaveClass('w-full');
    expect(container.firstChild).not.toHaveClass('min-w-36');
    expect(screen.getByRole('button', { name: 'Obst' })).not.toHaveClass('min-w-36');
  });
});

const NAV = [
  { to: '/', label: 'Übersicht', icon: Check },
  { to: '/loans', label: 'Darlehen', icon: Check },
] as const;

const SHELL_LABELS = {
  navigation: 'Hauptnavigation',
  collapse: 'Einklappen',
  expand: 'Ausklappen',
  lightMode: 'Hellmodus',
  darkMode: 'Dunkelmodus',
};

function shell(props: Partial<Parameters<typeof AppShell>[0]> = {}) {
  return render(
    <MemoryRouter initialEntries={['/loans']}>
      <AppShell
        app={{ id: 'immo', icon: <svg data-testid="brand" />, label: 'Immobilien' }}
        nav={NAV}
        settings={{ to: '/settings', label: 'Einstellungen', icon: Check }}
        labels={SHELL_LABELS}
        {...props}
      >
        <p>Seiteninhalt</p>
      </AppShell>
    </MemoryRouter>,
  );
}

describe('AppShell', () => {
  beforeEach(() => localStorage.clear());

  it('renders the brand, the nav and the page, and marks the active link', () => {
    shell();
    expect(screen.getByTestId('brand')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Hauptnavigation' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Darlehen' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Übersicht' })).not.toHaveAttribute('aria-current');
    expect(screen.getByText('Seiteninhalt')).toBeInTheDocument();
  });

  it('collapses, hides the labels and remembers it', async () => {
    const user = userEvent.setup();
    const { unmount } = shell({ storageKey: 'wi_sidebar_collapsed' });
    await user.click(screen.getByRole('button', { name: 'Einklappen' }));
    expect(screen.getByRole('button', { name: 'Ausklappen' })).toHaveAttribute('aria-expanded', 'false');
    // The link keeps its name through aria-label once the text is hidden.
    expect(screen.getByRole('link', { name: 'Darlehen' })).toBeInTheDocument();
    expect(localStorage.getItem('wi_sidebar_collapsed')).toBe('true');

    unmount();
    shell({ storageKey: 'wi_sidebar_collapsed' });
    expect(screen.getByRole('button', { name: 'Ausklappen' })).toBeInTheDocument();
  });

  it('hands the collapsed state to the top and footer slots', async () => {
    const user = userEvent.setup();
    shell({
      top: (collapsed: boolean) => <button>{collapsed ? '+' : 'Neuer Eintrag'}</button>,
      footer: (collapsed: boolean) => <p>{collapsed ? 'P' : 'Profil'}</p>,
    });
    expect(screen.getByRole('button', { name: 'Neuer Eintrag' })).toBeInTheDocument();
    expect(screen.getByText('Profil')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Einklappen' }));
    expect(screen.getByRole('button', { name: '+' })).toBeInTheDocument();
    expect(screen.getByText('P')).toBeInTheDocument();
  });

  it('toggles dark mode on the document', async () => {
    const user = userEvent.setup();
    shell();
    const before = document.documentElement.classList.contains('dark');
    await user.click(screen.getByRole('button', { name: before ? 'Hellmodus' : 'Dunkelmodus' }));
    expect(document.documentElement.classList.contains('dark')).toBe(!before);
  });
});

const PASSWORD_LABELS = {
  title: 'Anmelden',
  password: 'Passwort',
  submit: 'Anmelden',
  wrong: 'Falsches Passwort.',
  unreachable: 'Server nicht erreichbar.',
  showPassword: 'Passwort anzeigen',
  hidePassword: 'Passwort verbergen',
};

/** Answers the gate's endpoints; every other URL rejects. */
function mockFetch(routes: Record<string, { ok?: boolean; body?: unknown }>) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL) => {
    const url = String(input);
    const route = Object.entries(routes).find(([path]) => url.startsWith(path))?.[1];
    if (!route) return Promise.reject(new Error(`unexpected fetch: ${url}`));
    return Promise.resolve({
      ok: route.ok ?? true,
      json: () => Promise.resolve(route.body ?? {}),
    } as Response);
  });
}

describe('PasswordGate', () => {
  afterEach(() => vi.restoreAllMocks());

  it('renders the app when the session says authenticated', async () => {
    mockFetch({ '/api/auth/me': { body: { authenticated: true } } });
    render(<PasswordGate labels={PASSWORD_LABELS}>geheim</PasswordGate>);
    expect(await screen.findByText('geheim')).toBeInTheDocument();
  });

  it('passes the role to function children', async () => {
    mockFetch({ '/api/auth/me': { body: { role: 'gregor' } } });
    render(<PasswordGate labels={PASSWORD_LABELS}>{(me) => <p>Rolle: {String(me.role)}</p>}</PasswordGate>);
    expect(await screen.findByText('Rolle: gregor')).toBeInTheDocument();
  });

  it('signs in with the right password and complains about a wrong one', async () => {
    const user = userEvent.setup();
    mockFetch({ '/api/auth/me': { body: { role: null } }, '/api/auth/login': { ok: false } });
    render(<PasswordGate labels={PASSWORD_LABELS}>geheim</PasswordGate>);

    const field = await screen.findByLabelText('Passwort');
    await user.type(field, 'falsch');
    await user.click(screen.getByRole('button', { name: 'Anmelden' }));
    expect(await screen.findByText('Falsches Passwort.')).toBeInTheDocument();
    expect(screen.queryByText('geheim')).not.toBeInTheDocument();

    mockFetch({ '/api/auth/login': { body: { role: 'couple' } } });
    await user.click(screen.getByRole('button', { name: 'Anmelden' }));
    expect(await screen.findByText('geheim')).toBeInTheDocument();
  });

  it('can reveal the password, and the toggle has a name', async () => {
    const user = userEvent.setup();
    mockFetch({ '/api/auth/me': { body: {} } });
    render(<PasswordGate labels={PASSWORD_LABELS}>geheim</PasswordGate>);
    const field = await screen.findByLabelText('Passwort');
    expect(field).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'Passwort anzeigen' }));
    expect(field).toHaveAttribute('type', 'text');
  });
});

const GOOGLE_LABELS = {
  subtitle: 'Mit Google verbinden',
  connect: 'Mit Google verbinden',
  setupToggle: 'Einrichtung',
  setupTitle: 'Anleitung',
  consoleLink: 'Google Cloud Console',
  configErrorTitle: 'Konfigurationsfehler',
  configErrorBody: 'Diese Variablen fehlen:',
  configErrorHint: 'Nach dem Setzen den Server neu starten.',
};

describe('GoogleConnectGate', () => {
  afterEach(() => vi.restoreAllMocks());

  const gate = (extra = {}) => (
    <GoogleConnectGate
      app={{ icon: <svg />, title: 'Immobilien' }}
      connectHref="/api/auth"
      labels={GOOGLE_LABELS}
      setupSteps={['Projekt anlegen', 'API aktivieren']}
      {...extra}
    >
      <p>verbunden</p>
    </GoogleConnectGate>
  );

  it('renders the app once connected', async () => {
    mockFetch({ '/api/auth/status': { body: { connected: true, credentialsConfigured: true } } });
    render(gate());
    expect(await screen.findByText('verbunden')).toBeInTheDocument();
  });

  it('offers the connect button and the setup steps', async () => {
    const user = userEvent.setup();
    mockFetch({ '/api/auth/status': { body: { connected: false, credentialsConfigured: true } } });
    render(gate());
    expect(await screen.findByRole('button', { name: /Mit Google verbinden/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Einrichtung' }));
    expect(screen.getByText('Projekt anlegen')).toBeInTheDocument();
  });

  it('names the missing variables, including app-specific ones', async () => {
    mockFetch({
      '/api/auth/status': { body: { connected: false, credentialsConfigured: false, sheetConfigured: false } },
    });
    render(
      gate({
        requiredVars: (s: { credentialsConfigured: boolean; sheetConfigured?: boolean }) =>
          [!s.credentialsConfigured && 'GOOGLE_CREDENTIALS_JSON', !s.sheetConfigured && 'GSHEET_ID'].filter(
            Boolean,
          ) as string[],
      }),
    );
    expect(await screen.findByText('Konfigurationsfehler')).toBeInTheDocument();
    expect(screen.getByText('GOOGLE_CREDENTIALS_JSON')).toBeInTheDocument();
    expect(screen.getByText('GSHEET_ID')).toBeInTheDocument();
  });
});

const ENV_LABELS = {
  title: 'Konfigurationsfehler',
  body: 'Die App kann nicht starten.',
  hint: 'Server neu starten.',
  missing: 'Fehlt',
  invalid: 'Ungültig',
  warn: 'Warnung',
  ok: 'OK',
};

describe('EnvCheckGate', () => {
  afterEach(() => vi.restoreAllMocks());

  it('renders the app when the check passes', async () => {
    mockFetch({ '/api/env-check': { body: { ok: true, checks: [] } } });
    render(<EnvCheckGate labels={ENV_LABELS}>läuft</EnvCheckGate>);
    expect(await screen.findByText('läuft')).toBeInTheDocument();
  });

  it('lists the failing variables and their messages', async () => {
    mockFetch({
      '/api/env-check': {
        body: {
          ok: false,
          checks: [
            { key: 'AUTH_SECRET', status: 'missing', message: 'Passwort für den Login' },
            { key: 'SESSION_SECRET', status: 'warn' },
          ],
        },
      },
    });
    render(<EnvCheckGate labels={ENV_LABELS}>läuft</EnvCheckGate>);
    expect(await screen.findByText('AUTH_SECRET')).toBeInTheDocument();
    expect(screen.getByText('Passwort für den Login')).toBeInTheDocument();
    expect(screen.getByText('Fehlt')).toBeInTheDocument();
    expect(screen.getByText('Warnung')).toBeInTheDocument();
    expect(screen.queryByText('läuft')).not.toBeInTheDocument();
  });

  it('lets the app through when the server cannot be reached', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    render(<EnvCheckGate labels={ENV_LABELS}>läuft</EnvCheckGate>);
    expect(await screen.findByText('läuft')).toBeInTheDocument();
  });
});

function ConfirmHarness({ options }: { options?: Partial<Parameters<ReturnType<typeof useConfirm>>[0]> }) {
  const confirm = useConfirm();
  const [result, setResult] = useState('—');
  return (
    <>
      <button
        onClick={() =>
          void confirm({ title: 'Eintrag löschen?', danger: true, ...options }).then((ok) => setResult(String(ok)))
        }
      >
        Löschen
      </button>
      <output>{result}</output>
    </>
  );
}

const withProvider = (ui: ReactNode) => (
  <ConfirmProvider labels={{ confirm: 'Löschen', cancel: 'Abbrechen', close: 'Schließen' }}>{ui}</ConfirmProvider>
);

describe('useConfirm', () => {
  it('resolves true only when confirmed, and focuses Cancel', async () => {
    const user = userEvent.setup();
    render(withProvider(<ConfirmHarness options={{ message: 'Das kann nicht rückgängig gemacht werden.' }} />));
    await user.click(screen.getByRole('button', { name: 'Löschen' }));

    const dialog = screen.getByRole('dialog', { name: 'Eintrag löschen?' });
    expect(within(dialog).getByText('Das kann nicht rückgängig gemacht werden.')).toBeInTheDocument();
    // Enter must not delete: focus sits on Cancel, not on the red button.
    expect(within(dialog).getByRole('button', { name: 'Abbrechen' })).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(screen.getByRole('status')).toHaveTextContent('false');

    await user.click(screen.getByRole('button', { name: 'Löschen' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Löschen' }));
    expect(screen.getByRole('status')).toHaveTextContent('true');
  });

  it('resolves false on Escape', async () => {
    const user = userEvent.setup();
    render(withProvider(<ConfirmHarness />));
    await user.click(screen.getByRole('button', { name: 'Löschen' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('false');
  });

  it('uses per-call labels and the danger variant', async () => {
    const user = userEvent.setup();
    render(withProvider(<ConfirmHarness options={{ confirmLabel: 'Trotzdem exportieren', danger: false }} />));
    await user.click(screen.getByRole('button', { name: 'Löschen' }));
    const button = screen.getByRole('button', { name: 'Trotzdem exportieren' });
    expect(button).toHaveClass('bg-accent-600');
  });
});
