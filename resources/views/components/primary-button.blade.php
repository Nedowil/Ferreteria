<button {{ $attributes->merge(['type' => 'submit', 'class' => 'inline-flex items-center px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-600 border border-transparent rounded-md font-semibold text-xs text-white uppercase tracking-widest hover:from-orange-600 hover:to-orange-700 focus:from-orange-600 focus:to-orange-700 active:from-orange-700 active:to-orange-800 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 transition ease-in-out duration-150 shadow-md']) }}>
    {{ $slot }}
</button>
