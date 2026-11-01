// Reloj único del servidor. TODAS las validaciones de tiempo (vigencia de QRs, ventana de
// sesiones, tokens) usan clock.now(), así el modo demo puede "adelantar el reloj" para
// mostrar casos como QR vencido o sesión fuera de horario sin esperar.
import { config } from '../config';

let offsetMs = 0;

export const clock = {
  now(): Date {
    return new Date(Date.now() + offsetMs);
  },
  nowSeconds(): number {
    return Math.floor(this.now().getTime() / 1000);
  },
  getOffsetMs(): number {
    return offsetMs;
  },
  setOffsetMs(ms: number): void {
    if (!config.demoMode) throw new Error('Solo se puede mover el reloj con DEMO_MODE=true');
    offsetMs = ms;
  },
};
