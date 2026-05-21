<?php

namespace App\Services\Fel;

interface FelCertificadorInterface
{
    /**
     * Envia el XML del DTE al certificador y devuelve la respuesta normalizada.
     *
     * @return array{
     *   success: bool,
     *   uuid?: string,
     *   serie?: string,
     *   numero?: string,
     *   fecha_certificacion?: string,
     *   xml_signed?: string,
     *   raw?: mixed,
     *   error?: string
     * }
     */
    public function certify(string $xml): array;

    /**
     * Solicita la anulacion de un DTE.
     *
     * @return array{success: bool, uuid?: string, raw?: mixed, error?: string}
     */
    public function cancel(string $uuid, string $reason, string $documentDate): array;

    public function getName(): string;

    public function getEnvironment(): string;
}
