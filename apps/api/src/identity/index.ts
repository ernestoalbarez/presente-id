import { config } from '../config';
import { prisma } from '../lib/prisma';
import type { IdentityProvider } from './IdentityProvider';
import { MockRenaperProvider } from './MockRenaperProvider';

/** Proveedor de identidad en uso. Para un proveedor real, cambiar solo esta línea. */
export const identityProvider: IdentityProvider = new MockRenaperProvider(prisma, config.mockRenaperLatenciaMs);
