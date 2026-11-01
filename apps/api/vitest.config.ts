import { defineConfig } from 'vitest/config';

// Los tests usan una base SQLite propia (prisma/test.db) y un par de claves fijo SOLO PARA
// TESTS, así no dependen de apps/api/.env ni pisan la base de desarrollo. Tiene que ser fijo:
// este archivo se evalúa más de una vez (proyectos), y el seed de globalSetup tiene que firmar
// con la misma clave con la que después verifican los workers.
const env = {
  DATABASE_URL: 'file:./test.db',
  SERVER_ED25519_D: 'pc16XpYtJ4OC0DEUxEzWBzOhqp-G0Kug6XAHBWg3svc',
  SERVER_ED25519_X: 'yvtA27PwiPpTGllifkecqvtyjn1NzZt_FZOENMV2GfE',
  DEMO_MODE: 'true',
  MOCK_RENAPER_LATENCIA_MS: '0',
};
Object.assign(process.env, env); // para globalSetup (corre en este proceso)

// Dos proyectos: "unit" (*.unit.test.ts, sin base de datos) e "integration" (resetea y
// carga el seed en test.db antes de correr). `vitest run --project unit` corre solo los unitarios.
export default defineConfig({
  test: {
    env,
    fileParallelism: false, // los tests de integración comparten la misma base
    projects: [
      { extends: true, test: { name: 'unit', include: ['src/**/*.unit.test.ts'] } },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['src/**/*.test.ts'],
          exclude: ['src/**/*.unit.test.ts'],
          globalSetup: ['src/test/globalSetup.ts'],
        },
      },
    ],
  },
});
