<?php

namespace App\Support;

/**
 * Convierte un numero decimal a su representacion en letras (espanol),
 * con el sufijo "QUETZALES" y los centavos como "EXACTOS" o "CON XX/100 QUETZALES".
 *
 * Ejemplos:
 *   1482.00 -> "MIL CUATROCIENTOS OCHENTA Y DOS QUETZALES EXACTOS"
 *   55.50   -> "CINCUENTA Y CINCO QUETZALES CON 50/100"
 */
class NumeroALetras
{
    public static function convertir(float $numero, string $moneda = 'QUETZALES'): string
    {
        $entero = (int) floor($numero);
        $decimales = (int) round(($numero - $entero) * 100);

        $letras = strtoupper(self::numeroEnLetras($entero));

        if ($decimales === 0) {
            return $letras . ' ' . $moneda . ' EXACTOS';
        }

        return $letras . ' ' . $moneda . ' CON ' . str_pad((string) $decimales, 2, '0', STR_PAD_LEFT) . '/100';
    }

    private static function numeroEnLetras(int $numero): string
    {
        if ($numero === 0) return 'CERO';
        if ($numero < 0) return 'MENOS ' . self::numeroEnLetras(-$numero);

        $unidades = ['', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
        $decenas10 = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISEIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
        $decenas = ['', '', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
        $centenas = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

        if ($numero < 10) return $unidades[$numero];
        if ($numero < 20) return $decenas10[$numero - 10];
        if ($numero < 30) {
            return $numero === 20 ? 'VEINTE' : 'VEINTI' . strtolower($unidades[$numero - 20]);
        }
        if ($numero < 100) {
            $d = intdiv($numero, 10);
            $u = $numero % 10;
            return $u === 0 ? $decenas[$d] : $decenas[$d] . ' Y ' . $unidades[$u];
        }
        if ($numero === 100) return 'CIEN';
        if ($numero < 1000) {
            $c = intdiv($numero, 100);
            $r = $numero % 100;
            return $r === 0 ? $centenas[$c] : $centenas[$c] . ' ' . self::numeroEnLetras($r);
        }
        if ($numero < 1000000) {
            $miles = intdiv($numero, 1000);
            $r = $numero % 1000;
            $prefijo = $miles === 1 ? 'MIL' : self::numeroEnLetras($miles) . ' MIL';
            return $r === 0 ? $prefijo : $prefijo . ' ' . self::numeroEnLetras($r);
        }
        if ($numero < 1000000000) {
            $millones = intdiv($numero, 1000000);
            $r = $numero % 1000000;
            $prefijo = $millones === 1 ? 'UN MILLON' : self::numeroEnLetras($millones) . ' MILLONES';
            return $r === 0 ? $prefijo : $prefijo . ' ' . self::numeroEnLetras($r);
        }

        return (string) $numero;
    }
}
