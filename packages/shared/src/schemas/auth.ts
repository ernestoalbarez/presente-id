import { z } from 'zod';
import type { UsuarioStaff } from '../types';

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Email inválido'),
  password: z.string().min(1, 'Ingresá la contraseña'),
});
export type LoginRequest = z.infer<typeof loginSchema>;

export interface LoginResponse {
  token: string;
  usuario: UsuarioStaff;
}
