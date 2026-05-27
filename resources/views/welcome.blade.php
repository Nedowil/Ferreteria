<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <meta http-equiv="refresh" content="0; url={{ Auth::check() ? route('dashboard') : route('login') }}">
    <title>Ferreteria Central</title>
</head>
<body>
    <p>Redirigiendo a <a href="{{ Auth::check() ? route('dashboard') : route('login') }}">Ferreteria Central</a>...</p>
</body>
</html>
