import 'i18next';
import type novels from './locales/zh-CN/novels.json';
import type common from './locales/zh-CN/common.json';
declare module 'i18next' { interface CustomTypeOptions { defaultNS:'novels';resources:{novels:typeof novels;common:typeof common};returnNull:false; } }
