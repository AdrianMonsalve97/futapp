const LABELS = { V: "Victoria", E: "Empate", D: "Derrota" };
export function LeagueFormGuide({ form }: { form: ("V" | "E" | "D")[] }) {
  return (
    <div
      className="league-form"
      aria-label="Hasta cinco resultados, en el orden de las jornadas registradas"
    >
      {form.length ? (
        form.map((result, index) => (
          <span
            key={index}
            data-result={result}
            title={LABELS[result]}
            aria-label={LABELS[result]}
          >
            {result}
          </span>
        ))
      ) : (
        <small className="opacity-50">Sin jugar</small>
      )}
    </div>
  );
}
