# App de identidad y presentismo estudiantil ("PresenteID")

## Rol y contexto

Sos un desarrollador full-stack senior. Vas a construir un **prototipo funcional para un trabajo práctico universitario**. **No es un producto productivo**: todos los servicios externos (validación de identidad tipo RENAPER, notificaciones, etc.) deben estar **mockeados**. Priorizá claridad del código, una demo que funcione de punta a punta y una arquitectura fácil de explicar en una presentación.

El concepto se inspira en **POAP (Proof of Attendance Protocol)**: cada asistencia válida genera una "constancia de presencia" verificable que el estudiante colecciona en su app. **No usamos blockchain**: la constancia es un registro firmado por el servidor.

## Objetivo del sistema

1. El estudiante se registra en la app móvil y **valida su identidad** (mock de RENAPER).
2. Una vez validado, **el teléfono equivale a llevar el DNI**: la app es su credencial de identidad estudiantil.
3. **Un solo dispositivo por usuario.** No existe login desde desktop para estudiantes.
4. La app permite:
   - **Mostrar un QR de identidad** que un docente/directivo escanea para verificar quién es la persona.
   - **Escanear QRs** para:
     - dar presente en un **aula física** (clase o examen de un día puntual),
     - registrar **ingreso al instituto** (sede/puerta).
5. Un **backoffice web** para docentes y directivos: gestionar cursos, generar QRs de asistencia, escanear QRs de identidad y consultar reportes.

## Stack (simplificado)

- **Monorepo** con `pnpm` workspaces:
  - `apps/mobile` → **Expo** (TypeScript), probado en **Expo Go** (sin módulos nativos custom). `expo-camera`, `react-native-qrcode-svg`, `expo-secure-store`, `expo-local-authentication`. Firmas Ed25519 con `@noble/ed25519` (JS puro).
  - `apps/backoffice` → **React + Vite** + TypeScript + Tailwind. Escaneo con `html5-qrcode`.
  - `apps/api` → **Express** + TypeScript, **SQLite + Prisma**. Firma de QRs con `jose`.
  - `packages/shared` → tipos, esquemas `zod` y utilidades de firma/verificación.
- Tiempo real por **polling** (cada 3 s), no WebSockets.
- Sin geolocalización ni rol Admin.
- La URL de la API en la app se configura por `.env` con la IP local de la Mac (no `localhost`), porque se prueba en un celular físico.
- `pnpm install && pnpm db:seed && pnpm dev` levanta todo.

## Roles

| Rol | Dónde opera | Puede |
|---|---|---|
| Estudiante | App móvil | Registrarse, validar identidad, mostrar QR de identidad, escanear QRs de asistencia/ingreso, ver historial y constancias |
| Docente | Backoffice | Ver sus cursos, crear sesiones (clase/examen), proyectar QR de asistencia, escanear QR de identidad, ver/corregir asistencia de sus cursos |
| Directivo | Backoffice | Todo lo del docente sobre toda la institución, gestionar QRs de sede/puerta, ver reportes globales, aprobar cambio de dispositivo |
| Admin (opcional) | Backoffice | ABM de usuarios, cursos, sedes |

## Módulos y requerimientos funcionales

### 1. Registro y validación de identidad (mock RENAPER)

- Flujo en la app: ingresar DNI + sexo + número de trámite → "foto del frente y dorso del DNI" → "selfie / prueba de vida".
- Implementar un **servicio `IdentityProvider` con interfaz clara** y una implementación `MockRenaperProvider`:
  - Tiene un padrón ficticio en el seed (nombre, apellido, DNI, fecha de nacimiento, foto placeholder).
  - Reglas de mock deterministas para poder demostrar casos: p. ej. DNI terminado en `0` → rechazado, terminado en `9` → "requiere revisión manual", el resto → aprobado. Simular latencia (1–2 s).
  - Las fotos/selfie se capturan pero **no se procesan** (o se guardan localmente solo para la demo).
- El DNI validado debe corresponder a un **estudiante existente en el padrón de la institución** (seed). Si no, error "no estás inscripto".
- Estados del usuario: `PENDIENTE` → `VALIDADO` | `RECHAZADO` | `EN_REVISION`.

### 2. Vinculación a un único dispositivo

- Al validar identidad, la app **genera un par de claves** (Ed25519 o ECDSA P-256) en el dispositivo; la clave privada queda en `SecureStore` y la pública se registra en el servidor junto a un `deviceId`.
- Regla: **un dispositivo activo por usuario**. Si el estudiante intenta registrarse desde otro dispositivo:
  - se crea una **solicitud de cambio de dispositivo** que un directivo aprueba desde el backoffice (o se re-valida identidad con el mock),
  - al aprobarse, el dispositivo anterior queda revocado.
- Proteger el acceso a la app con **biometría o PIN local** (`expo-local-authentication`) antes de mostrar el QR de identidad.
- Los estudiantes **no tienen login web**; el backend debe rechazar sesiones de estudiantes que no provengan de un dispositivo registrado.

### 3. QR de identidad (el estudiante lo muestra)

- Pantalla "Mi credencial": foto, nombre, DNI, legajo, carrera, estado y un **QR dinámico**.
- El QR contiene un payload **firmado** (JWT/JWS) con: `userId`, `deviceId`, `iat`, `exp` y un `nonce`. **Rota cada [30] segundos** (con contador visible) para que una captura de pantalla no sirva.
- El backoffice escanea el QR, verifica firma y vigencia contra el servidor y muestra: foto, nombre, DNI, estado académico y resultado **VÁLIDO / VENCIDO / INVÁLIDO / DISPOSITIVO REVOCADO**.
- Cada verificación queda registrada (quién verificó, a quién, cuándo, resultado).

### 4. Presentismo en aula física (el estudiante escanea)

- En el backoffice, el docente crea una **Sesión** para un curso: tipo (`CLASE` | `EXAMEN`), fecha, hora de inicio/fin, aula y ventana de tolerancia.
- Al iniciar la sesión, el backoffice muestra un **QR de asistencia en pantalla completa** (para proyectar). El QR contiene `sessionId` + token firmado que **rota cada [15] segundos**.
- El estudiante lo escanea desde la app; la app envía al servidor: token del QR + `deviceId` + timestamp, **firmado con la clave privada del dispositivo**.
- El servidor valida:
  - token del QR vigente y de esa sesión,
  - sesión activa (dentro de la ventana horaria),
  - estudiante inscripto en el curso,
  - dispositivo registrado y activo, firma correcta,
  - sin presente duplicado.
- Resultado en la app: confirmación con animación + se genera una **Constancia de presencia** (estilo POAP).
- Para **exámenes**: además del QR, el docente puede exigir **verificación de identidad cruzada** (escanear el QR de identidad del estudiante) para marcar el presente como "verificado presencialmente".
- [Opcional] Geolocalización mock: guardar coordenadas y comparar con las del aula con un radio configurable; en la demo se puede forzar "dentro/fuera".
- El docente ve en vivo la lista de presentes y puede **marcar o corregir manualmente** (queda auditado).

### 5. Ingreso al instituto

- El directivo genera **QRs por sede/puerta** (pueden ser estáticos impresos o rotativos en una pantalla en la entrada).
- El estudiante escanea al ingresar (y opcionalmente al egresar); se registra el evento `INGRESO`/`EGRESO` con sede y hora.
- Reporte: quiénes ingresaron hoy, por sede y franja horaria.

### 6. Constancias de presencia (inspiración POAP)

- Cada presente válido genera una constancia con: evento, curso, fecha, sede, hash/firma del servidor y un diseño visual tipo "insignia".
- La app tiene una sección **"Mis constancias"** (galería).
- Cada constancia tiene un **link/QR de verificación pública** (página simple en el backoffice que muestra si la constancia es auténtica, sin exponer datos sensibles).

### 7. Backoffice (docentes / directivos)

- Login con email + contraseña (usuarios del seed) y JWT. Control de acceso por rol.
- Pantallas:
  - **Dashboard**: sesiones de hoy, % de asistencia, ingresos del día.
  - **Cursos**: listado, inscriptos, sesiones.
  - **Sesión en vivo**: QR proyectable + lista de presentes en tiempo real (WebSocket o polling).
  - **Verificar identidad**: escáner por cámara + resultado.
  - **Asistencia**: grilla estudiante × sesión, exportar a CSV.
  - **Ingresos**: por sede/fecha.
  - **Dispositivos**: solicitudes de cambio, aprobar/rechazar, revocar.
  - **Validaciones de identidad** en revisión manual.
  - **Auditoría**: log de verificaciones, correcciones manuales y cambios de dispositivo.

## Modelo de datos (mínimo)

`Usuario` (rol, email, estado), `Estudiante` (DNI, legajo, carrera, foto, estadoValidacion), `Dispositivo` (userId, deviceId, publicKey, estado, fechas), `SolicitudCambioDispositivo`, `Institucion`, `Sede`, `PuntoAcceso` (puerta/QR), `Curso`, `Inscripcion`, `Sesion` (tipo, fecha, ventana, aula, requiereVerificacionIdentidad), `Asistencia` (estudiante, sesión, timestamp, método: QR/MANUAL, verificadaPresencialmente), `EventoIngreso`, `Constancia`, `VerificacionIdentidad`, `Auditoria`.

## Seguridad (a nivel prototipo, pero bien explicado)

- QRs **firmados y de corta vida** (rotación) para evitar capturas y reenvíos.
- **Firma del dispositivo** en cada escaneo → prueba de que lo hizo el teléfono vinculado.
- Prevención de **replay**: `nonce` de un solo uso, ventana temporal y unicidad por (estudiante, sesión).
- Biometría/PIN local para abrir la credencial.
- Secretos en `.env` (incluir `.env.example`). Claves del servidor generadas por script.
- Documentar en el README **qué ataques mitiga** (captura de pantalla, compartir QR por WhatsApp, prestar la cuenta, usar dos celulares) y **cuáles no** (limitaciones conocidas por ser mock).

## Datos de ejemplo (seed)

- 1 institución, 2 sedes, 3 puertas.
- 1 directivo, 2 docentes, 15 estudiantes en el padrón (algunos para cada caso del mock: aprobado, rechazado, en revisión, no inscripto).
- 3 cursos, sesiones de la semana actual incluyendo **un examen**.
- Algunos presentes e ingresos ya cargados para que los reportes no estén vacíos.
- Listar credenciales de demo en el README.

## Modo demo

- Un flag `DEMO_MODE=true` que:
  - permita en la app mobile **simular un escaneo** pegando el contenido del QR (útil si se corre en emulador sin cámara),
  - muestre un panel para "adelantar el reloj" o forzar estados (sesión vencida, dispositivo revocado, geo fuera de rango).

## Entregables

1. Código completo del monorepo, con `pnpm install && pnpm db:seed && pnpm dev`.
2. **README** con: descripción, arquitectura, cómo correrlo, usuarios de demo, guion de demo paso a paso.
3. **Diagramas** (Mermaid en el README): arquitectura, modelo de datos, secuencia de (a) validación de identidad, (b) presente en aula, (c) verificación de identidad por docente, (d) cambio de dispositivo.
4. **Tests**: unitarios de la lógica de validación de QR/firmas/reglas de asistencia y algunos tests de integración de la API.
5. Colección de requests (Postman/Bruno o archivo `.http`) para la API.

## Forma de trabajo

- Antes de escribir código, proponé la **estructura de carpetas, el modelo de datos y los endpoints de la API** y esperá mi confirmación.
- Después avanzá por etapas, dejando algo ejecutable al final de cada una:
  1. Monorepo, API, base de datos, seed y auth del backoffice.
  2. Registro + mock RENAPER + vinculación de dispositivo en la app.
  3. QR de identidad + verificación desde el backoffice.
  4. Sesiones + QR de asistencia + presente desde la app.
  5. Ingreso a sede + constancias + reportes.
  6. Auditoría, modo demo, tests, README y diagramas.
- Mantené el código simple y comentado donde la lógica no sea obvia (firmas, rotación de QR, reglas de asistencia). Evitá sobre-ingeniería.
- Ante cualquier ambigüedad, elegí la opción más simple, anotala en una sección "Decisiones de diseño" del README y seguí.
