import {defineConfig} from 'vitest/config';
export default defineConfig({test:{include:['src/**/*.test.{ts,tsx}'],environment:'node',setupFiles:['./src/ui/i18n/index.ts'],testTimeout:60000,pool:'forks',maxWorkers:2},esbuild:{jsx:'automatic'}});
