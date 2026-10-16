import refereeRules from "../../../../backend/src/domain/referee-rules.json";
import { useSearchParams, Link } from "react-router-dom";
import { Icon, type IconName } from "../../atoms/Icon";
import { QrPaymentPanel } from "../../organisms/QrPaymentPanel";
import { ClubPageIntro } from "../../molecules/ClubPageIntro";

const categories: {
  kind: "inscription" | "referee" | "uniform";
  title: string;
  hint: string;
  icon: IconName;
}[] = [
  {
    kind: "inscription",
    title: "Inscripción",
    hint: "Tu temporada en el club",
    icon: "trofeo",
  },
  {
    kind: "referee",
    title: "Arbitraje",
    hint: "Tu aporte para la fecha",
    icon: "whistle",
  },
  {
    kind: "uniform",
    title: "Equipación",
    hint: "Tus pedidos y uniformes",
    icon: "camiseta",
  },
];
export function PaymentsPage() {
  const [params, setParams] = useSearchParams();
  const kind =
    categories.find((row) => row.kind === params.get("concepto"))?.kind ??
    "inscription";
  return (
    <>
      <ClubPageIntro
        icon="dinero"
        eyebrow="FUERA DE LA CANCHA, TAMBIÉN SOMOS EQUIPO"
        title="Tu aporte mueve al club."
      >
        Un solo lugar para pagar y consultar tus comprobantes.
      </ClubPageIntro>
      <div className="club-payment-categories" aria-label="Tipo de pago">
        {categories.map((row) => (
          <button
            key={row.kind}
            type="button"
            aria-pressed={kind === row.kind}
            onClick={() => setParams({ concepto: row.kind })}
          >
            <Icon name={row.icon} size={25} />
            <span>
              <strong>{row.title}</strong>
              <small>{row.hint}</small>
            </span>
          </button>
        ))}
      </div>
      <ol className="club-guided-steps" aria-label="Cómo pagar">
        <li>
          <b>1</b>Revisa el concepto y el saldo
        </li>
        <li>
          <b>2</b>Transfiere desde tu banco con el QR
        </li>
        <li>
          <b>3</b>Sube el soporte para validación
        </li>
      </ol>
      <p className="club-payment-note">
        {kind === "referee"
          ? `Confirma tu asistencia para generar tu aporte. El pago completo debe estar realizado y aprobado al menos ${refereeRules.noticeHours} horas antes del partido para ser titular. Un pago o aprobación tardíos habilitan suplencia. Si pagas y no asistes, el saldo se acumula para la siguiente fecha.`
          : kind === "uniform"
            ? "Primero solicita la prenda en la tienda. Aquí encontrarás su concepto de pago y podrás seguir la revisión del comprobante."
            : "La inscripción la genera el administrador. Tu transferencia queda en revisión hasta que valide el soporte."}
      </p>
      <div key={kind} className="page-enter">
        <QrPaymentPanel kind={kind} onSaved={() => {}} />
      </div>
      <div className="flex flex-wrap gap-5 mt-5">
        <Link className="club-text-link" to="/jugador/inscripcion">
          Detalle de mi inscripción <Icon name="arrowRight" size={16} />
        </Link>
        <Link className="club-text-link" to="/jugador/partidos">
          Mis partidos <Icon name="arrowRight" size={16} />
        </Link>
        <Link className="club-text-link" to="/jugador/uniformes">
          Explorar la tienda <Icon name="arrowRight" size={16} />
        </Link>
      </div>
    </>
  );
}
