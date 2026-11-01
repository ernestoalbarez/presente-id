import type { ReactNode } from 'react';

export const Titulo = ({ children, sub }: { children: ReactNode; sub?: ReactNode }) => (
  <div className="mb-6">
    <h1 className="text-2xl font-bold">{children}</h1>
    {sub && <p className="mt-1 text-slate-600">{sub}</p>}
  </div>
);

export const Tarjeta = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <div className={`rounded-xl border border-slate-200 bg-white p-5 ${className}`}>{children}</div>
);

export const Vacio = ({ children }: { children: ReactNode }) => (
  <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500">{children}</p>
);

export function Boton({
  children,
  onClick,
  variante = 'primario',
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  variante?: 'primario' | 'peligro' | 'secundario';
  disabled?: boolean;
}) {
  const estilos = {
    primario: 'bg-indigo-600 text-white hover:bg-indigo-700',
    peligro: 'border border-red-300 text-red-700 hover:bg-red-50',
    secundario: 'border border-slate-300 text-slate-700 hover:bg-slate-50',
  };
  return (
    <button onClick={onClick} disabled={disabled} className={`rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${estilos[variante]}`}>
      {children}
    </button>
  );
}

export const fechaHora = (iso: string) =>
  new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export const hora = (iso: string) => new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
export const fecha = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: '2-digit' });

const ESTADO_SESION = {
  PROGRAMADA: 'bg-slate-100 text-slate-700',
  ABIERTA: 'bg-green-100 text-green-800',
  CERRADA: 'bg-slate-800 text-white',
} as const;

export const BadgeEstado = ({ estado }: { estado: keyof typeof ESTADO_SESION }) => (
  <span className={`rounded px-2 py-0.5 text-xs font-semibold ${ESTADO_SESION[estado]}`}>{estado}</span>
);
