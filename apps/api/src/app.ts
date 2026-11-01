import express from 'express';
import cors from 'cors';
import { config } from './config';
import { clock } from './lib/clock';
import { errorHandler, HttpError } from './lib/errors';
import { asistenciasRouter } from './modules/asistencias/routes';
import { authRouter } from './modules/auth/routes';
import { publicRouter } from './modules/constancias/routes';
import { cursosRouter } from './modules/cursos/routes';
import { ingresosRouter, puertasRouter } from './modules/ingresos/routes';
import { dispositivosRouter } from './modules/dispositivos/routes';
import { registroRouter } from './modules/registro/routes';
import { reportesRouter } from './modules/reportes/routes';
import { sesionesRouter } from './modules/sesiones/routes';
import { validacionesRouter } from './modules/validaciones/routes';
import { verificacionesRouter } from './modules/verificaciones/routes';
import { yoRouter } from './modules/yo/routes';

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '5mb' }));

  app.get('/health', (_req, res) => {
    res.json({ ok: true, ahora: clock.now().toISOString(), demoMode: config.demoMode });
  });
  app.use('/auth', authRouter);
  app.use('/public', publicRouter); // sin login: verificación de constancias
  app.use('/', registroRouter); // POST /registro y GET /yo (app móvil)
  app.use('/yo', yoRouter); // historial y constancias (app móvil)
  app.use('/validaciones', validacionesRouter);
  app.use('/dispositivos', dispositivosRouter);
  app.use('/verificaciones', verificacionesRouter);
  app.use('/cursos', cursosRouter);
  app.use('/sesiones', sesionesRouter);
  app.use('/asistencias', asistenciasRouter);
  app.use('/ingresos', ingresosRouter);
  app.use('/reportes', reportesRouter);
  app.use('/', puertasRouter); // GET /sedes, /puntos-acceso (directivo)

  app.use((_req, _res, next) => next(new HttpError(404, 'Ruta inexistente', 'NO_ENCONTRADO')));
  app.use(errorHandler);
  return app;
}
