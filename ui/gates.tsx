import { useEffect, useState, type ReactNode } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle, Eye, EyeOff, Info, X } from 'lucide-react';
import { Button } from './Button.js';
import { inputClass } from './Field.js';

/** Google's "G", the same mark in every app's connect screen. */
export function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.039l3.007-2.332z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z"
        fill="#EA4335"
      />
    </svg>
  );
}

/** The centred card every gate screen is built on. */
function GateCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
      <div
        className={`mx-4 w-full max-w-sm rounded-xl border border-slate-200 bg-white p-10 dark:border-slate-700 dark:bg-slate-800 ${className}`}
      >
        {children}
      </div>
    </div>
  );
}

/** The list of environment variables a config-error screen names. */
function VarList({ vars }: { vars: readonly string[] }) {
  return (
    <ul className="mb-4 list-disc space-y-1.5 pl-5">
      {vars.map((v) => (
        <li key={v}>
          <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-800 dark:bg-slate-700 dark:text-slate-200">
            {v}
          </code>
        </li>
      ))}
    </ul>
  );
}

export interface PasswordGateProps {
  labels: {
    title: string;
    password: string;
    submit: string;
    /** Wrong password. */
    wrong: string;
    /** The server could not be reached. */
    unreachable: string;
    showPassword: string;
    hidePassword: string;
  };
  /**
   * The signed-in app. As a function it receives the `/api/auth/me` body, so an app
   * that has roles can put them into its own context.
   */
  children: ReactNode | ((me: AuthMe) => ReactNode);
}

/** What `/api/auth/me` answers. Apps use `role`, `authenticated`, or both. */
export interface AuthMe {
  role?: string | null;
  authenticated?: boolean;
  [key: string]: unknown;
}

const signedIn = (me: AuthMe | null) => !!me && (!!me.role || me.authenticated === true);

/**
 * Blocks the app until the single password is accepted. The password is checked by
 * the server (`POST /api/auth/login`) and never stored in the browser; the session
 * cookie is what keeps the user signed in.
 */
export function PasswordGate({ labels, children }: PasswordGateProps) {
  const [me, setMe] = useState<AuthMe | null | undefined>(undefined);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then((res) => (res.ok ? (res.json() as Promise<AuthMe>) : null))
      .then((data) => setMe(signedIn(data) ? data : null))
      .catch(() => setMe(null));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        const data = (await res.json().catch(() => ({}))) as AuthMe;
        setMe(signedIn(data) ? data : { authenticated: true });
        setPassword('');
      } else {
        setError(labels.wrong);
      }
    } catch {
      setError(labels.unreachable);
    } finally {
      setSubmitting(false);
    }
  }

  // Undefined means the first /me call is still in flight: render nothing rather
  // than flashing the login form at someone who is already signed in.
  if (me === undefined) return null;

  if (me === null) {
    return (
      <GateCard>
        <h1 className="mb-6 text-base font-semibold text-slate-800 dark:text-slate-100">{labels.title}</h1>
        <form onSubmit={(e) => void handleSubmit(e)}>
          <div className="relative mb-3">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError('');
              }}
              placeholder={labels.password}
              aria-label={labels.password}
              autoFocus
              autoComplete="current-password"
              className={`${inputClass} pr-10`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? labels.hidePassword : labels.showPassword}
              title={showPassword ? labels.hidePassword : labels.showPassword}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          {error && <p className="mb-3 text-xs text-rose-500">{error}</p>}
          <Button type="submit" pending={submitting} className="w-full">
            {labels.submit}
          </Button>
        </form>
      </GateCard>
    );
  }

  return <>{typeof children === 'function' ? children(me) : children}</>;
}

/** What `/api/auth/status` answers. `sheetConfigured` only exists in some apps. */
export interface GoogleStatus {
  connected: boolean;
  credentialsConfigured: boolean;
  [key: string]: unknown;
}

export interface GoogleConnectGateProps {
  app: { icon: ReactNode; title: string };
  /** Where the OAuth flow starts, e.g. "/api/auth" or "/api/auth/google". */
  connectHref: string;
  labels: {
    subtitle: string;
    connect: string;
    setupToggle: string;
    setupTitle: string;
    consoleLink: string;
    configErrorTitle: string;
    /** Introduces the list of missing variables. */
    configErrorBody: string;
    configErrorHint: string;
  };
  setupSteps: readonly string[];
  /**
   * Which environment variables the status says are missing. Defaults to
   * GOOGLE_CREDENTIALS_JSON when `credentialsConfigured` is false.
   */
  requiredVars?: (status: GoogleStatus) => string[];
  children: ReactNode;
}

const defaultRequiredVars = (status: GoogleStatus) => (status.credentialsConfigured ? [] : ['GOOGLE_CREDENTIALS_JSON']);

/**
 * Blocks the app until the server holds a Google OAuth token. The token lives on the
 * server; this screen only starts the flow and reports what the server is missing.
 */
export function GoogleConnectGate({
  app,
  connectHref,
  labels,
  setupSteps,
  requiredVars = defaultRequiredVars,
  children,
}: GoogleConnectGateProps) {
  const [status, setStatus] = useState<GoogleStatus | null>(null);
  const [showInfo, setShowInfo] = useState(false);

  useEffect(() => {
    // Drop the ?google marker the OAuth callback redirects back with.
    const params = new URLSearchParams(window.location.search);
    if (params.has('google')) {
      params.delete('google');
      window.history.replaceState({}, '', window.location.pathname + (params.size ? `?${params.toString()}` : ''));
    }
    fetch('/api/auth/status', { credentials: 'include' })
      .then((res) => (res.ok ? (res.json() as Promise<GoogleStatus>) : null))
      .then((data) => {
        if (data) setStatus(data);
      })
      .catch(() => {
        // Server not ready yet: stay on the blank screen rather than claiming a config error.
      });
  }, []);

  if (status === null) return null;
  if (status.connected) return <>{children}</>;

  const missing = requiredVars(status);
  if (missing.length > 0) {
    return (
      <GateCard className="max-w-md">
        <h1 className="mb-2 text-base font-semibold text-slate-800 dark:text-slate-100">{labels.configErrorTitle}</h1>
        <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">{labels.configErrorBody}</p>
        <VarList vars={missing} />
        <p className="text-sm text-slate-500 dark:text-slate-400">{labels.configErrorHint}</p>
      </GateCard>
    );
  }

  return (
    <GateCard className="rounded-2xl p-8 shadow-sm">
      <div className="mb-7 flex flex-col items-center gap-3">
        {app.icon}
        <div className="text-center">
          <h1 className="text-base font-semibold text-slate-800 dark:text-slate-100">{app.title}</h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{labels.subtitle}</p>
        </div>
      </div>

      <Button
        variant="secondary"
        icon={<GoogleIcon />}
        onClick={() => {
          window.location.href = connectHref;
        }}
        className="w-full justify-center py-2.5"
      >
        {labels.connect}
      </Button>

      <div className="mt-5">
        <button
          type="button"
          onClick={() => setShowInfo((v) => !v)}
          aria-expanded={showInfo}
          className="mx-auto flex cursor-pointer items-center gap-1.5 text-xs text-slate-400 transition-colors hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
        >
          {showInfo ? <X size={13} aria-hidden /> : <Info size={13} aria-hidden />}
          {labels.setupToggle}
        </button>

        {showInfo && (
          <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/50">
            <p className="mb-2 text-xs font-medium text-slate-600 dark:text-slate-300">{labels.setupTitle}</p>
            <ol className="list-inside list-decimal space-y-1.5">
              {setupSteps.map((step, i) => (
                <li key={i} className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  {step}
                </li>
              ))}
            </ol>
            <a
              href="https://console.cloud.google.com/apis/credentials"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block text-xs text-accent-600 hover:underline dark:text-accent-400"
            >
              {labels.consoleLink} →
            </a>
          </div>
        )}
      </div>
    </GateCard>
  );
}

export interface EnvCheckItem {
  key: string;
  status: 'ok' | 'missing' | 'invalid' | 'warn';
  message?: string;
}

export interface EnvCheckGateProps {
  labels: {
    title: string;
    body: string;
    hint: string;
    missing: string;
    invalid: string;
    warn: string;
    ok: string;
  };
  children: ReactNode;
}

function StatusBadge({ status, labels }: { status: EnvCheckItem['status']; labels: EnvCheckGateProps['labels'] }) {
  const styles = {
    missing: 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
    invalid: 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
    warn: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    ok: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  };
  const Icon = status === 'warn' ? AlertTriangle : status === 'ok' ? CheckCircle : AlertCircle;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${styles[status]}`}
    >
      <Icon size={11} aria-hidden />
      {labels[status]}
    </span>
  );
}

function ItemList({
  items,
  labels,
  tone,
}: {
  items: EnvCheckItem[];
  labels: EnvCheckGateProps['labels'];
  tone: 'error' | 'warn';
}) {
  const border = tone === 'error' ? 'border-rose-200 dark:border-rose-800' : 'border-amber-200 dark:border-amber-800';
  const divide =
    tone === 'error' ? 'divide-rose-100 dark:divide-rose-900/40' : 'divide-amber-100 dark:divide-amber-900/40';
  return (
    <div className={`mb-4 divide-y overflow-hidden rounded-xl border bg-white dark:bg-slate-800 ${border} ${divide}`}>
      {items.map((item) => (
        <div key={item.key} className="px-5 py-4">
          <div className="mb-1 flex items-center justify-between gap-3">
            <code className="break-all font-mono text-xs font-medium text-slate-800 dark:text-slate-200">
              {item.key}
            </code>
            <StatusBadge status={item.status} labels={labels} />
          </div>
          {item.message && <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">{item.message}</p>}
        </div>
      ))}
    </div>
  );
}

/**
 * Blocks the app while `/api/env-check` reports missing or invalid environment
 * variables. A server that can't be reached is not a config error: the app renders
 * and fails where it actually needs the variable.
 */
export function EnvCheckGate({ labels, children }: EnvCheckGateProps) {
  const [result, setResult] = useState<{ ok: boolean; checks: EnvCheckItem[] } | null>(null);

  useEffect(() => {
    fetch('/api/env-check')
      .then((r) => (r.ok ? (r.json() as Promise<{ ok: boolean; checks: EnvCheckItem[] }>) : null))
      .then((data) => setResult(data ?? { ok: true, checks: [] }))
      .catch(() => setResult({ ok: true, checks: [] }));
  }, []);

  if (result === null) return null;
  if (result.ok) return <>{children}</>;

  const errors = result.checks.filter((c) => c.status === 'missing' || c.status === 'invalid');
  const warnings = result.checks.filter((c) => c.status === 'warn');

  return (
    <div className="flex min-h-screen items-start justify-center bg-slate-50 px-4 pt-16 dark:bg-slate-900">
      <div className="w-full max-w-lg">
        <div className="mb-6 flex items-start gap-3">
          <div className="mt-0.5 shrink-0 rounded-full bg-rose-100 p-2 dark:bg-rose-900/30">
            <AlertCircle size={20} className="text-rose-600 dark:text-rose-400" aria-hidden />
          </div>
          <div>
            <h1 className="text-base font-semibold text-slate-800 dark:text-slate-100">{labels.title}</h1>
            <p className="mt-1 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{labels.body}</p>
          </div>
        </div>

        {errors.length > 0 && <ItemList items={errors} labels={labels} tone="error" />}
        {warnings.length > 0 && <ItemList items={warnings} labels={labels} tone="warn" />}

        <div className="mt-5 flex items-start gap-2 text-xs text-slate-400 dark:text-slate-500">
          <Info size={13} className="mt-0.5 shrink-0" aria-hidden />
          <span>{labels.hint}</span>
        </div>
      </div>
    </div>
  );
}
