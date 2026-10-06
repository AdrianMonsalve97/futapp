import type { ComponentPropsWithRef } from 'react';

export interface TextareaProps extends ComponentPropsWithRef<'textarea'> {
  error?: boolean;
}

/** Textarea DaisyUI con estado de error. */
export function Textarea({ error = false, className = '', ...rest }: TextareaProps) {
  return (
    <textarea
      className={`textarea textarea-bordered w-full ${error ? 'textarea-error' : ''} ${className}`.trim()}
      {...rest}
    />
  );
}
