import { useMediaUrl } from '../hooks/useMediaUrl';
import { Icon } from './Icon';
export function MediaImage({ src, alt, className = '' }: { src?: string | null; alt: string; className?: string }) {
  const url = useMediaUrl(src);
  return url ? <img src={url} alt={alt} className={className} loading="lazy" /> : <div className={`${className} grid place-items-center bg-base-200 text-base-content/30`} aria-label={alt}><Icon name="camiseta" size={40} /></div>;
}
