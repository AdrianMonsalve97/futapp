import { StatTile, type StatTileProps } from '../atoms/StatTile';

export interface StatCardsRowProps {
  tiles: StatTileProps[];
  /** Columnas del grid (por defecto responsivo 1 → 2 → 4). */
  columns?: 3 | 4 | 5;
  className?: string;
}

const COLUMNS: Record<number, string> = {
  3: 'sm:grid-cols-2 lg:grid-cols-3',
  4: 'sm:grid-cols-2 xl:grid-cols-4',
  5: 'sm:grid-cols-2 lg:grid-cols-3 min-[1600px]:grid-cols-5',
};

/** Fila de tarjetas de indicadores (`StatTile`) para dashboards. */
export function StatCardsRow({ tiles, columns = 4, className = '' }: StatCardsRowProps) {
  return (
    <div className={`grid grid-cols-1 gap-3 ${COLUMNS[columns]} ${className}`.trim()}>
      {tiles.map((tile, index) => (
        <StatTile key={`${tile.label}-${index}`} {...tile} />
      ))}
    </div>
  );
}
