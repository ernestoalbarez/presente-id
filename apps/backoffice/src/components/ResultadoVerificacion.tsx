import type { ResultadoVerificacion, VerificacionIdentidadResponse } from '@presente/shared';

const ESTILO: Record<ResultadoVerificacion, { texto: string; clase: string; icono: string }> = {
  VALIDO: { texto: 'VÁLIDO', clase: 'bg-green-600', icono: '✓' },
  VENCIDO: { texto: 'VENCIDO', clase: 'bg-amber-500', icono: '⏱' },
  INVALIDO: { texto: 'INVÁLIDO', clase: 'bg-red-600', icono: '✕' },
  DISPOSITIVO_REVOCADO: { texto: 'DISPOSITIVO REVOCADO', clase: 'bg-slate-800', icono: '⛔' },
};

export const etiquetaResultado = (r: ResultadoVerificacion) => ESTILO[r];

export function ResultadoVerificacionCard({ v }: { v: VerificacionIdentidadResponse }) {
  const e = ESTILO[v.resultado];
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className={`${e.clase} px-6 py-4 text-white`}>
        <p className="text-3xl font-bold">
          {e.icono} {e.texto}
        </p>
        {v.motivo && <p className="mt-1 text-white/90">{v.motivo}</p>}
      </div>
      {v.estudiante ? (
        <div className="flex gap-5 p-6">
          <img src={v.estudiante.fotoUrl} alt="" className="h-32 w-32 rounded-xl object-cover" />
          <div className="space-y-1 text-sm">
            <p className="text-xl font-semibold">
              {v.estudiante.nombre} {v.estudiante.apellido}
            </p>
            <p>
              <span className="text-slate-500">DNI</span> {v.estudiante.dni} · <span className="text-slate-500">Legajo</span> {v.estudiante.legajo}
            </p>
            <p>{v.estudiante.carrera}</p>
            <p>
              <span className="text-slate-500">Identidad:</span> {v.estudiante.estadoValidacion}
            </p>
            <p>
              <span className="text-slate-500">Cursos:</span> {v.estudiante.cursos.join(', ') || '—'}
            </p>
          </div>
        </div>
      ) : (
        <p className="p-6 text-slate-500">No se puede identificar a quién pertenece este código.</p>
      )}
    </div>
  );
}
