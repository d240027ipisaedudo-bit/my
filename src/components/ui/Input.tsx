import { type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes, type ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';

interface FieldProps {
  label?: string;
  error?: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}

export function Field({ label, error, required, hint, children }: FieldProps) {
  return (
    <div>
      {label && (
        <label className="label-base">
          {label}
          {required && <span className="text-rose-500 ml-0.5">*</span>}
        </label>
      )}
      {children}
      {hint && !error && <p className="mt-1 text-xs text-slate-400 dark:text-ink-500">{hint}</p>}
      {error && (
        <p className="mt-1 flex items-center gap-1 text-xs text-rose-500">
          <AlertCircle className="h-3.5 w-3.5" />
          {error}
        </p>
      )}
    </div>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  required?: boolean;
  hint?: string;
  icon?: ReactNode;
}

export function Input({ label, error, required, hint, icon, className = '', ...props }: InputProps) {
  return (
    <Field label={label} error={error} required={required} hint={hint}>
      <div className="relative">
        {icon && <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-ink-500">{icon}</span>}
        <input
          className={`input-base ${icon ? 'pl-10' : ''} ${error ? 'border-rose-400 focus:ring-rose-500/30 focus:border-rose-500' : ''} ${className}`}
          {...props}
        />
      </div>
    </Field>
  );
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  required?: boolean;
  hint?: string;
  options: { value: string | number; label: string }[];
  placeholder?: string;
}

export function Select({ label, error, required, hint, options, placeholder, className = '', ...props }: SelectProps) {
  return (
    <Field label={label} error={error} required={required} hint={hint}>
      <select className={`input-base appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22%2394a3b8%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20d%3D%22M5.23%207.21a.75.75%200%20011.06.02L10%2011.06l3.71-3.83a.75.75%200%20011.08%201.04l-4.25%204.39a.75.75%200%2001-1.08%200L5.21%208.27a.75.75%200%2001.02-1.06z%22%20clip-rule%3D%22evenodd%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_0.75rem_center] pr-10 ${error ? 'border-rose-400' : ''} ${className}`} {...props}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </Field>
  );
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  required?: boolean;
  hint?: string;
}

export function Textarea({ label, error, required, hint, className = '', ...props }: TextareaProps) {
  return (
    <Field label={label} error={error} required={required} hint={hint}>
      <textarea className={`input-base resize-none ${error ? 'border-rose-400' : ''} ${className}`} {...props} />
    </Field>
  );
}
