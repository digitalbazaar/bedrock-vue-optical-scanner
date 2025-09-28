import App from './App.vue';
import {createApp} from 'vue';
import {Quasar} from 'quasar';
import router from './router';
import 'quasar/dist/quasar.css';

const app = createApp(App);
app.use(router);
app.use(Quasar, {plugins: {}});
app.mount('#app');
