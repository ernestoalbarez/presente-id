import { Prisma } from '@prisma/client';
import { clock } from './clock';
import { prisma } from './prisma';

/**
 * Antirreplay: registra un nonce como usado hasta `expiraSeg`. Devuelve false si ya existía.
 * La PK de NonceUsado garantiza la unicidad aunque lleguen dos requests a la vez.
 */
export async function consumirNonce(nonce: string, expiraSeg: number): Promise<boolean> {
  // Limpieza oportunista: los nonces vencidos ya no hace falta recordarlos (el QR igual venció).
  await prisma.nonceUsado.deleteMany({ where: { expiraAt: { lt: clock.now() } } });
  try {
    await prisma.nonceUsado.create({ data: { nonce, expiraAt: new Date(expiraSeg * 1000) } });
    return true;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return false;
    throw e;
  }
}
