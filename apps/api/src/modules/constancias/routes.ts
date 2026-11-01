// Endpoints públicos (sin login): verificación de constancias y clave pública del servidor.
import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { clavePublicaServidor } from '../../lib/tokens';
import { verificarConstancia } from './service';

export const publicRouter = Router();

publicRouter.get('/constancias/:codigo', async (req, res) => {
  res.json(await verificarConstancia(prisma, req.params.codigo));
});

publicRouter.get('/clave-servidor', (_req, res) => {
  res.json(clavePublicaServidor());
});
