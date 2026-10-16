export function SectionNavigation<T extends string>({
  value,
  onChange,
  items,
  label,
}: {
  value: T;
  onChange: (value: T) => void;
  items: readonly { key: T; label: string; count?: number }[];
  label: string;
}) {
  return (
    <nav className="sport-section-nav" aria-label={label}>
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          aria-pressed={value === item.key}
          onClick={() => onChange(item.key)}
        >
          {item.label}
          {item.count !== undefined && <span>{item.count}</span>}
        </button>
      ))}
    </nav>
  );
}
