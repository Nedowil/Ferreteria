<?php

/**
 * Configuracion FEL (Factura Electronica en Linea) - Guatemala SAT.
 *
 * Driver:
 * - stub: simula la respuesta del certificador. Util para desarrollo y demos.
 * - soap: usa el adapter SOAP/REST generico. Configurar credenciales y endpoints
 *         segun el certificador autorizado (Infile, Megaprint, Digifact, etc).
 *
 * Cuando el certificador habilite el ambiente, el cliente solo debe:
 *   1) Editar .env con sus credenciales y endpoints
 *   2) Cambiar FEL_DRIVER=soap
 *   3) (Opcional) Mantener FEL_ENVIRONMENT=PRUEBAS para validar antes de produccion
 */

return [
    // 'stub' = simula respuestas (modo demo)
    // 'infile' = Infile S.A. (REST API + token)
    // 'soap' = adapter generico SOAP (Megaprint y otros)
    'driver' => env('FEL_DRIVER', 'stub'),
    'environment' => env('FEL_ENVIRONMENT', 'PRUEBAS'),
    'certificador' => env('FEL_CERTIFICADOR', ''),

    'credentials' => [
        // Comunes
        'username' => env('FEL_API_USERNAME'),
        'password' => env('FEL_API_PASSWORD'),
        'token' => env('FEL_API_TOKEN'),
        'requestor_nit' => env('FEL_REQUESTOR_NIT'),
        'emisor_nit' => env('FEL_NIT_EMISOR'),
        // Infile especificos
        'signer_token' => env('FEL_SIGNER_TOKEN'), // LlaveFirma
        'api_key' => env('FEL_API_KEY'),           // LlaveApi
    ],

    'endpoints' => [
        // Infile defaults — overridear con .env si cambian
        'certification' => env('FEL_CERTIFICATION_URL', 'https://certificador.feel.com.gt/fel/procesounificado/transaccion/v2/xml'),
        'cancellation' => env('FEL_CANCELLATION_URL', 'https://certificador.feel.com.gt/fel/procesounificado/transaccion/v2/xml'),
        'lookup' => env('FEL_LOOKUP_URL', 'https://consultareceptor.feel.com.gt/rest/action'),
    ],

    'timeout' => (int) env('FEL_TIMEOUT', 30),

    // Frases SAT mas comunes. Cada certificador puede pedir codigos especificos.
    // Tipo: 1=ISR, 2=IVA, 3=ISO, 4=TURISMO_HOSPEDAJE, 5=ESCENARIO_AGENTE_RETENCION.
    'phrases_catalog' => [
        ['code' => '1', 'scenario' => '1', 'description' => 'Sujeto a pagos trimestrales ISR'],
        ['code' => '2', 'scenario' => '1', 'description' => 'No genera derecho a credito fiscal'],
        ['code' => '1', 'scenario' => '5', 'description' => 'Sujeto a retencion definitiva'],
    ],
];
