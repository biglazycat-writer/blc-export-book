import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import novels from './locales/zh-CN/novels.json';
import common from './locales/zh-CN/common.json';
import canvas from './locales/zh-CN/canvas.json';
void i18next.use(initReactI18next).init({resources:{'zh-CN':{novels,common,canvas}},lng:'zh-CN',fallbackLng:'zh-CN',defaultNS:'novels',interpolation:{escapeValue:false},returnNull:false});
export default i18next;
