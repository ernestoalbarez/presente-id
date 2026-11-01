import { useState } from 'react';
import type { VerificacionIdentidadResponse, VerificacionResumen } from '@presente/shared';
import { api } from '../api/client';
import { usePolling } from '../api/usePolling';
import { EscanerQr } from '../components/EscanerQr';
import { etiquetaResultado, ResultadoVerificacionCard } from '../components/ResultadoVerificacion';
import { Boton, fechaHora, Tarjeta, Titulo } from '../components/ui';

/** El docente/directivo escanea el QR que muestra el estudiante en su app. */
export function VerificarIdentidadPage() {
  const [resultado, setResultado] = useState<VerificacionIdentidadResponse | null>(null);
  const [verificando, setVerificando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState('');
  const historial = usePolling<VerificacionResumen[]>('/verificaciones');

  const verificar = async (qr: string) => {
    setVerificando(true);
    setError(null);
    try {
      setResultado(await api<VerificacionIdentidadResponse>('/verificaciones/identidad', { body: { qr } }));
      void historial.recargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setVerificando(false);
    }
  };

  const otro = () => {
    setResultado(null);
    setError(null);
    setManual('');
  };

  return (
    <div>
      <Titulo sub="Pedile al estudiante que abra su credencial en la app y apuntá la cámara al QR.">Verificar identidad</Titulo>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          {resultado ? (
            <>
              <ResultadoVerificacionCard v={resultado} />
              <Boton onClick={otro}>Escanear otro</Boton>
            </>
          ) : (
            <>
              <EscanerQr activo={!verificando && !error} onLeido={verificar} />
              {verificando && <p className="text-slate-500">Verificando…</p>}
              {error && (
                <div className="space-y-2">
                  <p className="text-red-600">{error}</p>
                  <Boton onClick={otro}>Reintentar</Boton>
                </div>
              )}
              <details className="text-sm">
                <summary className="cursor-pointer text-slate-500">¿Sin cámara? Pegá el contenido del QR</summary>
                <textarea
                  value={manual}
                  onChange={(e) => setManual(e.target.value)}
                  rows={4}
                  className="mt-2 w-full rounded-md border border-slate-300 p-2 font-mono text-xs"
                  placeholder="eyJhbGciOiJFZERTQSIs…"
                />
                <Boton onClick={() => verificar(manual)} disabled={!manual.trim() || verificando}>
                  Verificar
                </Boton>
              </details>
            </>
          )}
        </div>

        <Tarjeta className="h-fit p-0">
          <h2 className="border-b border-slate-200 px-5 py-3 font-semibold">Últimas verificaciones</h2>
          <ul className="divide-y divide-slate-100 text-sm">
            {historial.data?.length === 0 && <li className="px-5 py-4 text-slate-500">Todavía no hay verificaciones.</li>}
            {historial.data?.map((v) => {
              const e = etiquetaResultado(v.resultado);
              return (
                <li key={v.id} className="flex items-center gap-3 px-5 py-3">
                  <span className={`${e.clase} rounded px-2 py-0.5 text-xs font-bold text-white`}>{e.texto}</span>
                  <div className="flex-1">
                    <p>{v.estudiante ?? <span className="text-slate-400">Desconocido</span>}</p>
                    <p className="text-slate-400">
                      {fechaHora(v.fecha)} · por {v.verificador}
                      {v.motivo && ` · ${v.motivo}`}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </Tarjeta>
      </div>
    </div>
  );
}
