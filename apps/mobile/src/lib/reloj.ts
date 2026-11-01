// Corrección del reloj del teléfono. Los QR se firman con la hora del teléfono, pero el servidor
// los valida con la suya: si el teléfono está atrasado o adelantado, el QR saldría "vencido".
// Cada respuesta de GET /yo trae la hora del servidor y guardamos la diferencia.
let desfaseMs = 0;

export function sincronizarConServidor(ahoraServidorIso: string) {
  const t = Date.parse(ahoraServidorIso);
  if (!Number.isNaN(t)) desfaseMs = t - Date.now();
}

/** Hora actual "del servidor", en segundos epoch. */
export const ahoraServidorSeg = () => Math.floor((Date.now() + desfaseMs) / 1000);
