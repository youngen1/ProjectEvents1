import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    define: {
      'process.env': env,
    },
    plugins: [react()],
    build: {
      sourcemap: false, // Disable source maps
      chunkSizeWarningLimit: 3000, // Adjust the limit as needed
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom'],
            'firebase-vendor': ['firebase/app', 'firebase/analytics', 'firebase/storage'],
            // Add more chunks as needed
          },
        },
      },
    },
  };
});