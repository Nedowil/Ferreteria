@csrf

<div class="space-y-4">
    <div>
        <x-input-label for="name" :value="__('Nombre')" />
        <x-text-input id="name" name="name" type="text" class="mt-1 block w-full"
                      :value="old('name', $user->name ?? '')" required autofocus />
        <x-input-error :messages="$errors->get('name')" class="mt-2" />
    </div>

    <div>
        <x-input-label for="email" :value="__('Email')" />
        <x-text-input id="email" name="email" type="email" class="mt-1 block w-full"
                      :value="old('email', $user->email ?? '')" required />
        <x-input-error :messages="$errors->get('email')" class="mt-2" />
    </div>

    <div>
        <x-input-label for="password" :value="__('Contraseña')" />
        <x-text-input id="password" name="password" type="password" class="mt-1 block w-full"
                      :required="! isset($user)" autocomplete="new-password" />
        @isset($user)
            <p class="text-xs text-gray-500 mt-1">Deja vacío para no cambiar la contraseña.</p>
        @endisset
        <x-input-error :messages="$errors->get('password')" class="mt-2" />
    </div>

    <div>
        <x-input-label for="password_confirmation" :value="__('Confirmar contraseña')" />
        <x-text-input id="password_confirmation" name="password_confirmation" type="password"
                      class="mt-1 block w-full" autocomplete="new-password" />
    </div>

    <div>
        <x-input-label for="role" :value="__('Rol')" />
        <select id="role" name="role" required
                class="mt-1 block w-full border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-md shadow-sm">
            <option value="">— Selecciona un rol —</option>
            @foreach ($roles as $roleName)
                <option value="{{ $roleName }}"
                    @selected(old('role', $currentRole ?? '') === $roleName)>
                    {{ $roleName }}
                </option>
            @endforeach
        </select>
        <x-input-error :messages="$errors->get('role')" class="mt-2" />
    </div>

    <div class="flex items-center gap-3">
        <x-primary-button>Guardar</x-primary-button>
        <a href="{{ route('admin.usuarios.index') }}" class="text-gray-600 hover:underline">Cancelar</a>
    </div>
</div>
