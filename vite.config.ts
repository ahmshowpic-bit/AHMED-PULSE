import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        VitePWA({
          registerType: 'autoUpdate',
          includeAssets: ['icon-192.png', 'icon-512.png'],
          manifest: false, // Using our existing manifest.json in public folder
          workbox: {
            globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
            cleanupOutdatedCaches: true,
            clientsClaim: true,
            skipWaiting: true,
            // تجاهل الملفات الكبيرة جداً من التخزين المسبق
            maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
            runtimeCaching: [
              {
                // الملفات الصوتية: تُخزَّن بعد أول تشغيل وتعمل بدون نت
                urlPattern: /\.(?:mp3|m4a|aac|ogg|wav)$/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'pulse-audio',
                  expiration: {
                    maxEntries: 30,
                    maxAgeSeconds: 60 * 60 * 24 * 30
                  },
                  rangeRequests: true,
                  cacheableResponse: { statuses: [0, 200] }
                }
              },
              {
                // الصور وأغلفة الأغاني والخلفيات
                urlPattern: /\.(?:png|jpg|jpeg|webp|gif|svg|avif)$/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'pulse-images',
                  expiration: {
                    maxEntries: 60,
                    maxAgeSeconds: 60 * 60 * 24 * 30
                  },
                  cacheableResponse: { statuses: [0, 200] }
                }
              },
              {
                // صور Unsplash المستخدمة كخلفيات
                urlPattern: /^https:\/\/images\.unsplash\.com\/.*/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'pulse-unsplash',
                  expiration: {
                    maxEntries: 30,
                    maxAgeSeconds: 60 * 60 * 24 * 30
                  },
                  cacheableResponse: { statuses: [0, 200] }
                }
              },
              {
                // ملفات الخطوط من Google Fonts
                urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'pulse-fonts',
                  expiration: {
                    maxEntries: 20,
                    maxAgeSeconds: 60 * 60 * 24 * 365
                  },
                  cacheableResponse: { statuses: [0, 200] }
                }
              }
            ]
          }
        })
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
