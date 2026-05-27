<x-guest-layout>
    <h2 class="text-2xl font-bold text-slate-800 mb-1">Verifica tu email</h2>
    <p class="text-sm text-slate-500 mb-6">Gracias por registrarte. Antes de empezar, verifica tu direccion de email haciendo clic en el enlace que te enviamos. Si no lo recibiste, te enviamos otro con gusto.</p>

    @if (session('status') == 'verification-link-sent')
        <div class="mb-4 font-medium text-sm text-green-600">
            Se envio un nuevo enlace de verificacion a la direccion de email que registraste.
        </div>
    @endif

    <div class="mt-4 flex items-center justify-between">
        <form method="POST" action="{{ route('verification.send') }}">
            @csrf
            <x-primary-button>Reenviar enlace</x-primary-button>
        </form>

        <form method="POST" action="{{ route('logout') }}">
            @csrf
            <button type="submit" class="text-sm text-orange-600 hover:text-orange-700 hover:underline">
                Cerrar sesion
            </button>
        </form>
    </div>
</x-guest-layout>
