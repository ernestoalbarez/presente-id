import 'dotenv/config'; // carga apps/api/.env sin pisar variables ya definidas

function requerida(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Falta la variable de entorno ${name}. Corré "pnpm db:seed" o "pnpm keys:generate".`);
  return v;
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  demoMode: process.env.DEMO_MODE === 'true',
  staffTokenTtlHoras: Number(process.env.STAFF_TOKEN_TTL_HORAS ?? 8),
  /** Latencia fija del mock de RENAPER (ms); si no se define, es aleatoria entre 1 y 2 s. */
  mockRenaperLatenciaMs: process.env.MOCK_RENAPER_LATENCIA_MS ? Number(process.env.MOCK_RENAPER_LATENCIA_MS) : undefined,
  backofficePublicUrl: process.env.BACKOFFICE_PUBLIC_URL ?? 'http://localhost:5173',
  serverKey: {
    d: requerida('SERVER_ED25519_D'),
    x: requerida('SERVER_ED25519_X'),
  },
};
