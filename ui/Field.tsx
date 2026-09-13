import type { InputHTMLAttributes, ReactNode, Ref, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

/** The input look, for controls the components below don't cover (e.g. a third-party picker). */
export const inputClass =
  'w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/10 disabled:opacity-50';

export interface FieldProps {
  label: string;
  hint?: string;
  children: ReactNode;
}

/**
 * A labelled form control. The control is nested inside the `<label>`, so the two are
 * associated implicitly: no generated ids to keep in sync, and clicking the label
 * focuses the field.
 */
export function Field({ label, hint, children }: FieldProps) {
  return (
    <div>
      <label className="block">
        <span className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{label}</span>
        {children}
      </label>
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}

export function Input({
  className = '',
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement> }) {
  return <input className={`${inputClass} ${className}`} {...rest} />;
}

export function Select({
  className = '',
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { ref?: Ref<HTMLSelectElement> }) {
  return <select className={`${inputClass} ${className}`} {...rest} />;
}

export function Textarea({
  className = '',
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { ref?: Ref<HTMLTextAreaElement> }) {
  return <textarea className={`${inputClass} ${className}`} {...rest} />;
}
