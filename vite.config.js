import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';

export default defineConfig({
    plugins: [
        laravel({
            input: ['resources/css/app.css', 'resources/js/app.js'],
            refresh: true,
        }),
    ],
    build: {
        // esbuild minifica el CSS sin las advertencias ruidosas de lightningcss
        // sobre pseudo-clases que Tailwind genera para variantes con dark/hover/focus.
        cssMinify: 'esbuild',
    },
});
