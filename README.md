# PresenteID

Prototipo para un trabajo práctico universitario: una app de identidad y presentismo estudiantil inspirada en POAP. El teléfono del estudiante funciona como credencial: valida su identidad (contra un mock de RENAPER), muestra un QR de identidad dinámico y escanea QRs para dar presente en el aula o registrar el ingreso a la sede. Cada presente válido genera una constancia firmada por el servidor (sin blockchain). Todos los servicios externos están mockeados.

> Estado: **etapa 3** (QR de identidad dinámico y verificación desde el backoffice). Las secciones de demo, diagramas y seguridad se completan en las etapas siguientes.

## Arquitectura

Monorepo `pnpm`:

| Paquete | Qué es |
|---|---|
| `apps/api` | Express + TypeScript, SQLite + Prisma. Firma tokens con `jose` (EdDSA). |
| `apps/backoffice` | React + Vite + Tailwind, para docentes y directivos. Habla con la API por el proxy `/api` de Vite. |
| `apps/mobile` | Expo SDK 58 (Expo Go) para estudiantes. |
| `packages/shared` | Tipos, enums de dominio, esquemas `zod` y constantes. Se consume como TypeScript fuente, sin build. |

## Cómo correrlo

Requisitos: Node 20 o superior y pnpm 10 (`npm i -g pnpm@10`).

```bash
pnpm install
pnpm db:seed     # crea apps/api/.env (claves del servidor) y apps/mobile/.env (IP de la Mac) si faltan,
                 # resetea la base y carga datos de demo
pnpm dev         # API en :3000, backoffice en :5173 y Metro (Expo) en :8081
```

- Backoffice: http://localhost:5173
- API: http://localhost:3000/health. Al arrancar, la consola muestra la URL con la IP de la Mac, que es la que va a usar el celular.

### App móvil (Expo Go)

1. Instalá **Expo Go** en el celular (tiene que ser la versión que soporta el SDK 58) y conectalo a la **misma red Wi-Fi** que la Mac.
2. Revisá que `apps/mobile/.env` apunte a la IP actual de la Mac (`EXPO_PUBLIC_API_URL=http://<ip>:3000`). Si cambiaste de red, editalo y reiniciá Metro.
3. Para tener el QR de Expo interactivo, corré la app en una terminal aparte: `pnpm dev:mobile`. Escaneá el QR con la cámara (iOS) o con Expo Go (Android).

Con `EXPO_PUBLIC_DEMO_MODE=true` aparecen botones de demo: "Simular foto" (para emuladores sin cámara) y "Desvincular este teléfono", que permite demostrar el cambio de dispositivo con un solo celular.

Otros comandos:

```bash
pnpm test                                   # tests de todos los paquetes
pnpm --filter @presente/api test -- auth    # tests de la API que matchean "auth"
pnpm --filter @presente/api exec vitest run --project unit   # solo tests unitarios (sin base)
pnpm typecheck
pnpm keys:generate                          # regenera las claves del servidor (invalida tokens emitidos)
```

Los requests de ejemplo para la API están en [`api.http`](api.http) (extensión REST Client de VS Code o cliente HTTP de JetBrains).

## Usuarios de demo

Backoffice (contraseña `demo1234` para todos):

| Email | Rol |
|---|---|
| `directora@presente.edu.ar` | Directivo |
| `docente1@presente.edu.ar` | Docente (Programación II, Bases de Datos) |
| `docente2@presente.edu.ar` | Docente (Redes y Comunicaciones) |

Estudiantes para registrarse en vivo desde la app. El número de trámite es `00` + los últimos 3 dígitos del DNI + los primeros 6:

| DNI | Sexo | Nº de trámite | Resultado esperado |
|---|---|---|---|
| 44901231 | F | 00231449012 | Aprobado |
| 44012342 | M | 00342440123 | Aprobado |
| 45123453 | F | 00453451234 | Aprobado |
| 45234560 | M | 00560452345 | Rechazado (DNI termina en 0) |
| 45345670 | F | 00670453456 | Rechazado (DNI termina en 0) |
| 46456789 | M | 00789464567 | En revisión manual (DNI termina en 9) |
| 46567899 | F | 00899465678 | En revisión manual (DNI termina en 9) |
| 38765435 | M | 00435387654 | "No estás inscripto" (existe en RENAPER, no en la institución) |

Hay además 8 estudiantes ya validados, con dispositivo vinculado e historial de presentes e ingresos, para que los reportes no estén vacíos.

## Decisiones de diseño

- **Enums como `String`:** SQLite + Prisma no tiene enums nativos. Los valores válidos están en `packages/shared/src/types.ts` y se validan con zod.
- **Una sola clave de servidor (Ed25519):** firma los tokens de sesión del backoffice y, más adelante, los QR de asistencia y de puerta y las constancias. El header `typ` de cada JWS distingue el uso, para que un tipo de token no se acepte en lugar de otro. Las claves se generan por script y viven en `apps/api/.env`.
- **Reloj único (`clock.now()`):** todas las validaciones de tiempo pasan por él. En `DEMO_MODE` se puede adelantar para mostrar QRs vencidos o sesiones fuera de horario sin esperar.
- **Fechas del seed relativas al momento en que corre:** siempre hay tres sesiones "de hoy" (una clase de Programación II, un examen de Bases de Datos que exige verificación de identidad y una clase de Redes más tarde), más historial de la última semana.
- **Programación II tiene inscriptos a todos los estudiantes:** así cualquiera que se registre en vivo puede dar presente en la demo.
- **Padrón RENAPER separado del padrón institucional** (`PersonaRenaper` frente a `Estudiante`): permite demostrar el caso "existe pero no está inscripto".
- **Fotos de los estudiantes:** placeholders de `i.pravatar.cc`. Requieren conexión a internet para verse.
- **Backoffice detrás del proxy de Vite (`/api`):** evita CORS y no hay que configurar la URL de la API. Vite corre con `--host` para que la página pública de verificación de constancias se pueda abrir desde un celular.
- **Login de staff con mensaje genérico:** "Email o contraseña incorrectos" en todos los casos. Los estudiantes no tienen credenciales web y el login rechaza su rol explícitamente.
- **`node-linker=hoisted`:** Metro (Expo) no resuelve bien los symlinks de pnpm.
- **Orden de la validación:** primero se consulta al proveedor de identidad y después el padrón institucional. Así el caso "existe en RENAPER pero no está inscripto" devuelve `NO_INSCRIPTO`, y un DNI inexistente en RENAPER se informa como rechazo.
- **Fotos del DNI y selfie:** se capturan con la cámara pero no se envían al servidor. El mock decide solo por reglas sobre el DNI.
- **Un intento fallido no "des-valida":** si alguien ingresa el DNI de un estudiante ya validado con datos incorrectos, se registra el intento pero el estudiante sigue `VALIDADO`.
- **Claves del dispositivo:** la clave privada son 32 bytes de `expo-crypto` (CSPRNG del sistema) y se guarda en SecureStore con `WHEN_UNLOCKED_THIS_DEVICE_ONLY`, así que no viaja en backups. Al servidor solo llega la clave pública.
- **Sesión del teléfono:** el token del dispositivo (30 días) está atado a un `deviceId`, y en cada request se verifica en la base que ese dispositivo siga `ACTIVO`. Revocar corta el acceso de inmediato, sin esperar a que venza el token.
- **Cambio de dispositivo solo con aprobación de un directivo:** descartamos la alternativa de re-validar con el mock. Si hay varias solicitudes pendientes, la más nueva reemplaza a las anteriores, que se rechazan.
- **Revisión manual:** el teléfono queda `PENDIENTE` hasta que un directivo resuelve, y la app consulta `GET /yo` cada 3 s.
- **Biometría:** `expo-local-authentication`, con el PIN del teléfono como alternativa. Si el teléfono no tiene ningún bloqueo configurado, se avisa y se deja pasar (decisión de prototipo). La credencial se vuelve a bloquear al pasar la app a segundo plano.
- **Navegación de la app sin librería:** una máquina de estados en `App.tsx` decide la pantalla según el token local y la respuesta de `GET /yo`. Reemplaza a `expo-router`, que habíamos propuesto originalmente, porque es más simple de explicar y no necesita configuración.
- **QR de identidad firmado por el teléfono, no por el servidor:** es un JWS EdDSA estándar (`typ: presente-id+jws`) con `{sub, did, iat, exp, nonce}`, firmado con la clave privada del dispositivo. Se genera sin conexión, y verificarlo prueba a la vez la identidad y que salió del teléfono vinculado. La implementación usa `@noble/ed25519` en `packages/shared`, igual en la app y en la API, y es compatible con `jose` (hay un test que lo comprueba).
- **Vigencia del QR de identidad:** rota cada 30 s. El servidor acepta 5 s extra por la demora del escaneo y rechaza QRs con `exp − iat > 30` o con `iat` en el futuro, para que un teléfono no pueda autoemitirse un QR "eterno".
- **Reloj del teléfono sincronizado:** cada `GET /yo` trae la hora del servidor y la app firma con esa hora corregida. Así un teléfono atrasado no genera QRs que ya nacen vencidos.
- **Nonce de un solo uso:** cada nonce se guarda en `NonceUsado` hasta que su QR vence. Si el mismo QR se escanea dos veces (por ejemplo, reenviado por WhatsApp), el segundo escaneo da `INVALIDO`.
- **Qué muestra cada resultado:** si la firma es auténtica, el backoffice muestra los datos del estudiante incluso con `VENCIDO` o `DISPOSITIVO_REVOCADO`, porque se sabe de quién es el QR. Con `INVALIDO` por firma o formato no muestra ningún dato. Todas las verificaciones quedan registradas, también las fallidas.
- **Verificación manual en el backoffice:** además de la cámara, se puede pegar el contenido del QR, para equipos sin webcam o para probar con `api.http`.
- **Tests:** dos proyectos de Vitest en la API. `unit` (`*.unit.test.ts`) no usa base de datos; `integration` resetea `test.db` y carga el seed.
