import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { errorMessage } from '../../services/api';
import { Alert } from '../../atoms/Alert';
import { Button } from '../../atoms/Button';
import { Card, CardBody } from '../../atoms/Card';
import { Input } from '../../atoms/Input';
import { Select } from '../../atoms/Select';
import { FormField } from '../../molecules/FormField';
import type { Position } from '../../types/api';

/** Registro público de jugador (SPEC §10.4) → redirige a `/jugador/inicio`. */
export function RegisterPage() {
  const { register } = useAuth();
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    position: 'MED' as Position,
    shirtNumber: '',
    invitationCode:new URLSearchParams(window.location.hash.slice(1)).get('invitacion')??'',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => {
      const next = { ...prev };
      next[key] = value;
      return next;
    });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.fullName.trim() || !form.email.trim() || !form.password) {
      setError('Nombre, email y contraseña son obligatorios.');
      return;
    }
    if (form.password.length < 15) {
      setError('La contraseña debe tener al menos 15 caracteres.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await register({
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        password: form.password,
        phone: form.phone.trim() || undefined,
        position: form.position,
        shirtNumber: form.shirtNumber ? Number(form.shirtNumber) : undefined,
        invitationCode:form.invitationCode.trim(),
      });
      setForm(previous => ({ ...previous, password: '' }));
      setSubmitted(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (submitted) return <Card className="auth-entry-card"><CardBody className="p-8 space-y-4"><h2 className="text-xl font-bold">Solicitud enviada</h2><Alert tone="success">Tu ingreso está pendiente del aval del administrador. Podrás iniciar sesión cuando apruebe tu solicitud.</Alert><Link to="/login" className="btn btn-primary">Volver al inicio de sesión</Link></CardBody></Card>;

  return (
    <Card className="border border-base-300 auth-entry-card">
      <CardBody className="p-6 sm:p-8">
        <h2 className="text-xl font-bold">Solicitar ingreso al equipo</h2>
        <p className="text-sm text-base-content/60 mt-1">
          Completa tus datos con la invitación del administrador para solicitar tu ingreso. El administrador debe aprobarlo.
        </p>

        <form className="auth-fields" onSubmit={(event) => void submit(event)}>
          {error ? <Alert tone="error">{error}</Alert> : null}
          <FormField label="Código de invitación" required hint="Pide al administrador el enlace o código del equipo."><Input required autoComplete="off" value={form.invitationCode} onChange={e=>set('invitationCode',e.target.value)} /></FormField>

          <FormField label="Nombre completo" required>
            <Input
              value={form.fullName}
              onChange={(event) => set('fullName', event.target.value)}
              placeholder="Lucas Martínez"
              autoFocus
            />
          </FormField>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Email" required>
              <Input
                type="email"
                value={form.email}
                onChange={(event) => set('email', event.target.value)}
                placeholder="jugador@club.com"
                autoComplete="username"
              />
            </FormField>
            <FormField label="Teléfono">
              <Input
                value={form.phone}
                onChange={(event) => set('phone', event.target.value)}
                placeholder="300 000 0000"
              />
            </FormField>
            <FormField label="Contraseña" required hint="Mínimo 15 caracteres. Puedes usar una frase.">
              <Input
                type="password"
                value={form.password}
                onChange={(event) => set('password', event.target.value)}
                autoComplete="new-password"
              />
            </FormField>
            <FormField label="Posición">
              <Select
                value={form.position}
                onChange={(event) => set('position', event.target.value as Position)}
              >
                <option value="POR">POR · Portero</option>
                <option value="DEF">DEF · Defensor</option>
                <option value="MED">MED · Mediocampista</option>
                <option value="DEL">DEL · Delantero</option>
              </Select>
            </FormField>
            <FormField label="Dorsal" hint="Elige un número libre o déjalo vacío para asignarlo después.">
              <Input
                type="number"
                min={0}
                max={99}
                value={form.shirtNumber}
                onChange={(event) => set('shirtNumber', event.target.value)}
                placeholder="10"
              />
            </FormField>
          </div>

          <Button type="submit" className="w-full" loading={busy}>
            Enviar solicitud
          </Button>
        </form>

        <p className="text-center text-sm mt-4">
          ¿Ya tenés cuenta?{' '}
          <Link to="/login" className="link link-primary font-medium">
            Ingresá acá
          </Link>
        </p>
      </CardBody>
    </Card>
  );
}
