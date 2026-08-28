import '@fontsource-variable/inter'
import '@/styles/main.css'

import { createPinia } from 'pinia'
import { createApp } from 'vue'
import VueKonva from 'vue-konva'

import App from '@/App.vue'

createApp(App).use(createPinia()).use(VueKonva).mount('#app')

