<x-guest-layout>
    <h2 class="text-2xl font-bold text-slate-800 mb-1">Bienvenido</h2>
    <p class="text-sm text-slate-500 mb-6">Ingresa tus credenciales para acceder al sistema</p>

    <x-auth-session-status class="mb-4" :status="session('status')" />

    <form method="POST" action="{{ route('login') }}" class="space-y-4">
        @csrf

        <div>
            <x-input-label for="email" value="Email" />
            <x-text-input id="email" class="block mt-1 w-full" type="email" name="email" :value="old('email')" required autofocus autocomplete="username" />
            <x-input-error :messages="$errors->get('email')" class="mt-2" />
        </div>

        <div>
            <x-input-label for="password" value="Contrasena" />
            <x-text-input id="password" class="block mt-1 w-full" type="password" name="password" required autocomplete="current-password" />
            <x-input-error :messages="$errors->get('password')" class="mt-2" />
        </div>

        <div class="flex items-center justify-between">
            <label for="remember_me" class="inline-flex items-center">
                <input id="remember_me" type="checkbox" class="rounded border-gray-300 text-orange-600 shadow-sm focus:ring-orange-500" name="remember">
                <span class="ms-2 text-sm text-slate-600">Recordarme</span>
            </label>

            @if (Route::has('password.request'))
                <a class="text-sm text-orange-600 hover:text-orange-700 hover:underline" href="{{ route('password.request') }}">
                    Olvidaste tu contrasena?
                </a>
            @endif
        </div>

        <div class="pt-2">
            <x-primary-button class="w-full justify-center py-3">
                Iniciar sesion
            </x-primary-button>
        </div>
    </form>
</x-guest-layout>
