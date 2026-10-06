import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { errorMessage } from '../../services/api';
import { Alert } from '../../atoms/Alert';
import { Button } from '../../atoms/Button';
import { Card, CardBody } from '../../atoms/Card';
import { Icon } from '../../atoms/Icon';
import { Input } from '../../atoms/Input';
import { FormField } from '../../molecules/FormField';

interface LocationState {
  from?: string;
}

/** Login público (SPEC §10.4): tarjeta centrada + credenciales demo. */
export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!email.trim() || !password) {
      setError('Ingresá email y contraseña.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const payload = await login(email.trim(), password);
      const state = location.state as LocationState | null;
      const target =
        state?.from && state.from !== '/'
          ? state.from
          : payload.user.role === 'admin'
            ? '/admin/inicio'
            : '/jugador/inicio';
      navigate(target, { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="border border-base-300">
      <CardBody className="p-6 sm:p-8">
        <h2 className="text-xl font-bold">Ingresar</h2>
        <p className="text-sm text-base-content/60 mt-1">Accedé con tu cuenta del club.</p>

        <form className="mt-5 space-y-3" onSubmit={(event) => void submit(event)}>
          {error ? <Alert tone="error">{error}</Alert> : null}

          <FormField label="Email" required>
            <Input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="admin@club.com"
              autoComplete="username"
              autoFocus
            />
          </FormField>
          <FormField label="Contraseña" required>
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </FormField>

          <Button type="submit" className="w-full" loading={busy}>
            Ingresar
          </Button>
        </form>

        <div className="mt-4 space-y-3">
          <Alert tone="info" title="Cuentas demo">
            <ul className="text-sm space-y-1">
              <li>
                <span className="font-mono font-semibold">admin@club.com</span> · contraseña{' '}
                <span className="font-mono font-semibold">Admin123!</span> (administrador)
              </li>
              <li>
                <span className="font-mono font-semibold">jugador01@club.com</span> · contraseña{' '}
                <span className="font-mono font-semibold">Jugador123!</span> (jugador)
              </li>
            </ul>
          </Alert>

          <p className="text-center text-sm">
            ¿No tenés cuenta?{' '}
            <Link to="/registro" className="link link-primary font-medium inline-flex items-center gap-1">
              Registrate
              <Icon name="arrowRight" size={14} />
            </Link>
          </p>
        </div>
      </CardBody>
    </Card>
  );
}
