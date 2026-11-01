import { describe, expect, it } from 'vitest';
import { estadoSesion, evaluarSesion } from './reglas';

const inicio = new Date('2026-11-02T18:30:00');
const fin = new Date('2026-11-02T22:00:00');
const base = { inicio, fin, toleranciaMin: 15, abiertaAt: new Date('2026-11-02T18:20:00'), cerradaAt: null };
const a = (hhmm: string) => new Date(`2026-11-02T${hhmm}:00`);

describe('reglas de sesión', () => {
  it('estado según apertura y cierre', () => {
    expect(estadoSesion({ abiertaAt: null, cerradaAt: null })).toBe('PROGRAMADA');
    expect(estadoSesion({ abiertaAt: a('18:00'), cerradaAt: null })).toBe('ABIERTA');
    expect(estadoSesion({ abiertaAt: a('18:00'), cerradaAt: a('22:00') })).toBe('CERRADA');
  });
  it('acepta dentro de [inicio − tolerancia, fin]', () => {
    expect(evaluarSesion(base, a('18:15')).acepta).toBe(true);
    expect(evaluarSesion(base, a('20:00')).acepta).toBe(true);
    expect(evaluarSesion(base, a('22:00')).acepta).toBe(true);
  });
  it('rechaza antes de la tolerancia o después del fin', () => {
    expect(evaluarSesion(base, a('18:14'))).toMatchObject({ acepta: false, codigo: 'FUERA_DE_HORARIO' });
    expect(evaluarSesion(base, a('22:01'))).toMatchObject({ acepta: false, codigo: 'FUERA_DE_HORARIO' });
  });
  it('rechaza si no está abierta o ya se cerró, aunque esté en horario', () => {
    expect(evaluarSesion({ ...base, abiertaAt: null }, a('19:00'))).toMatchObject({ codigo: 'SESION_NO_ABIERTA' });
    expect(evaluarSesion({ ...base, cerradaAt: a('19:00') }, a('19:30'))).toMatchObject({ codigo: 'SESION_CERRADA' });
  });
});
