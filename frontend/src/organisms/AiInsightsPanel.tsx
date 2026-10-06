import { Alert } from '../atoms/Alert';
import { Icon, type IconName } from '../atoms/Icon';
import type { AiInsights } from '../types/api';

type InsightLevel = AiInsights['insights'][number]['level'];

const STYLE: Record<InsightLevel, { tone: 'success' | 'warning' | 'info'; icon: IconName }> = {
  positivo: { tone: 'success', icon: 'check' },
  alerta: { tone: 'warning', icon: 'alert' },
  info: { tone: 'info', icon: 'info' },
};

export interface AiInsightsPanelProps {
  insights: AiInsights['insights'];
}

/** Panel de conclusiones del modelo (3–6 ítems con números reales). */
export function AiInsightsPanel({ insights }: AiInsightsPanelProps) {
  if (insights.length === 0) {
    return <Alert tone="info">El modelo aún no tiene conclusiones: hacen falta más datos de partidos.</Alert>;
  }

  return (
    <div className="space-y-3">
      {insights.map((insight, index) => {
        const style = STYLE[insight.level] ?? STYLE.info;
        return (
          <div key={`${insight.title}-${index}`} className="flex gap-3 rounded-xl border border-base-200 bg-base-100 p-3">
            <div
              className={`w-9 h-9 shrink-0 rounded-lg grid place-items-center ${
                style.tone === 'success'
                  ? 'bg-success/10 text-success'
                  : style.tone === 'warning'
                    ? 'bg-warning/15 text-warning-content'
                    : 'bg-info/10 text-info'
              }`}
            >
              <Icon name={style.icon} size={18} />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm">{insight.title}</p>
              <p className="text-sm text-base-content/70">{insight.message}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
