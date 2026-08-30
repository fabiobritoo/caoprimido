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
        // Confirmado na prática: pra um PWA instalado (standalone), o
        // Android pinta a barra do sistema (relógio/bateria) usando ESSE
        // valor fixo do manifest, gravado na hora da instalação — mesmo
        // desinstalando e reinstalando, ele não reflete o Modo Bob (que só
        // é sabido em runtime, depois que o JS carrega). Usa um tom neutro
        // que não destoa muito nem do rosa nem do azul, já que não dá pra
        // fazer ele acompanhar o modo de verdade.
        theme_color: '#2B2320',
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
