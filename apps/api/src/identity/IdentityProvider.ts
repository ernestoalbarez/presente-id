// Contrato de un proveedor de validación de identidad (tipo RENAPER). La API solo depende de
// esta interfaz: reemplazar el mock por un proveedor real no toca el resto del código.
import type { ResultadoRenaper } from '@presente/shared';

export interface DatosIdentidad {
  dni: string;
  sexo: 'M' | 'F' | 'X';
  nroTramite: string;
}

export interface ResultadoIdentidad {
  resultado: ResultadoRenaper;
  motivo?: string;
}

export interface IdentityProvider {
  validar(datos: DatosIdentidad): Promise<ResultadoIdentidad>;
}
