import express from 'express';
import cors from 'cors';
import { config } from './config';
import { clock } from './lib/clock';
import { errorHandler, HttpError } from './lib/errors';
import { authRouter } from './modules/auth/routes';
import { dispositivosRouter } from './modules/dispositivos/routes';
import { registroRouter } from './modules/registro/routes';
import { validacionesRouter } from './modules/validaciones/routes';
import { verificacionesRouter } from './modules/verificaciones/routes';

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '5mb' }));

  app.get('/health', (_req, res) => {
    res.json({ ok: true, ahora: clock.now().toISOString(), demoMode: config.demoMode });
  });
  app.use('/auth', authRouter);
  app.use('/', registroRouter); // POST /registro y GET /yo (app móvil)
  app.use('/validaciones', validacionesRouter);
  app.use('/dispositivos', dispositivosRouter);
  app.use('/verificaciones', verificacionesRouter);

  app.use((_req, _res, next) => next(new HttpError(404, 'Ruta inexistente', 'NO_ENCONTRADO')));
  app.use(errorHandler);
  return app;
}
