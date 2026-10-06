import type { ComponentPropsWithRef, ReactNode } from 'react';

export interface SelectProps extends ComponentPropsWithRef<'select'> {
  error?: boolean;
  children?: ReactNode;
}

/** Select DaisyUI con estado de error. */
export function Select({ error = false, className = '', children, ...rest }: SelectProps) {
  return (
    <select
      className={`select select-bordered w-full ${error ? 'select-error' : ''} ${className}`.trim()}
      {...rest}
    >
      {children}
    </select>
  );
}
