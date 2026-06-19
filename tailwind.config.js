import defaultTheme from 'tailwindcss/defaultTheme';
import forms from '@tailwindcss/forms';

/** @type {import('tailwindcss').Config} */
export default {
    content: [
        './vendor/laravel/framework/src/Illuminate/Pagination/resources/views/*.blade.php',
        './storage/framework/views/*.php',
        './resources/views/**/*.blade.php',
    ],

    // Safelist para colores dinamicos en gestion de roles. Tailwind purga
    // las clases que no encuentra textualmente y los colores por grupo se
    // arman concatenando con PHP, por eso hay que decirle a Tailwind que
    // los conserve aunque no los vea.
    safelist: [
        { pattern: /(bg|text|border|ring)-(sky|indigo|orange|purple|green|blue|emerald|slate|pink|amber|red|cyan|rose|fuchsia|violet|teal)-(50|100|200|300|500|600|700)/ },
    ],

    theme: {
        extend: {
            fontFamily: {
                sans: ['Figtree', ...defaultTheme.fontFamily.sans],
            },
        },
    },

    plugins: [forms],
};
