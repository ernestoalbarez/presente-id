// Sesión en vivo: QR de asistencia rotativo (proyectable a pantalla completa) + lista de
// presentes que se actualiza cada 3 s + correcciones manuales + verificación cruzada en exámenes.
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { QRCodeSVG } from 'qrcode.react';
import type { AsistenciaItem, QrAsistenciaResponse, SesionDetalle, VerificacionIdentidadResponse } from '@presente/shared';
import { api } from '../api/client';
import { usePolling } from '../api/usePolling';
import { EscanerQr } from '../components/EscanerQr';
import { ResultadoVerificacionCard } from '../components/ResultadoVerificacion';
import { BadgeEstado, Boton, hora, Tarjeta, Titulo } from '../components/ui';

/** Pide un QR nuevo al servidor cada `rotaEnSeg` segundos mientras la sesión está abierta. */
function useQrRotativo(sesionId: string, activo: boolean) {
  const [qr, setQr] = useState<string | null>(null);
  const [restante, setRestante] = useState(0);

  useEffect(() => {
    if (!activo) {
      setQr(null);
      return;
    }
    let vence = 0;
    let cancelado = false;
    const pedir = async () => {
      try {
        const r = await api<QrAsistenciaResponse>(`/sesiones/${sesionId}/qr`);
        if (cancelado) return;
        setQr(r.qr);
        vence = Date.now() + r.rotaEnSeg * 1000;
      } catch {
        vence = Date.now() + 3000; // reintento
      }
    };
    void pedir();
    const id = setInterval(() => {
      const s = Math.ceil((vence - Date.now()) / 1000);
      setRestante(Math.max(s, 0));
      if (s <= 0) void pedir();
    }, 1000);
    return () => {
      cancelado = true;
      clearInterval(id);
    };
  }, [sesionId, activo]);

  return { qr, restante };
}

export function SesionEnVivoPage() {
  const { id = '' } = useParams();
  const { data: s, recargar } = usePolling<SesionDetalle>(`/sesiones/${id}`);
  const [proyectando, setProyectando] = useState(false);
  const { qr, restante } = useQrRotativo(id, s?.estado === 'ABIERTA');

  const accion = useCallback(
    async (path: string, body: object = {}, metodo?: string) => {
      try {
        await api(path, { body, method: metodo });
        await recargar();
      } catch (e) {
        alert(e instanceof Error ? e.message : String(e));
      }
    },
    [recargar],
  );

  // Esc cierra la proyección.
  useEffect(() => {
    if (!proyectando) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setProyectando(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [proyectando]);

  if (!s) return <p className="text-slate-500">Cargando…</p>;
  const presentes = s.asistencias.filter((a) => a.asistencia).length;

  const corregir = (a: AsistenciaItem) => {
    const presente = !a.asistencia;
    const motivo = window.prompt(
      `${presente ? 'Marcar presente' : 'Anular el presente de'} ${a.nombre} ${a.apellido}. Motivo (queda auditado):`,
      presente ? 'Presente sin celular' : 'Marcado por error',
    );
    if (motivo) void accion(`/sesiones/${s.id}/asistencias/${a.estudianteId}`, { presente, motivo }, 'PUT');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <Titulo
          sub={`${new Date(s.inicio).toLocaleDateString('es-AR')} · ${hora(s.inicio)}–${hora(s.fin)} · ${s.aula} · tolerancia ${s.toleranciaMin} min`}
        >
          {s.tipo === 'EXAMEN' ? 'Examen' : 'Clase'} de {s.curso} <BadgeEstado estado={s.estado} />
        </Titulo>
        <div className="flex gap-2">
          {s.estado !== 'ABIERTA' && <Boton onClick={() => accion(`/sesiones/${s.id}/abrir`)}>{s.estado === 'CERRADA' ? 'Reabrir' : 'Abrir sesión'}</Boton>}
          {s.estado === 'ABIERTA' && (
            <Boton variante="peligro" onClick={() => accion(`/sesiones/${s.id}/cerrar`)}>
              Cerrar sesión
            </Boton>
          )}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-5">
        <div className="space-y-6 xl:col-span-2">
          <Tarjeta className="flex flex-col items-center gap-3 text-center">
            {s.estado === 'ABIERTA' && qr ? (
              <>
                <QRCodeSVG value={qr} size={280} level="M" />
                <p className="text-sm text-slate-500">Se renueva en {restante} s</p>
                <Boton onClick={() => setProyectando(true)}>Proyectar a pantalla completa</Boton>
              </>
            ) : (
              <p className="py-16 text-slate-500">
                {s.estado === 'CERRADA' ? 'La sesión está cerrada.' : 'Abrí la sesión para mostrar el QR de asistencia.'}
              </p>
            )}
            {s.estado === 'ABIERTA' && !s.aceptaPresentes && <p className="text-sm text-amber-700">⚠ {s.motivoNoAcepta}</p>}
          </Tarjeta>
          {s.requiereVerificacionIdentidad && <VerificacionCruzada sesionId={s.id} onVerificado={recargar} />}
        </div>

        <Tarjeta className="overflow-x-auto p-0 xl:col-span-3">
          <h2 className="border-b border-slate-200 px-5 py-3 font-semibold">
            Presentes {presentes}/{s.asistencias.length} <span className="text-sm font-normal text-slate-400">· se actualiza cada 3 s</span>
          </h2>
          <ul className="divide-y divide-slate-100 text-sm">
            {s.asistencias.map((a) => (
              <li key={a.estudianteId} className="flex items-center gap-3 px-5 py-2.5">
                <img src={a.fotoUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
                <div className="flex-1">
                  <p className="font-medium">
                    {a.apellido}, {a.nombre}
                  </p>
                  <p className="text-slate-400">{a.legajo}</p>
                </div>
                <EstadoPresente a={a} exigeVerificacion={s.requiereVerificacionIdentidad} />
                <button onClick={() => corregir(a)} className="text-xs text-indigo-700 hover:underline">
                  {a.asistencia ? 'Anular' : 'Marcar presente'}
                </button>
              </li>
            ))}
          </ul>
        </Tarjeta>
      </div>

      {proyectando && qr && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-white" onClick={() => setProyectando(false)}>
          <p className="text-4xl font-bold">
            {s.curso} · {s.aula}
          </p>
          <QRCodeSVG value={qr} size={Math.min(window.innerHeight, window.innerWidth) * 0.65} level="M" />
          <p className="text-2xl text-slate-600">
            Escaneá con la app PresenteID · se renueva en {restante} s · {presentes}/{s.asistencias.length} presentes
          </p>
          <p className="text-sm text-slate-400">Esc o clic para salir</p>
        </div>
      )}
    </div>
  );
}

function EstadoPresente({ a, exigeVerificacion }: { a: AsistenciaItem; exigeVerificacion: boolean }) {
  if (!a.asistencia) return <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-500">Ausente</span>;
  return (
    <span className="flex items-center gap-1.5">
      <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">
        {a.asistencia.metodo === 'MANUAL' ? 'Manual' : 'QR'} {hora(a.asistencia.timestamp)}
      </span>
      {exigeVerificacion &&
        (a.asistencia.verificadaPresencialmente ? (
          <span className="rounded bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-800">✓ Identidad</span>
        ) : (
          <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">Sin verificar</span>
        ))}
    </span>
  );
}

const EFECTO = {
  VERIFICADA: { texto: 'Presente verificado presencialmente', clase: 'text-green-700' },
  SIN_PRESENTE: { texto: 'El estudiante todavía no dio presente con el QR del aula', clase: 'text-amber-700' },
  NO_INSCRIPTO: { texto: 'El estudiante no está inscripto en este curso', clase: 'text-red-700' },
};

/** Examen: escanear la credencial del estudiante marca su presente como verificado en persona. */
function VerificacionCruzada({ sesionId, onVerificado }: { sesionId: string; onVerificado: () => void }) {
  const [activo, setActivo] = useState(false);
  const [resultado, setResultado] = useState<VerificacionIdentidadResponse | null>(null);

  const verificar = async (qr: string) => {
    try {
      setResultado(await api<VerificacionIdentidadResponse>('/verificaciones/identidad', { body: { qr, sesionId } }));
      onVerificado();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
      setActivo(false);
    }
  };

  return (
    <Tarjeta className="space-y-3">
      <h2 className="font-semibold">Verificación de identidad</h2>
      <p className="text-sm text-slate-600">Escaneá la credencial de cada estudiante para marcar su presente como verificado en persona.</p>
      {resultado ? (
        <>
          <ResultadoVerificacionCard v={resultado} />
          {resultado.efectoEnSesion && <p className={`font-medium ${EFECTO[resultado.efectoEnSesion].clase}`}>{EFECTO[resultado.efectoEnSesion].texto}</p>}
          <Boton onClick={() => setResultado(null)}>Escanear otro</Boton>
        </>
      ) : activo ? (
        <>
          <EscanerQr activo onLeido={verificar} />
          <Boton variante="secundario" onClick={() => setActivo(false)}>
            Cancelar
          </Boton>
        </>
      ) : (
        <Boton onClick={() => setActivo(true)}>Escanear credencial</Boton>
      )}
    </Tarjeta>
  );
}
