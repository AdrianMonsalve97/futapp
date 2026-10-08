import { useMediaUrl } from '../hooks/useMediaUrl';
import { initials } from '../utils/format';

export interface AvatarProps {
  name: string;
  src?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASS: Record<'xs' | 'sm' | 'md' | 'lg', string> = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-16 h-16 text-xl',
};

/** Avatar con imagen o iniciales del nombre. */
export function Avatar({ name, src, size = 'md', className = '' }: AvatarProps) {
  const url = useMediaUrl(src);
  return (
    <div className={`avatar ${size === 'lg' ? '' : 'avatar-placeholder'} ${className}`.trim()}>
      <div className={`rounded-box bg-neutral text-neutral-content ${SIZE_CLASS[size]}`}>
        {url ? (
          <img src={url} alt={name} className="rounded-box object-cover w-full h-full" />
        ) : (
          <span className="leading-none">{initials(name)}</span>
        )}
      </div>
    </div>
  );
}
