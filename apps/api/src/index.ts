import { networkInterfaces } from 'node:os';
import { createApp } from './app';
import { config } from './config';

// Escuchamos en 0.0.0.0 para que el celular (misma red Wi-Fi) llegue por la IP de la Mac.
createApp().listen(config.port, '0.0.0.0', () => {
  const ips = Object.values(networkInterfaces())
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => `http://${i!.address}:${config.port}`);
  console.log(`API PresenteID escuchando en http://localhost:${config.port}`);
  if (ips.length) console.log(`Desde el celular: ${ips.join(' | ')}`);
  if (config.demoMode) console.log('DEMO_MODE activo');
});
