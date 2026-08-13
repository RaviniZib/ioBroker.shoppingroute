import { resolve } from 'node:path';

import { federation } from '@module-federation/vite';
import commonjs from 'vite-plugin-commonjs';

export default {
    plugins: [
        federation({
            manifest: true,
            name: 'ShoppingRouteMarketsSet',
            filename: 'marketsEditor.js',
            exposes: {
                './Components': './src-admin/markets-editor-components.mjs',
            },
            remotes: {},
            shared: {
                react: {
                    singleton: true,
                    requiredVersion: '>=18',
                },
            },
        }),
        commonjs(),
    ],
    base: './',
    build: {
        target: 'chrome89',
        outDir: 'admin/custom/markets',
        emptyOutDir: true,
        rollupOptions: {
            input: resolve('src-admin/markets-editor-components.mjs'),
        },
    },
};
