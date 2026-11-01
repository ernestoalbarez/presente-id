import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// El backoffice habla con la API a través del proxy `/api` de Vite: evita CORS y hace que
// la página pública de verificación de constancias funcione también abierta desde un celular
// (http://<ip-de-la-mac>:5173/verificar/...), sin configurar la URL de la API.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
