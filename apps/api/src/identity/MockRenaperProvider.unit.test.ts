import { describe, expect, it } from 'vitest';
import { datosCoinciden, reglaPorDni } from './MockRenaperProvider';

describe('MockRenaperProvider: reglas deterministas', () => {
  it('DNI terminado en 0 → rechazado', () => {
    expect(reglaPorDni('45234560').resultado).toBe('RECHAZADO');
  });
  it('DNI terminado en 9 → revisión manual', () => {
    expect(reglaPorDni('46456789').resultado).toBe('EN_REVISION');
  });
  it('cualquier otro DNI → aprobado', () => {
    for (const d of '12345678'.split('')) expect(reglaPorDni(`4490123${d}`).resultado).toBe('APROBADO');
  });
  it('exige que coincidan sexo y número de trámite', () => {
    const padron = { sexo: 'F', nroTramite: '00231449012' };
    const base = { dni: '44901231', sexo: 'F' as const, nroTramite: '00231449012' };
    expect(datosCoinciden(base, padron)).toBe(true);
    expect(datosCoinciden({ ...base, sexo: 'M' }, padron)).toBe(false);
    expect(datosCoinciden({ ...base, nroTramite: '00000000000' }, padron)).toBe(false);
  });
});
