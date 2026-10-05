import { resolve } from 'node:path';
import { federation } from '@module-federation/vite';
import commonjs from 'vite-plugin-commonjs';
export default {
  plugins: [
    federation({
      manifest: true,
      name: 'ShoppingRouteCatalogSet',
      filename: 'catalogManager.js',
      exposes: { './Components': './src-admin/catalog-manager-components.mjs' },
      remotes: {},
      dts: false,
      shared: { react: { singleton: true, requiredVersion: '>=18' } },
    }),
    commonjs(),
  ],
  base: './',
  build: {
    target: 'chrome89',
    outDir: 'admin/custom/catalogManager',
    emptyOutDir: true,
    rollupOptions: { input: resolve('src-admin/catalog-manager-components.mjs') },
  },
};
