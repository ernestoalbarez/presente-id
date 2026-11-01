// Código compartido entre api, backoffice y mobile.
// Se consume como TypeScript fuente (sin paso de build): tsx, Vite y Metro lo transpilan.
export * from './types';
export * from './constants';
export * from './schemas/auth';
export * from './schemas/registro';
export * from './crypto/ed25519';
