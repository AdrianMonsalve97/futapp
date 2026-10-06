import type { ComponentPropsWithRef } from 'react';

export interface InputProps extends ComponentPropsWithRef<'input'> {
  /** Resalta el campo en error (DaisyUI `input-error`). */
  error?: boolean;
  /** Clases extra para el contenedor, cuando se usa dentro de FormField. */
  wrapperClassName?: string;
}

/** Input DaisyUI con soporte de estado de error. */
export function Input({ error = false, wrapperClassName = '', className = '', ...rest }: InputProps) {
  return (
    <input
      type="text"
      className={`input input-bordered w-full ${error ? 'input-error' : ''} ${className} ${wrapperClassName}`.trim()}
      {...rest}
    />
  );
}
