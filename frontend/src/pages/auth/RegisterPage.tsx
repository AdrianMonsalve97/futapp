import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    position: 'MED' as Position,
    shirtNumber: '',
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
    if (form.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
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
      });
      navigate('/jugador/inicio', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="border border-base-300">
      <CardBody className="p-6 sm:p-8">
        <h2 className="text-xl font-bold">Crear cuenta de jugador</h2>
        <p className="text-sm text-base-content/60 mt-1">
          Completá tus datos para sumarte al plantel. Un administrador validará tu ficha.
        </p>

        <form className="mt-5 space-y-3" onSubmit={(event) => void submit(event)}>
          {error ? <Alert tone="error">{error}</Alert> : null}

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
            <FormField label="Contraseña" required hint="Mínimo 6 caracteres.">
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
            <FormField label="Dorsal">
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
            Crear cuenta
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
