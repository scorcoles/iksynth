// La configuración de Vite. Solo hace falta para «npm run build»: genera dist/ con nombres
// fijos (iksynth.js, con Three.js y Tone.js dentro, e iksynth.css), sin códigos de versión
// en el nombre. Así la web de VERTIK los copia y los carga siempre igual.
import { defineConfig } from 'vite';

export default defineConfig({
  // Rutas relativas: dist/ funciona sirviéndolo desde cualquier carpeta.
  base: './',
  build: {
    // Three.js y Tone.js van dentro: que Vite no avise del tamaño.
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        entryFileNames: 'iksynth.js',
        chunkFileNames: 'iksynth-[name].js',
        assetFileNames: 'iksynth[extname]',
      },
    },
  },
});
