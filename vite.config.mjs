import { resolve } from 'node:path';

import { federation } from '@module-federation/vite';
import commonjs from 'vite-plugin-commonjs';

export default {
    plugins: [
        federation({
            manifest: true,
            name: 'ShoppingRouteAdminSet',
            filename: 'routeEditor.js',
            exposes: {
                './Components': './src-admin/route-editor-components.mjs',
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
        outDir: 'admin/custom',
        emptyOutDir: true,
        rollupOptions: {
            input: resolve('src-admin/route-editor-components.mjs'),
        },
    },
};
