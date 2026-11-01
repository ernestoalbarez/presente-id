import { API_URL } from './config';
import { tokenDispositivo } from './dispositivo';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public codigo?: string,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init: { body?: unknown } = {}): Promise<T> {
  const token = await tokenDispositivo.get();
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: init.body ? 'POST' : 'GET',
      headers: {
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new ApiError(0, `No se pudo conectar con la API (${API_URL}). ¿Estás en la misma red Wi-Fi?`, 'SIN_CONEXION');
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.error ?? `Error ${res.status}`, data?.codigo);
  return data as T;
}
