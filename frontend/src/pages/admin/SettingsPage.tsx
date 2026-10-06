import { useEffect, useState } from 'react';
import { useFetch } from '../../hooks/useFetch';
import { useSettings } from '../../context/SettingsContext';
import { errorMessage } from '../../services/api';
import { PageHeader } from '../../templates/PageHeader';
import { Alert } from '../../atoms/Alert';
import { Badge } from '../../atoms/Badge';
import { Button } from '../../atoms/Button';
import { Card, CardBody, CardTitle } from '../../atoms/Card';
import { Icon } from '../../atoms/Icon';
import { Input } from '../../atoms/Input';
import { Spinner } from '../../atoms/Spinner';
import { FormField } from '../../molecules/FormField';
import { FORMAT_LIST, formationsFor } from '../../data/formations';
import type { TeamFormat, TeamSettings } from '../../types/api';

/**
 * Configuración global (SPEC §12.7.4): nombre del club, temporada y selector de
 * formato (4 tarjetas f5/f7/f8/f11) → `GET/PUT /api/settings`.
 */
export function SettingsPage() {
  const { data, loading, error, reload } = useFetch<TeamSettings>('/api/settings');
  const { settings: globalSettings, save: saveSettings } = useSettings();

  const [teamName, setTeamName] = useState('');
  const [season, setSeason] = useState('');
  const [format, setFormat] = useState<TeamFormat>(11);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data) {
      setTeamName(data.teamName);
      setSeason(data.season);
      setFormat(data.format);
      setSaved(false);
      return;
    }
    // Sin respuesta (endpoint caído): partimos de los valores del contexto.
    if (error) {
      setTeamName(globalSettings.teamName);
      setSeason(globalSettings.season);
      setFormat(globalSettings.profile.format);
    }
  }, [data, error, globalSettings]);

  const submit = async () => {
    if (!teamName.trim()) {
      setFormError('Ingresá el nombre del club.');
      return;
    }
    if (!season.trim()) {
      setFormError('Ingresá la temporada.');
      return;
    }
    setBusy(true);
    setFormError(null);
    setSaved(false);
    try {
      await saveSettings({ teamName: teamName.trim(), season: season.trim(), format });
      setSaved(true);
      reload();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  const selectedList = formationsFor(format);
  const selectedProfile = FORMAT_LIST.find((item) => item.format === format);

  return (
    <>
      <PageHeader
        title="Configuración"
        subtitle="Formato de juego, identidad del club y temporada"
        actions={
          <Button onClick={() => void submit()} loading={busy}>
            <Icon name="check" size={16} />
            Guardar configuración
          </Button>
        }
      />

      <Alert tone="info" className="mb-4">
        El formato global es el valor por defecto de los nuevos partidos; cada partido puede cambiarlo al
        crearlo. La IA, las formaciones y los minutos se ajustan al formato de cada encuentro.
      </Alert>

      {error ? (
        <Alert tone="warning" className="mb-4" title="No se pudo cargar la configuración" onClose={reload}>
          {error}. Se muestran los valores por defecto hasta que vuelva a conectarse.
        </Alert>
      ) : null}
      {formError ? (
        <Alert tone="error" className="mb-4" onClose={() => setFormError(null)}>
          {formError}
        </Alert>
      ) : null}
      {saved ? (
        <Alert tone="success" className="mb-4" onClose={() => setSaved(false)}>
          Configuración guardada. El formato global quedó actualizado para los próximos partidos.
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3 items-start">
        {/* Identidad del club */}
        <Card>
          <CardBody className="gap-3">
            <CardTitle className="text-base">Club y temporada</CardTitle>
            <FormField label="Nombre del club" required>
              <Input
                value={teamName}
                onChange={(event) => setTeamName(event.target.value)}
                placeholder="Club Portal"
              />
            </FormField>
            <FormField label="Temporada" required hint="Se usa para inscripciones y filtros de datos.">
              <Input
                value={season}
                onChange={(event) => setSeason(event.target.value)}
                placeholder="2026"
                inputMode="numeric"
              />
            </FormField>
            <div className="rounded-lg bg-base-200 px-3 py-2 text-sm">
              <p className="text-xs text-base-content/60">Formato vigente</p>
              <p className="font-semibold">
                {selectedProfile?.name ?? `Fútbol ${format}`} · {selectedProfile?.playersOnPitch ?? format}{' '}
                en cancha · {selectedProfile?.matchMinutes ?? 90}'
              </p>
            </div>
          </CardBody>
        </Card>

        {/* Selector de formato */}
        <Card className="lg:col-span-2">
          <CardBody className="gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">Formato de juego</CardTitle>
              <Badge tone="primary" size="sm">
                {format} jugadores en cancha
              </Badge>
            </div>
            <p className="text-sm text-base-content/60">
              Definí el formato del equipo: jugadores en cancha, duración del partido y catálogo de
              formaciones disponibles.
            </p>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {FORMAT_LIST.map((profile) => {
                const isSelected = profile.format === format;
                const list = formationsFor(profile.format);
                return (
                  <button
                    key={profile.format}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setFormat(profile.format)}
                    className={`rounded-xl border-2 p-4 text-left transition-colors ${
                      isSelected ? 'border-primary bg-primary/10' : 'border-base-200 hover:border-base-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold">{profile.name}</span>
                      {isSelected ? (
                        <span className="badge badge-primary badge-sm">
                          <Icon name="check" size={12} />
                          Activo
                        </span>
                      ) : null}
                    </div>
                    <ul className="mt-2 space-y-0.5 text-xs text-base-content/70">
                      <li>
                        <span className="font-semibold">{profile.playersOnPitch}</span> jugadores en cancha
                        (1 POR + {profile.playersOnPitch - 1})
                      </li>
                      <li>
                        Duración: <span className="font-semibold">{profile.matchMinutes}'</span> por partido
                      </li>
                      <li>
                        {list.length} formaciones:{' '}
                        <span className="font-semibold">{list.map((item) => item.key).join(' · ')}</span>
                      </li>
                      <li>Plantel sugerido: {profile.squadHint}</li>
                    </ul>
                  </button>
                );
              })}
            </div>

            <p className="text-xs text-base-content/50">
              El formato elegido deja {selectedList.length} formaciones válidas (
              {selectedList.map((item) => item.key).join(' · ')}) y define una duración de{' '}
              {selectedProfile?.matchMinutes ?? 90}' para los próximos partidos.
            </p>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
