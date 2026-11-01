// Mock de RENAPER con reglas deterministas para poder demostrar cada caso:
//   1. El DNI tiene que existir en el padrón ficticio (tabla PersonaRenaper).
//   2. Sexo y número de trámite tienen que coincidir con los del padrón.
//   3. Según el último dígito del DNI: 0 → rechazado, 9 → revisión manual, resto → aprobado.
// Las fotos del DNI y la selfie no se procesan (ni siquiera se envían): es un mock.
import type { PrismaClient } from '@prisma/client';
import type { DatosIdentidad, IdentityProvider, ResultadoIdentidad } from './IdentityProvider';

/** Regla 3, aislada para testearla sin base de datos. */
export function reglaPorDni(dni: string): ResultadoIdentidad {
  if (dni.endsWith('0')) return { resultado: 'RECHAZADO', motivo: 'La prueba de vida no coincide con la foto del DNI' };
  if (dni.endsWith('9')) return { resultado: 'EN_REVISION', motivo: 'La selfie requiere revisión manual' };
  return { resultado: 'APROBADO' };
}

/** Regla 2: compara lo ingresado con el registro del padrón. */
export function datosCoinciden(ingresado: DatosIdentidad, padron: { sexo: string; nroTramite: string }): boolean {
  return ingresado.sexo === padron.sexo && ingresado.nroTramite === padron.nroTramite;
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class MockRenaperProvider implements IdentityProvider {
  constructor(
    private prisma: PrismaClient,
    /** Latencia fija en ms; si no se pasa, se simula entre 1 y 2 segundos. */
    private latenciaMs?: number,
  ) {}

  async validar(datos: DatosIdentidad): Promise<ResultadoIdentidad> {
    await esperar(this.latenciaMs ?? 1000 + Math.random() * 1000);

    const persona = await this.prisma.personaRenaper.findUnique({ where: { dni: datos.dni } });
    if (!persona) return { resultado: 'RECHAZADO', motivo: 'El DNI no figura en el registro nacional' };
    if (!datosCoinciden(datos, persona)) {
      return { resultado: 'RECHAZADO', motivo: 'El sexo o el número de trámite no coinciden con el DNI' };
    }
    return reglaPorDni(datos.dni);
  }
}
