// Variables EXPO_PUBLIC_* de apps/mobile/.env (Expo las inyecta al bundlear).
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
export const DEMO_MODE = process.env.EXPO_PUBLIC_DEMO_MODE === 'true';
