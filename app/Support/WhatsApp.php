<?php

namespace App\Support;

/**
 * Generador de enlaces wa.me (click-to-chat) para enviar facturas y
 * cotizaciones a clientes via WhatsApp sin necesidad de WhatsApp Business API.
 * El cliente abre el enlace, redacta WhatsApp con el mensaje pre-llenado y solo
 * presiona enviar.
 */
class WhatsApp
{
    /**
     * Construye una URL wa.me con telefono y mensaje opcional.
     * Si el telefono es null, abre wa.me sin destinatario (el usuario lo elige).
     */
    public static function link(?string $phone, string $message): string
    {
        $cleanPhone = $phone ? preg_replace('/[^0-9]/', '', $phone) : '';

        // Si el numero no incluye codigo de pais (Guatemala = 502), lo agregamos
        if ($cleanPhone && strlen($cleanPhone) === 8) {
            $cleanPhone = '502' . $cleanPhone;
        }

        return $cleanPhone
            ? "https://wa.me/{$cleanPhone}?text=" . rawurlencode($message)
            : 'https://wa.me/?text=' . rawurlencode($message);
    }
}
