import { resolve } from 'node:path';

import { federation } from '@module-federation/vite';
import commonjs from 'vite-plugin-commonjs';

export default {
    plugins: [
        federation({
            manifest: true,
            name: 'ShoppingRouteProductGroupsSet',
            filename: 'productGroupsEditor.js',
            exposes: {
                './Components': './src-admin/product-groups-editor-components.mjs',
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
        outDir: 'admin/custom/productGroups',
        emptyOutDir: true,
        rollupOptions: {
            input: resolve('src-admin/product-groups-editor-components.mjs'),
        },
    },
};
