import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Rendered before the label. */
  icon?: ReactNode;
  /** Disables the button and centres a spinner over the label, which keeps its width. */
  pending?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

const base =
  'relative inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50';

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-accent-600 text-white hover:bg-accent-700',
  secondary:
    'border border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800',
  ghost:
    'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100',
  danger: 'bg-rose-600 text-white hover:bg-rose-700',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
};

/**
 * The shared button. `type` defaults to "button", not the browser's "submit", so a
 * button dropped into a form never submits it by accident. `className` is appended,
 * not merged: pass layout (`w-full`, margins), not colours.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  pending = false,
  disabled,
  type = 'button',
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...rest}
    >
      <span className={`inline-flex items-center gap-1.5 ${pending ? 'invisible' : ''}`}>
        {icon}
        {children}
      </span>
      {pending && (
        <span className="absolute inset-0 flex items-center justify-center">
          <Loader2 size={14} className="animate-spin" />
        </span>
      )}
    </button>
  );
}

export type IconButtonSize = 'sm' | 'md';

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Required: an icon-only button has no other accessible name. Also shown as the tooltip. */
  label: string;
  icon: ReactNode;
  /** `danger` turns the hover red, for delete actions. */
  tone?: 'default' | 'danger';
  /** `sm` for dense table rows, where the default padding crowds the line. */
  size?: IconButtonSize;
  /** Disables the button and spins a loader in the icon's place, which keeps its box. */
  pending?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

const iconTones = {
  default: 'hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-200',
  danger: 'hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-900/20 dark:hover:text-rose-400',
};

const iconSizes: Record<IconButtonSize, string> = {
  sm: 'p-0.5',
  md: 'p-1.5',
};

/** A square, icon-only button, e.g. edit/delete in a table row or a dialog's close ×. */
export function IconButton({
  label,
  icon,
  tone = 'default',
  size = 'md',
  pending = false,
  disabled,
  type = 'button',
  className = '',
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      className={`relative inline-flex items-center justify-center rounded-lg text-slate-400 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${iconSizes[size]} ${iconTones[tone]} ${className}`}
      {...rest}
    >
      {/* The icon keeps its space while pending, so the row never shifts. */}
      <span className={pending ? 'invisible' : undefined}>{icon}</span>
      {pending && (
        <span className="absolute inset-0 flex items-center justify-center">
          <Loader2 size={size === 'sm' ? 12 : 14} className="animate-spin" />
        </span>
      )}
    </button>
  );
}
