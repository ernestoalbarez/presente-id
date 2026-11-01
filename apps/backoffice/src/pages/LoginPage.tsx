import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext';

export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 rounded-xl bg-white p-8 shadow">
        <div>
          <h1 className="text-2xl font-bold text-indigo-700">PresenteID</h1>
          <p className="text-sm text-slate-500">Backoffice para docentes y directivos</p>
        </div>
        <label className="block text-sm">
          Email
          <input
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          Contraseña
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          disabled={enviando}
          className="w-full rounded-md bg-indigo-600 py-2 font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {enviando ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
    </div>
  );
}
