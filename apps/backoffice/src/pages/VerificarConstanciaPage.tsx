// Página pública (sin login) a la que apunta el QR de cada constancia.
import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import type { VerificacionPublicaConstancia } from '@presente/shared';
import { api } from '../api/client';

export function VerificarConstanciaPage() {
  const { codigo = '' } = useParams();
  const [v, setV] = useState<VerificacionPublicaConstancia | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<VerificacionPublicaConstancia>(`/public/constancias/${encodeURIComponent(codigo)}`)
      .then(setV)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [codigo]);

  const estado = !v
    ? null
    : !v.autentica
      ? { titulo: 'Constancia no válida', texto: 'No existe una constancia auténtica con este código.', clase: 'bg-red-600', icono: '✕' }
      : v.revocada
        ? { titulo: 'Constancia revocada', texto: 'La firma es auténtica, pero la institución anuló este presente.', clase: 'bg-amber-500', icono: '!' }
        : { titulo: 'Constancia auténtica', texto: 'Firmada digitalmente por la institución.', clase: 'bg-green-600', icono: '✓' };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow">
        <div className="px-6 pt-6 text-sm font-semibold text-indigo-700">PresenteID · Verificación de constancia</div>
        {error && <p className="p-6 text-red-600">{error}</p>}
        {!v && !error && <p className="p-6 text-slate-500">Verificando…</p>}
        {v && estado && (
          <>
            <div className={`${estado.clase} mx-6 mt-4 rounded-xl px-5 py-4 text-white`}>
              <p className="text-2xl font-bold">
                {estado.icono} {estado.titulo}
              </p>
              <p className="text-white/90">{estado.texto}</p>
            </div>
            {v.constancia && (
              <dl className="grid grid-cols-3 gap-y-2 p-6 text-sm">
                <dt className="text-slate-500">Titular</dt>
                <dd className="col-span-2 font-medium">{v.constancia.titular}</dd>
                <dt className="text-slate-500">Evento</dt>
                <dd className="col-span-2">
                  {v.constancia.tipo === 'EXAMEN' ? 'Examen' : 'Clase'} de {v.constancia.curso}
                </dd>
                <dt className="text-slate-500">Fecha</dt>
                <dd className="col-span-2">{new Date(v.constancia.fecha).toLocaleString('es-AR', { dateStyle: 'long', timeStyle: 'short' })}</dd>
                <dt className="text-slate-500">Lugar</dt>
                <dd className="col-span-2">
                  {v.constancia.sede} · {v.constancia.aula}
                </dd>
                <dt className="text-slate-500">Código</dt>
                <dd className="col-span-2 font-mono">{v.codigo}</dd>
                <dt className="text-slate-500">SHA-256</dt>
                <dd className="col-span-2 break-all font-mono text-xs text-slate-500">{v.hash}</dd>
              </dl>
            )}
            <p className="border-t border-slate-100 px-6 py-4 text-xs text-slate-400">
              La verificación usa la firma Ed25519 del servidor. No se muestran datos personales sensibles.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
