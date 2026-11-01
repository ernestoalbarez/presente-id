// Qué hacer con un QR escaneado: se mira el `typ` del header (sin verificar; eso lo hace el
// servidor), se envuelve en un JWS firmado por el teléfono y se manda al endpoint que corresponde.
import * as Crypto from 'expo-crypto';
import { base64url, firmarEscaneo, tipoDeQr, TYP_QR_ASISTENCIA, TYP_QR_IDENTIDAD, TYP_QR_PUERTA, type IngresoResponse, type PresenteResponse } from '@presente/shared';
import { api } from './api';
import { obtenerClaveParaFirmar } from './dispositivo';
import { ahoraServidorSeg } from './reloj';

export type ResultadoEscaneo =
  | { tipo: 'PRESENTE'; presente: PresenteResponse }
  | { tipo: 'INGRESO'; ingreso: IngresoResponse }
  | { tipo: 'ERROR'; titulo: string; mensaje: string };

async function firmar(qr: string): Promise<string> {
  const clave = await obtenerClaveParaFirmar();
  if (!clave) throw new Error('Este teléfono no tiene claves registradas');
  return firmarEscaneo({
    qr,
    deviceId: clave.deviceId,
    ahoraSeg: ahoraServidorSeg(),
    nonce: base64url.encode(Crypto.getRandomBytes(16)),
    clavePrivada: clave.clavePrivada,
  });
}

export async function procesarQr(contenido: string): Promise<ResultadoEscaneo> {
  const typ = tipoDeQr(contenido);
  switch (typ) {
    case TYP_QR_ASISTENCIA:
      try {
        const presente = await api<PresenteResponse>('/asistencias/escaneo', { body: { jws: await firmar(contenido.trim()) } });
        return { tipo: 'PRESENTE', presente };
      } catch (e) {
        return { tipo: 'ERROR', titulo: 'No se registró el presente', mensaje: e instanceof Error ? e.message : String(e) };
      }
    case TYP_QR_PUERTA:
      try {
        const ingreso = await api<IngresoResponse>('/ingresos/escaneo', { body: { jws: await firmar(contenido.trim()) } });
        return { tipo: 'INGRESO', ingreso };
      } catch (e) {
        return { tipo: 'ERROR', titulo: 'No se registró el acceso', mensaje: e instanceof Error ? e.message : String(e) };
      }
    case TYP_QR_IDENTIDAD:
      return { tipo: 'ERROR', titulo: 'Es un QR de identidad', mensaje: 'Ese código es la credencial de un estudiante: lo escanea el docente, no la app.' };
    default:
      return { tipo: 'ERROR', titulo: 'QR no reconocido', mensaje: 'Este código no es de PresenteID.' };
  }
}
