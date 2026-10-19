import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Pruebas automáticas: lógica del servidor (rutas de la API con un Supabase
// falso) y la base de datos (esquema + migraciones en PGlite, un Postgres que
// corre en memoria). Se ejecutan con `npm test`.
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('.', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['pruebas/**/*.test.ts'],
    // Cargar el esquema y las migraciones en PGlite toma unos segundos
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
})
