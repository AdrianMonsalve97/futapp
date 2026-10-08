import { useSettings } from '../context/SettingsContext';
export function ClubLogo({ className = '' }: { className?: string }) {
  const { settings } = useSettings();
  const logo = settings.logoUrl || '/brand/aag-logo.jpg';
  const src = logo.startsWith('/api/media/') ? '/api/branding/logo?v=' + logo.split('/').pop() : logo;
  return <img src={src} alt={`Escudo de ${settings.teamName}`} className={`club-logo ${className}`} />;
}
