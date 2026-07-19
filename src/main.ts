import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { VueQueryPlugin } from '@tanstack/vue-query'
import i18n from './i18n'
import './style.css'
import App from './App.vue'

// Import PWA virtual module to register service worker
import { registerSW } from 'virtual:pwa-register'

registerSW({ immediate: true })

const app = createApp(App)

app.use(createPinia())
app.use(VueQueryPlugin)
app.use(i18n)

app.mount('#app')
