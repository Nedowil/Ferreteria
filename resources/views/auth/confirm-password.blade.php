<x-guest-layout>
    <h2 class="text-2xl font-bold text-slate-800 mb-1">Confirma tu contrasena</h2>
    <p class="text-sm text-slate-500 mb-6">Esta es un area protegida. Por favor confirma tu contrasena antes de continuar.</p>

    <form method="POST" action="{{ route('password.confirm') }}" class="space-y-4">
        @csrf

        <div>
            <x-input-label for="password" value="Contrasena" />
            <x-text-input id="password" class="block mt-1 w-full" type="password" name="password" required autocomplete="current-password" />
            <x-input-error :messages="$errors->get('password')" class="mt-2" />
        </div>

        <div class="flex justify-end pt-2">
            <x-primary-button>Confirmar</x-primary-button>
        </div>
    </form>
</x-guest-layout>
