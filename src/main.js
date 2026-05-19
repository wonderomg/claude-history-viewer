import { createApp } from 'vue'
import App from './App.vue'
import './styles/main.css'
import { initHljsTheme } from './utils/hljs-theme.js'
import { initAppSettings } from './composables/initAppSettings.js'

initAppSettings().then(() => {
  initHljsTheme()
  createApp(App).mount('#app')
})
