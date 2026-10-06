import type { ReactNode } from 'react';

export interface FormFieldProps {
  label: string;
  children: ReactNode;
  error?: string | null;
  hint?: string;
  required?: boolean;
  className?: string;
}

/** Label + control + mensaje de error/hint, envolvente estándar de todo formulario. */
export function FormField({ label, children, error, hint, required = false, className = '' }: FormFieldProps) {
  return (
    <label className={`form-control w-full ${className}`.trim()}>
      <div className="label py-1">
        <span className="label-text">
          {label}
          {required ? <span className="text-error ml-0.5">*</span> : null}
        </span>
      </div>
      {children}
      {error ? (
        <div className="label py-1">
          <span className="label-text-alt text-error">{error}</span>
        </div>
      ) : hint ? (
        <div className="label py-1">
          <span className="label-text-alt text-base-content/60">{hint}</span>
        </div>
      ) : null}
    </label>
  );
}
