import { createApp } from 'vue'
import { createPinia } from 'pinia'
import Antd from 'ant-design-vue'
import 'ant-design-vue/dist/reset.css'
import App from './App.vue'
import router from './router'
import { seedTemplatesIfEmpty } from './utils/seed'
import './styles/global.css'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.use(Antd)

// 首次启动写入预制模板
seedTemplatesIfEmpty().finally(() => {
  app.mount('#app')
})
