<?php

namespace App\Services\Printer;

/**
 * Envia bytes ESC/POS a una impresora termica conectada por red
 * (cable RJ45 / WiFi) en el puerto raw 9100.
 */
class NetworkPrinter
{
    public function send(string $ip, int $port, string $bytes, int $timeoutSeconds = 5): void
    {
        $socket = @stream_socket_client(
            "tcp://{$ip}:{$port}",
            $errno,
            $errstr,
            $timeoutSeconds,
            STREAM_CLIENT_CONNECT,
        );

        if (! $socket) {
            throw new \RuntimeException("No se pudo conectar a la impresora {$ip}:{$port} — {$errstr}");
        }

        try {
            stream_set_timeout($socket, $timeoutSeconds);
            $written = 0;
            $total = strlen($bytes);
            while ($written < $total) {
                $chunk = fwrite($socket, substr($bytes, $written));
                if ($chunk === false || $chunk === 0) {
                    throw new \RuntimeException('Error escribiendo a la impresora (sin respuesta)');
                }
                $written += $chunk;
            }
            fflush($socket);
        } finally {
            fclose($socket);
        }
    }
}
