import { createApp } from 'vue'
import App from './App.vue'
import './styles/main.css'
import { initHljsTheme } from './utils/hljs-theme.js'

initHljsTheme()
createApp(App).mount('#app')
