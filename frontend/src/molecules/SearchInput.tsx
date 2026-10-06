import { Icon } from '../atoms/Icon';

export interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  /** Se ejecuta con Enter (opcional). */
  onSubmit?: () => void;
}

/** Input de búsqueda con ícono lupa. */
export function SearchInput({
  value,
  onChange,
  placeholder = 'Buscar…',
  className = '',
  onSubmit,
}: SearchInputProps) {
  return (
    <div className={`join w-full ${className}`.trim()}>
      <div className="join-item flex items-center gap-2 bg-base-200 border border-base-300 border-r-0 rounded-l-btn px-3">
        <Icon name="search" size={16} className="text-base-content/50" />
      </div>
      <input
        type="search"
        className="join-item input input-bordered w-full rounded-l-none"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && onSubmit) onSubmit();
        }}
        aria-label={placeholder}
      />
    </div>
  );
}
