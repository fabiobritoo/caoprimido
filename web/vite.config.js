import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      injectManifest: {
        swSrc: 'src/sw.js',
        swDest: 'dist/sw.js',
      },
      includeAssets: ['nina/*.png', 'nina/*.gif'],
      manifest: {
        name: 'Cãoprimido',
        short_name: 'Cãoprimido',
        description: 'Controle de remédios com alarmes e estoque',
        // usa um tom neutro (nem rosa nem azul) — esse valor é fixo no
        // arquivo do PWA e não consegue mudar em tempo real conforme o
        // Modo Bob é ativado, então evitamos deixar fixo numa cor que vai
        // destoar da metade das vezes
        theme_color: '#1A1A1A',
        background_color: '#F5F5F5',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
});
