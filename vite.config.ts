import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Pure client-side SPA. No SSR, no server-side plugins.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        // Split the heavy third-party libraries out of the app bundle so a
        // student who never opens the admin charts does not download Recharts.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
          lottie: ['lottie-react'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
})
