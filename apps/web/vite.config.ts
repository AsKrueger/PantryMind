import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Dirección de la API en desarrollo. Si se cambia PORT en la API, cambia también aquí.
const API_TARGET = 'http://localhost:3000';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Las peticiones a la API salen del mismo origen que la web: la cookie
    // del refresh token funciona con SameSite=Strict y no hace falta CORS.
    proxy: {
      '/auth': API_TARGET,
      '/users': API_TARGET,
      '/health': API_TARGET,
    },
  },
});
