import type { HTMLAttributes, ReactNode } from 'react';

export type BadgeTone =
  | 'default'
  | 'neutral'
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'info'
  | 'success'
  | 'warning'
  | 'error';

const TONE_CLASS: Record<BadgeTone, string> = {
  default: '',
  neutral: 'badge-neutral',
  primary: 'badge-primary',
  secondary: 'badge-secondary',
  accent: 'badge-accent',
  info: 'badge-info',
  success: 'badge-success',
  warning: 'badge-warning',
  error: 'badge-error',
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  outline?: boolean;
  ghost?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  children?: ReactNode;
}

const SIZE_CLASS: Record<'xs' | 'sm' | 'md' | 'lg', string> = {
  xs: 'badge-xs',
  sm: 'badge-sm',
  md: '',
  lg: 'badge-lg',
};

/** Badge DaisyUI con tono consistente en toda la app. */
export function Badge({
  tone = 'default',
  outline = false,
  ghost = false,
  size = 'md',
  className = '',
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={`badge ${TONE_CLASS[tone]} ${SIZE_CLASS[size]} ${outline ? 'badge-outline' : ''} ${
        ghost ? 'badge-ghost' : ''
      } ${className}`.trim()}
      {...rest}
    >
      {children}
    </span>
  );
}
