import { useState, type FormEvent } from 'react';
import { NotificationPreferencesForm } from '../../organisms/NotificationPreferencesForm';
import { useFetch } from '../../hooks/useFetch';
import { useAuth } from '../../context/AuthContext';
import { api, errorMessage } from '../../services/api';
import { PageHeader } from '../../templates/PageHeader';
import { Alert } from '../../atoms/Alert';
import { Avatar } from '../../atoms/Avatar';
import { Button } from '../../atoms/Button';
import { Card, CardBody, CardTitle } from '../../atoms/Card';
import { Input } from '../../atoms/Input';
import { Spinner } from '../../atoms/Spinner';
import { PositionBadge } from '../../molecules/PositionBadge';
import { ImageUpload } from '../../molecules/ImageUpload';
import { ProfileForm } from '../../organisms/ProfileForm';
import { HealthForm } from '../../organisms/HealthForm';
import { formatDate } from '../../utils/format';
import type { MeResponse, PasswordResponse } from '../../types/api';
import {PASSWORD_HINT,PASSWORD_MIN_LENGTH,passwordError} from '../../utils/password';

/** Mi perfil (SPEC §10.4): ficha, formulario de datos y cambio de contraseña. */
export function MyProfilePage() {
  const { refresh, logout } = useAuth();
  const { data, loading, error, reload } = useFetch<MeResponse>('/api/me');
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' });
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [pwdOk, setPwdOk] = useState(false);

  const handleSaved = () => {
    void refresh();
    reload();
  };

  const changePassword = async (event: FormEvent) => {
    event.preventDefault();
    setPwdError(null);
    setPwdOk(false);
    const invalidPassword=passwordError(passwords.next);
    if (invalidPassword) {
      setPwdError(invalidPassword);
      return;
    }
    if (passwords.next !== passwords.confirm) {
      setPwdError('La confirmación no coincide con la nueva contraseña.');
      return;
    }
    setPasswordBusy(true);
    try {
      await api<PasswordResponse>('/api/me/password', {
        method: 'PUT',
        json: { currentPassword: passwords.current, newPassword: passwords.next },
      });
      setPwdOk(true);
      setPasswords({ current: '', next: '', confirm: '' });
      logout();
    } catch (err) {
      setPwdError(errorMessage(err));
    } finally {
      setPasswordBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <>
        <PageHeader title="Mi perfil" subtitle="Tu ficha personal y datos de contacto" />
        <Alert tone="error" title="No se pudo cargar tu perfil" onClose={reload}>
          {error ?? 'Sin datos disponibles.'}
        </Alert>
      </>
    );
  }

  const { user, player } = data;

  return (
    <>
      <PageHeader title="Mi perfil" subtitle="Tu ficha personal y datos de contacto" />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,320px)_1fr]">
        {/* Ficha */}
        <Card className="h-fit">
          <CardBody className="gap-3 items-center text-center">
            <Avatar name={user.fullName} src={user.avatarUrl} size="lg" />
            <ImageUpload endpoint="/api/me/avatar" currentUrl={user.avatarUrl} label="Tu foto de jugador" showPreview={false} onSaved={handleSaved} />
            <div>
              <p className="font-bold text-lg">{user.fullName}</p>
              <p className="text-sm text-base-content/60">{user.email}</p>
            </div>
            <div className="flex items-center justify-center gap-2">
              <span className="badge badge-primary badge-lg font-bold">
                {player?.shirtNumber ?? '—'}
              </span>
              {player ? <PositionBadge position={player.position} size="md" showTitle /> : null}
            </div>
            <div className="grid grid-cols-2 gap-2 w-full text-sm">
              <div className="rounded-lg bg-base-200 px-3 py-2 text-left">
                <p className="text-xs text-base-content/60">Antigüedad</p>
                <p className="font-semibold">{formatDate(player?.joinedAt ?? user.createdAt)}</p>
              </div>
              <div className="rounded-lg bg-base-200 px-3 py-2 text-left">
                <p className="text-xs text-base-content/60">Teléfono</p>
                <p className="font-semibold">{user.phone ?? '—'}</p>
              </div>
              <div className="rounded-lg bg-base-200 px-3 py-2 text-left">
                <p className="text-xs text-base-content/60">DNI</p>
                <p className="font-semibold">{player?.dni ?? '—'}</p>
              </div>
              <div className="rounded-lg bg-base-200 px-3 py-2 text-left">
                <p className="text-xs text-base-content/60">Rol</p>
                <p className="font-semibold capitalize">{user.role === 'admin' ? 'Admin' : 'Jugador'}</p>
              </div>
            </div>
          </CardBody>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardBody className="gap-3">
              <CardTitle className="text-base">Ficha del jugador</CardTitle>
              <ProfileForm player={player} phone={user.phone} onSaved={handleSaved} />
            </CardBody>
          </Card>

          {player ? <Card>
            <CardBody className="gap-3">
              <CardTitle className="text-base">Salud</CardTitle>
              <HealthForm player={player} endpoint="/api/me/profile" onSaved={handleSaved} />
            </CardBody>
          </Card> : null}

          <Card><CardBody className="gap-3"><CardTitle className="text-base">Mis notificaciones</CardTitle><NotificationPreferencesForm /></CardBody></Card>
          <Card>
            <CardBody className="gap-3">
              <CardTitle className="text-base">Cambiar contraseña</CardTitle>
              <p className="text-sm text-base-content/60">{PASSWORD_HINT} Al cambiarla, se cerrarán tus sesiones y deberás ingresar de nuevo.</p>
              {pwdError ? <Alert tone="error">{pwdError}</Alert> : null}
              {pwdOk ? <Alert tone="success">Contraseña actualizada correctamente.</Alert> : null}
              <form className="grid gap-3 xl:grid-cols-3" onSubmit={(event) => void changePassword(event)}>
                <div>
                  <label className="label py-1" htmlFor="current-password">
                    <span className="label-text">Contraseña actual</span>
                  </label>
                  <Input
                    id="current-password"
                    type="password"
                    autoComplete="current-password"
                    value={passwords.current}
                    onChange={(event) => setPasswords((prev) => ({ ...prev, current: event.target.value }))}
                  />
                </div>
                <div>
                  <label className="label py-1" htmlFor="new-password">
                    <span className="label-text">Nueva contraseña</span>
                  </label>
                  <Input
                    id="new-password"
                    required minLength={PASSWORD_MIN_LENGTH}
                    type="password"
                    autoComplete="new-password"
                    value={passwords.next}
                    onChange={(event) => setPasswords((prev) => ({ ...prev, next: event.target.value }))}
                  />
                </div>
                <div>
                  <label className="label py-1" htmlFor="confirm-password">
                    <span className="label-text">Confirmar</span>
                  </label>
                  <Input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    value={passwords.confirm}
                    onChange={(event) => setPasswords((prev) => ({ ...prev, confirm: event.target.value }))}
                  />
                </div>
                <div className="sm:col-span-3 flex justify-end">
                  <Button type="submit" loading={passwordBusy}>
                    Actualizar contraseña
                  </Button>
                </div>
              </form>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
