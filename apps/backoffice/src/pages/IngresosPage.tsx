// Ingresos a sede: reporte del día (por sede, por franja horaria y detalle) y gestión de puertas.
import { useState, type FormEvent } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import type { ModoPuntoAcceso, PuntoAccesoInfo, QrPuertaResponse, ReporteIngresos, SedeConPuntos } from '@presente/shared';
import { api } from '../api/client';
import { usePolling } from '../api/usePolling';
import { useQrRotativo } from '../api/useQrRotativo';
import { Boton, hora, Tarjeta, Titulo, Vacio } from '../components/ui';

const hoyLocal = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
};

export function IngresosPage() {
  const [fecha, setFecha] = useState(hoyLocal);
  const [sedeId, setSedeId] = useState('');
  const sedes = usePolling<SedeConPuntos[]>('/sedes');
  const { data: r } = usePolling<ReporteIngresos>(`/reportes/ingresos?fecha=${fecha}&sedeId=${sedeId}`);
  const [puntoQr, setPuntoQr] = useState<PuntoAccesoInfo | null>(null);
  const maxFranja = Math.max(1, ...(r?.porFranja.map((f) => f.ingresos) ?? []));

  return (
    <div className="space-y-8">
      <Titulo sub="Los estudiantes registran su ingreso escaneando el QR de la puerta con la app.">Ingresos a sede</Titulo>

      <div className="flex flex-wrap gap-3">
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
        <select value={sedeId} onChange={(e) => setSedeId(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="">Todas las sedes</option>
          {sedes.data?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nombre}
            </option>
          ))}
        </select>
      </div>

      {r && (
        <div className="grid gap-6 xl:grid-cols-3">
          <div className="space-y-4">
            {r.porSede.length === 0 && <Vacio>Sin movimientos este día.</Vacio>}
            {r.porSede.map((s) => (
              <Tarjeta key={s.sede}>
                <p className="font-semibold">{s.sede}</p>
                <p className="mt-1 text-3xl font-bold">{s.ingresos}</p>
                <p className="text-sm text-slate-500">
                  ingresos · {s.egresos} egresos · {s.estudiantes} estudiantes
                </p>
              </Tarjeta>
            ))}
            <Tarjeta>
              <p className="mb-3 font-semibold">Ingresos por franja horaria</p>
              <div className="space-y-1.5">
                {r.porFranja.map((f) => (
                  <div key={f.hora} className="flex items-center gap-2 text-sm">
                    <span className="w-12 text-slate-500">{String(f.hora).padStart(2, '0')}:00</span>
                    <div className="h-4 rounded bg-indigo-500" style={{ width: `${(f.ingresos / maxFranja) * 75}%` }} />
                    <span>{f.ingresos}</span>
                  </div>
                ))}
              </div>
            </Tarjeta>
          </div>

          <Tarjeta className="overflow-x-auto p-0 xl:col-span-2">
            <h2 className="border-b border-slate-200 px-5 py-3 font-semibold">Movimientos ({r.eventos.length})</h2>
            <table className="w-full text-left text-sm">
              <tbody>
                {r.eventos.map((e) => (
                  <tr key={e.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-5 py-2 text-slate-500">{hora(e.timestamp)}</td>
                    <td className="px-5 py-2">
                      <span className={`rounded px-2 py-0.5 text-xs font-semibold ${e.tipo === 'INGRESO' ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}>
                        {e.tipo}
                      </span>
                    </td>
                    <td className="px-5 py-2">
                      {e.estudiante} <span className="text-slate-400">{e.legajo}</span>
                    </td>
                    <td className="px-5 py-2 text-slate-500">
                      {e.sede} · {e.punto}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Tarjeta>
        </div>
      )}

      <Puertas sedes={sedes.data ?? []} onRecargar={sedes.recargar} onMostrarQr={setPuntoQr} />
      {puntoQr && <QrPuerta punto={puntoQr} onCerrar={() => setPuntoQr(null)} />}
    </div>
  );
}

function Puertas({ sedes, onRecargar, onMostrarQr }: { sedes: SedeConPuntos[]; onRecargar: () => Promise<void>; onMostrarQr: (p: PuntoAccesoInfo) => void }) {
  const [sedeId, setSedeId] = useState('');
  const [nombre, setNombre] = useState('');
  const [modo, setModo] = useState<ModoPuntoAcceso>('ESTATICO');

  const crear = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api('/puntos-acceso', { body: { sedeId: sedeId || sedes[0]?.id, nombre, modo } });
      setNombre('');
      await onRecargar();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">Puertas y QRs de acceso</h2>
      <div className="grid gap-4 xl:grid-cols-3">
        {sedes.map((s) => (
          <Tarjeta key={s.id}>
            <p className="font-semibold">{s.nombre}</p>
            <p className="mb-3 text-sm text-slate-500">{s.direccion}</p>
            <ul className="space-y-2 text-sm">
              {s.puntos.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2">
                  <span>
                    {p.nombre} <span className="text-xs text-slate-400">{p.modo === 'ROTATIVO' ? 'pantalla rotativa' : 'impreso'}</span>
                  </span>
                  <Boton variante="secundario" onClick={() => onMostrarQr(p)}>
                    Ver QR
                  </Boton>
                </li>
              ))}
            </ul>
          </Tarjeta>
        ))}
        <Tarjeta>
          <p className="mb-3 font-semibold">Nueva puerta</p>
          <form onSubmit={crear} className="space-y-3 text-sm">
            <select value={sedeId} onChange={(e) => setSedeId(e.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2">
              {sedes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} required placeholder="Ej.: Puerta lateral" className="w-full rounded-md border border-slate-300 px-3 py-2" />
            <select value={modo} onChange={(e) => setModo(e.target.value as ModoPuntoAcceso)} className="w-full rounded-md border border-slate-300 px-3 py-2">
              <option value="ESTATICO">QR impreso (estático)</option>
              <option value="ROTATIVO">Pantalla en la entrada (rotativo)</option>
            </select>
            <button className="w-full rounded-md bg-indigo-600 py-2 font-medium text-white hover:bg-indigo-700">Crear puerta</button>
          </form>
        </Tarjeta>
      </div>
    </section>
  );
}

/** QR de una puerta a pantalla completa (para imprimir o dejar en una pantalla en la entrada). */
function QrPuerta({ punto, onCerrar }: { punto: PuntoAccesoInfo; onCerrar: () => void }) {
  const { data, restante } = useQrRotativo<QrPuertaResponse>(`/puntos-acceso/${punto.id}/qr`);
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-white print:gap-8">
      {data ? (
        <>
          <p className="text-4xl font-bold">{data.sede}</p>
          <p className="text-2xl text-slate-600">{data.punto} · Registrá tu ingreso con la app PresenteID</p>
          <QRCodeSVG value={data.qr} size={Math.min(window.innerHeight, window.innerWidth) * 0.6} level="M" />
          {data.rotaEnSeg ? <p className="text-xl text-slate-500">Se renueva en {restante} s</p> : <p className="text-slate-500">QR estático (válido por un año)</p>}
        </>
      ) : (
        <p className="text-slate-500">Generando…</p>
      )}
      <div className="flex gap-2 print:hidden">
        {data && !data.rotaEnSeg && <Boton onClick={() => window.print()}>Imprimir</Boton>}
        <Boton variante="secundario" onClick={onCerrar}>
          Cerrar
        </Boton>
      </div>
    </div>
  );
}
