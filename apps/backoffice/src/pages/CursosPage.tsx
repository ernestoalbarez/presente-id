import { Link } from 'react-router';
import { usePolling } from '../api/usePolling';
import { Tarjeta, Titulo } from '../components/ui';

interface Curso {
  id: string;
  nombre: string;
  codigo: string;
  sede: string;
  docente: string;
  inscriptos: number;
  sesiones: number;
}

export function CursosPage() {
  const { data } = usePolling<Curso[]>('/cursos');
  return (
    <div>
      <Titulo>Cursos</Titulo>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data?.map((c) => (
          <Link key={c.id} to={`/cursos/${c.id}`}>
            <Tarjeta className="transition hover:border-indigo-300 hover:shadow">
              <p className="text-xs font-semibold text-indigo-700">{c.codigo}</p>
              <p className="text-lg font-semibold">{c.nombre}</p>
              <p className="text-sm text-slate-600">
                {c.sede} · {c.docente}
              </p>
              <p className="mt-3 text-sm text-slate-500">
                {c.inscriptos} inscriptos · {c.sesiones} sesiones
              </p>
            </Tarjeta>
          </Link>
        ))}
      </div>
    </div>
  );
}
