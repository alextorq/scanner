export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  ssr: false,
  devtools: { enabled: true },
  nitro: {
    prerender: {
      ignore: ['/404.html'],
    },
  },
  css: [
    '~/assets/css/main.css',
    '~/assets/css/app.css',
    '~/assets/css/camera-scanner.css',
  ],
  app: {
    head: {
      htmlAttrs: { lang: 'ru' },
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'theme-color', content: '#f4f1ea' },
      ],
    },
  },
})
