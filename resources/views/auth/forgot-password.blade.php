<x-guest-layout>
    <h2 class="text-2xl font-bold text-slate-800 mb-1">Recuperar contraseña</h2>
    <p class="text-sm text-slate-500 mb-6">Olvidaste tu contraseña? No hay problema. Ingresa tu email y te enviaremos un enlace para restablecerla.</p>

    <x-auth-session-status class="mb-4" :status="session('status')" />

    <form method="POST" action="{{ route('password.email') }}" class="space-y-4">
        @csrf

        <div>
            <x-input-label for="email" value="Email" />
            <x-text-input id="email" class="block mt-1 w-full" type="email" name="email" :value="old('email')" required autofocus />
            <x-input-error :messages="$errors->get('email')" class="mt-2" />
        </div>

        <div class="flex items-center justify-between pt-2">
            <a class="text-sm text-orange-600 hover:text-orange-700 hover:underline" href="{{ route('login') }}">← Volver al inicio</a>
            <x-primary-button>
                Enviar enlace
            </x-primary-button>
        </div>
    </form>
</x-guest-layout>
