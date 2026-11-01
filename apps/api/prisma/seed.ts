// Datos de demo. Las fechas se calculan relativas al momento en que corre el seed, así
// siempre hay sesiones "de hoy" para la demo en vivo e historial para los reportes.
// Las constancias de los presentes precargados se agregan en la etapa 5 (firma del servidor).
import { generateKeyPairSync } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

export const PASSWORD_DEMO = 'demo1234';

type Caso = 'VALIDADO' | 'APROBABLE' | 'RECHAZO' | 'REVISION';

// Padrón RENAPER ficticio. `caso` indica cómo lo vamos a usar en la demo:
// - VALIDADO: ya registrado con un dispositivo (tiene historial precargado).
// - APROBABLE / RECHAZO (DNI termina en 0) / REVISION (DNI termina en 9): pendientes,
//   para registrarse en vivo desde la app.
// - `inscripto: false`: existe en RENAPER pero no en la institución → "no estás inscripto".
const PERSONAS: Array<{
  dni: string; sexo: 'M' | 'F'; nombre: string; apellido: string; nac: string;
  caso: Caso; inscripto?: false; carrera?: string;
}> = [
  { dni: '40123451', sexo: 'F', nombre: 'Camila', apellido: 'Fernández', nac: '1998-03-14', caso: 'VALIDADO' },
  { dni: '40234562', sexo: 'M', nombre: 'Tomás', apellido: 'González', nac: '1998-07-02', caso: 'VALIDADO' },
  { dni: '41345673', sexo: 'F', nombre: 'Lucía', apellido: 'Rodríguez', nac: '1999-01-21', caso: 'VALIDADO' },
  { dni: '41456784', sexo: 'M', nombre: 'Mateo', apellido: 'López', nac: '1999-05-30', caso: 'VALIDADO' },
  { dni: '42567895', sexo: 'F', nombre: 'Valentina', apellido: 'Martínez', nac: '2000-09-11', caso: 'VALIDADO' },
  { dni: '42678906', sexo: 'M', nombre: 'Benjamín', apellido: 'Sánchez', nac: '2000-12-04', caso: 'VALIDADO' },
  { dni: '43789017', sexo: 'F', nombre: 'Martina', apellido: 'Pérez', nac: '2001-02-17', caso: 'VALIDADO' },
  { dni: '43890128', sexo: 'M', nombre: 'Santiago', apellido: 'Romero', nac: '2001-06-25', caso: 'VALIDADO' },
  { dni: '44901231', sexo: 'F', nombre: 'Sofía', apellido: 'Díaz', nac: '2002-04-08', caso: 'APROBABLE' },
  { dni: '44012342', sexo: 'M', nombre: 'Joaquín', apellido: 'Álvarez', nac: '2002-08-19', caso: 'APROBABLE' },
  { dni: '45123453', sexo: 'F', nombre: 'Emma', apellido: 'Torres', nac: '2003-11-27', caso: 'APROBABLE' },
  { dni: '45234560', sexo: 'M', nombre: 'Lautaro', apellido: 'Ruiz', nac: '2003-01-05', caso: 'RECHAZO' },
  { dni: '45345670', sexo: 'F', nombre: 'Isabella', apellido: 'Ramírez', nac: '2003-03-16', caso: 'RECHAZO' },
  { dni: '46456789', sexo: 'M', nombre: 'Thiago', apellido: 'Flores', nac: '2004-07-23', caso: 'REVISION' },
  { dni: '46567899', sexo: 'F', nombre: 'Mía', apellido: 'Acosta', nac: '2004-10-02', caso: 'REVISION' },
  // Personas que existen en RENAPER pero NO están inscriptas en la institución.
  { dni: '38765435', sexo: 'M', nombre: 'Facundo', apellido: 'Benítez', nac: '1995-05-12', caso: 'APROBABLE', inscripto: false },
  { dni: '39876546', sexo: 'F', nombre: 'Agustina', apellido: 'Medina', nac: '1996-08-29', caso: 'APROBABLE', inscripto: false },
];

const CARRERAS = ['Ingeniería en Sistemas', 'Licenciatura en Informática'];

/** Número de trámite ficticio (11 dígitos) derivado del DNI, para que sea fácil de recordar. */
export const nroTramiteDe = (dni: string) => `00${dni.slice(-3)}${dni.slice(0, 6)}`;

/** Fecha = hoy + `dias`, a la hora local hh:mm. */
function dia(base: Date, dias: number, hh: number, mm = 0): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + dias);
  d.setHours(hh, mm, 0, 0);
  return d;
}

export async function seed(prisma: PrismaClient, ahora = new Date()) {
  const passwordHash = await bcrypt.hash(PASSWORD_DEMO, 10);

  // --- Institución, sedes y puertas -------------------------------------------------
  const institucion = await prisma.institucion.create({ data: { nombre: 'Instituto Universitario del Sur' } });
  const centro = await prisma.sede.create({
    data: { institucionId: institucion.id, nombre: 'Sede Centro', direccion: 'Av. Rivadavia 1234, CABA' },
  });
  const norte = await prisma.sede.create({
    data: { institucionId: institucion.id, nombre: 'Sede Norte', direccion: 'Av. Cabildo 4321, CABA' },
  });
  const puertaCentro = await prisma.puntoAcceso.create({ data: { sedeId: centro.id, nombre: 'Puerta principal', modo: 'ESTATICO' } });
  const biblioteca = await prisma.puntoAcceso.create({ data: { sedeId: centro.id, nombre: 'Acceso biblioteca', modo: 'ROTATIVO' } });
  const puertaNorte = await prisma.puntoAcceso.create({ data: { sedeId: norte.id, nombre: 'Puerta principal', modo: 'ESTATICO' } });

  // --- Staff ------------------------------------------------------------------------
  const staff = (email: string, nombre: string, apellido: string, rol: 'DOCENTE' | 'DIRECTIVO') =>
    prisma.usuario.create({ data: { email, nombre, apellido, rol, passwordHash } });
  const directora = await staff('directora@presente.edu.ar', 'Laura', 'Gómez', 'DIRECTIVO');
  const docente1 = await staff('docente1@presente.edu.ar', 'Martín', 'Pereyra', 'DOCENTE');
  const docente2 = await staff('docente2@presente.edu.ar', 'Silvia', 'Castro', 'DOCENTE');

  // --- Padrón RENAPER y estudiantes ---------------------------------------------------
  const estudiantes: Array<{ id: string; validado: boolean }> = [];
  for (const [i, p] of PERSONAS.entries()) {
    const fotoUrl = `https://i.pravatar.cc/300?img=${i + 1}`;
    await prisma.personaRenaper.create({
      data: { dni: p.dni, sexo: p.sexo, nroTramite: nroTramiteDe(p.dni), nombre: p.nombre, apellido: p.apellido, fechaNac: new Date(p.nac), fotoUrl },
    });
    if (p.inscripto === false) continue;

    const validado = p.caso === 'VALIDADO';
    const usuario = await prisma.usuario.create({ data: { rol: 'ESTUDIANTE', nombre: p.nombre, apellido: p.apellido } });
    const est = await prisma.estudiante.create({
      data: {
        usuarioId: usuario.id,
        dni: p.dni,
        legajo: `L-${String(1001 + i)}`,
        carrera: CARRERAS[i % CARRERAS.length],
        fotoUrl,
        estadoValidacion: validado ? 'VALIDADO' : 'PENDIENTE',
      },
    });
    if (validado) {
      // Dispositivo "ya vinculado": generamos un par de claves y descartamos la privada
      // (estos estudiantes solo aportan historial; no se usan desde un teléfono real).
      const { publicKey } = generateKeyPairSync('ed25519');
      const desde = dia(ahora, -30, 10);
      await prisma.validacionIdentidad.create({
        data: { estudianteId: est.id, dni: p.dni, resultado: 'APROBADO', createdAt: desde },
      });
      await prisma.dispositivo.create({
        data: {
          usuarioId: usuario.id,
          deviceId: `seed-device-${p.dni}`,
          publicKey: publicKey.export({ format: 'jwk' }).x!,
          modelo: 'Seed (sin teléfono real)',
          estado: 'ACTIVO',
          createdAt: desde,
          activadoAt: desde,
        },
      });
    }
    estudiantes.push({ id: est.id, validado });
  }

  // --- Cursos e inscripciones -------------------------------------------------------
  // Programación II tiene a todos, así cualquier estudiante registrado en vivo puede dar presente.
  const cursos = [
    { nombre: 'Programación II', codigo: 'PROG2', docenteId: docente1.id, sedeId: centro.id, alumnos: estudiantes },
    { nombre: 'Bases de Datos', codigo: 'BD', docenteId: docente1.id, sedeId: centro.id, alumnos: estudiantes.slice(0, 11) },
    { nombre: 'Redes y Comunicaciones', codigo: 'REDES', docenteId: docente2.id, sedeId: norte.id, alumnos: estudiantes.slice(4) },
  ];
  const cursoIds: Record<string, string> = {};
  for (const c of cursos) {
    const curso = await prisma.curso.create({
      data: { nombre: c.nombre, codigo: c.codigo, docenteId: c.docenteId, sedeId: c.sedeId },
    });
    cursoIds[c.codigo] = curso.id;
    await prisma.inscripcion.createMany({ data: c.alumnos.map((a) => ({ estudianteId: a.id, cursoId: curso.id })) });
  }

  // --- Sesiones ---------------------------------------------------------------------
  // Pasadas (con presentes), futuras (vacías) y tres "de hoy" relativas a `ahora` para la demo.
  const enMin = (min: number) => new Date(ahora.getTime() + min * 60_000);
  const sesiones: Array<{
    curso: string; tipo: 'CLASE' | 'EXAMEN'; inicio: Date; fin: Date; aula: string; verif?: boolean;
  }> = [
    { curso: 'PROG2', tipo: 'CLASE', inicio: dia(ahora, -7, 18, 30), fin: dia(ahora, -7, 22), aula: 'Aula 12' },
    { curso: 'PROG2', tipo: 'CLASE', inicio: dia(ahora, -5, 18, 30), fin: dia(ahora, -5, 22), aula: 'Aula 12' },
    { curso: 'PROG2', tipo: 'CLASE', inicio: dia(ahora, -2, 18, 30), fin: dia(ahora, -2, 22), aula: 'Aula 12' },
    { curso: 'PROG2', tipo: 'CLASE', inicio: enMin(-15), fin: enMin(180), aula: 'Aula 12' },
    { curso: 'PROG2', tipo: 'CLASE', inicio: dia(ahora, 2, 18, 30), fin: dia(ahora, 2, 22), aula: 'Aula 12' },
    { curso: 'BD', tipo: 'CLASE', inicio: dia(ahora, -6, 18, 30), fin: dia(ahora, -6, 22), aula: 'Laboratorio 3' },
    { curso: 'BD', tipo: 'CLASE', inicio: dia(ahora, -3, 18, 30), fin: dia(ahora, -3, 22), aula: 'Laboratorio 3' },
    { curso: 'BD', tipo: 'EXAMEN', inicio: enMin(-15), fin: enMin(180), aula: 'Laboratorio 3', verif: true },
    { curso: 'REDES', tipo: 'CLASE', inicio: dia(ahora, -6, 19), fin: dia(ahora, -6, 22, 30), aula: 'Aula 4 (Norte)' },
    { curso: 'REDES', tipo: 'CLASE', inicio: dia(ahora, -1, 19), fin: dia(ahora, -1, 22, 30), aula: 'Aula 4 (Norte)' },
    { curso: 'REDES', tipo: 'CLASE', inicio: enMin(60), fin: enMin(240), aula: 'Aula 4 (Norte)' },
  ];

  for (const [si, s] of sesiones.entries()) {
    const pasada = s.fin < ahora;
    const sesion = await prisma.sesion.create({
      data: {
        cursoId: cursoIds[s.curso],
        tipo: s.tipo,
        inicio: s.inicio,
        fin: s.fin,
        aula: s.aula,
        requiereVerificacionIdentidad: s.verif ?? false,
        abiertaAt: pasada ? s.inicio : null,
        cerradaAt: pasada ? s.fin : null,
      },
    });
    if (!pasada) continue;

    // Presentes precargados: ~80% de los estudiantes validados del curso (patrón determinista).
    const alumnos = cursos.find((c) => c.codigo === s.curso)!.alumnos.filter((a) => a.validado);
    for (const [ai, a] of alumnos.entries()) {
      if ((ai + si) % 5 === 0) continue; // ausente
      const manual = (ai + si) % 7 === 0; // algunos cargados a mano por el docente
      await prisma.asistencia.create({
        data: {
          estudianteId: a.id,
          sesionId: sesion.id,
          timestamp: new Date(s.inicio.getTime() + (5 + ai * 2) * 60_000),
          metodo: manual ? 'MANUAL' : 'QR',
          registradaPorId: manual ? cursos.find((c) => c.codigo === s.curso)!.docenteId : null,
        },
      });
    }
  }

  // --- Ingresos a sede --------------------------------------------------------------
  const validados = estudiantes.filter((e) => e.validado);
  for (const dias of [-3, -2, -1]) {
    for (const [i, e] of validados.entries()) {
      if ((i + dias) % 4 === 0) continue;
      const puerta = i >= 4 ? puertaNorte : i % 3 === 0 ? biblioteca : puertaCentro;
      await prisma.eventoIngreso.createMany({
        data: [
          { estudianteId: e.id, puntoAccesoId: puerta.id, tipo: 'INGRESO', timestamp: dia(ahora, dias, 17 + (i % 3), 10 + i * 4) },
          { estudianteId: e.id, puntoAccesoId: puerta.id, tipo: 'EGRESO', timestamp: dia(ahora, dias, 22, 10 + i * 2) },
        ],
      });
    }
  }
  // Algunos ingresos de hoy (antes de "ahora") para que el reporte del día no esté vacío.
  for (const [i, e] of validados.slice(0, 5).entries()) {
    await prisma.eventoIngreso.create({
      data: { estudianteId: e.id, puntoAccesoId: i % 2 ? biblioteca.id : puertaCentro.id, tipo: 'INGRESO', timestamp: enMin(-90 + i * 12) },
    });
  }

  return { directora, docente1, docente2 };
}

// Ejecución directa: `tsx prisma/seed.ts` (lo llama `pnpm db:seed` después de resetear la base).
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const prisma = new PrismaClient();
  seed(prisma)
    .then(() => {
      console.log('Seed completo. Usuarios de backoffice (contraseña "%s"):', PASSWORD_DEMO);
      console.log('  directora@presente.edu.ar · docente1@presente.edu.ar · docente2@presente.edu.ar');
    })
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
