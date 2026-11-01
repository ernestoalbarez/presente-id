# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# PresenteID

Especificación completa: @docs/PROMPT.md

## Estado
- Etapa actual: 6 terminada (auditoría, modo demo, tests, README y diagramas). Las 6 etapas del prompt están completas.

## Comandos
- `pnpm install && pnpm db:seed && pnpm dev`: API en :3000, backoffice en :5173, Metro en :8081.
- `pnpm test` / `pnpm typecheck`. Un solo test: `pnpm --filter @presente/api test -- <patrón>`.
- `pnpm keys:generate`: regenera el par Ed25519 del servidor en `apps/api/.env`.
- Los tests de la API usan `apps/api/prisma/test.db` y claves efímeras (ver `apps/api/vitest.config.ts`). Los `*.unit.test.ts` no tocan la base: `pnpm --filter @presente/api exec vitest run --project unit`. Las suites de integración comparten una base seedeada una sola vez y corren en orden variable: cada suite usa DNIs distintos (ver `src/test/helpers.ts`) y no puede asumir el estado de las sesiones del seed (abrirlas o cerrarlas explícitamente).
- App: `pnpm dev:mobile` (Expo Go, SDK 58). Para verificar que Metro bundlea sin un celular: `cd apps/mobile && CI=1 npx expo export --platform ios --output-dir /tmp/x`.
- `pnpm db:seed` y el setup de tests usan `prisma db push --force-reset`, que Prisma bloquea cuando lo corre un agente: pedile al usuario que los ejecute.

## Arquitectura (lo no obvio)
- `packages/shared` se importa como TypeScript fuente (sin build): enums de dominio (en SQLite son `String`), esquemas zod y constantes.
- Toda validación de tiempo en la API usa `clock.now()` (`apps/api/src/lib/clock.ts`), nunca `Date.now()`: el modo demo adelanta ese reloj.
- Tokens del servidor: `apps/api/src/lib/tokens.ts`, con una clave Ed25519 y el header `typ` por tipo de token. Para un token nuevo hay que agregar su tipo a `TipoToken`.
- Express 5: los errores async llegan solos al `errorHandler`. Para errores esperados, `throw new HttpError(status, mensaje, codigo)`; los `ZodError` se responden como 400.
- El backoffice llama a la API vía el proxy `/api` de Vite (sin CORS ni URL configurable).
- Auth de la app: `authDevice` (`apps/api/src/middleware/authDevice.ts`) verifica el token del dispositivo y que el `Dispositivo` siga ACTIVO en la base en cada request. La regla de un solo dispositivo activo vive en `vincularDispositivo` (`modules/dispositivos/service.ts`).
- Identidad: la API depende solo de `IdentityProvider`; el mock está en `apps/api/src/identity/`.
- Firmas del teléfono: JWS EdDSA hecho a mano sobre noble en `packages/shared/src/crypto/jws.ts` (compatible con `jose`). El QR de identidad lo firma el teléfono (`shared/src/qr.ts`) y lo valida `verificarQrIdentidad` (`apps/api/src/modules/verificaciones/qrIdentidad.ts`), una función pura con dependencias inyectadas para poder testearla sin base. Antirreplay en `lib/nonces.ts`.
- Presente: el QR del aula es un token del servidor; la app lo envuelve en un JWS firmado por el teléfono (`firmarEscaneo`), que valida `verificarEscaneoFirmado` (`lib/escaneoFirmado.ts`, reutilizable para el ingreso a sede). Las reglas de horario están en `modules/sesiones/reglas.ts`. La app enruta cada QR según el `typ` del header (`apps/mobile/src/lib/escaneo.ts`).
- Constancias: `modules/constancias/service.ts`. Toda asistencia nueva (QR o manual, también en el seed) tiene que pasar por `emitirConstancia` dentro de la misma transacción, y al anular se usa `revocarConstanciaDe` (no se borran).
- Routers montados en `/` (`registroRouter`, `puertasRouter`) no pueden usar `router.use(auth)`: aplicaría a cualquier URL. La auth va por ruta.
- Backoffice: `/verificar/:codigo` es pública y se resuelve antes del login (`App.tsx`).
- Auditoría: toda acción sensible nueva llama a `auditar()` con un `accion` que tiene que estar en `ACCIONES_AUDITORIA` (`packages/shared/src/schemas/auditoria.ts`) para tener categoría y etiqueta en el backoffice.
- Modo demo: `modules/demo/routes.ts`. El desfase del reloj está en memoria (`lib/clock.ts`).
- README: los diagramas Mermaid son parte de la entrega; si cambia un flujo, actualizar su diagrama.
- Mobile: sin librería de navegación; `apps/mobile/src/App.tsx` es una máquina de estados guiada por `GET /yo` (`situacion`). La clave privada del dispositivo vive en SecureStore (`src/lib/dispositivo.ts`).

## Reglas de trabajo
- Trabajamos por etapas (ver "Forma de trabajo" en el prompt). No avances a la siguiente sin mi confirmación.
- Al terminar cada etapa: verificá que compile y corra, decime cómo probarlo y actualizá "Etapa actual" arriba.
- Decisiones de diseño → anotarlas en el README.
- Si PROMPT.md se contradice, manda la sección "Stack (simplificado)": sin rol Admin, sin geolocalización, tiempo real por polling cada 3 s.
- Identificadores de dominio y modelos Prisma en español, como en PROMPT.md (`Estudiante`, `Sesion`, `Asistencia`); comentarios y README en español.
- Si Metro (Expo) tira errores de resolución de módulos en el monorepo, usar `node-linker=hoisted` en `.npmrc`.
