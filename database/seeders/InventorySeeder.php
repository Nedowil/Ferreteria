<?php

namespace Database\Seeders;

use App\Models\Branch;
use App\Models\Brand;
use App\Models\Category;
use App\Models\Customer;
use App\Models\Product;
use App\Models\ProductStock;
use App\Models\Supplier;
use App\Models\Unit;
use Illuminate\Database\Seeder;

class InventorySeeder extends Seeder
{
    public function run(): void
    {
        // Sucursal principal por defecto
        $mainBranch = Branch::firstOrCreate(
            ['code' => 'PRINCIPAL'],
            [
                'name' => 'Sucursal Principal',
                'address' => 'Uspantan Quiche',
                'phone' => '51675311',
                'is_main' => true,
                'active' => true,
            ],
        );

        $units = [
            ['name' => 'Pieza', 'abbreviation' => 'pza'],
            ['name' => 'Metro', 'abbreviation' => 'm'],
            ['name' => 'Kilogramo', 'abbreviation' => 'kg'],
            ['name' => 'Litro', 'abbreviation' => 'L'],
            ['name' => 'Caja', 'abbreviation' => 'cja'],
            ['name' => 'Paquete', 'abbreviation' => 'paq'],
        ];
        foreach ($units as $u) {
            Unit::firstOrCreate(['name' => $u['name']], $u);
        }

        $categories = [
            'Herramientas manuales',
            'Herramientas electricas',
            'Plomeria',
            'Electrico',
            'Pintura',
            'Tornilleria',
            'Construccion',
        ];
        foreach ($categories as $name) {
            Category::firstOrCreate(['name' => $name]);
        }

        $brands = ['Truper', 'Stanley', 'DeWalt', 'Foset', 'Comex', 'Generico'];
        foreach ($brands as $name) {
            Brand::firstOrCreate(['name' => $name]);
        }

        $pza = Unit::where('name', 'Pieza')->first();
        $herr = Category::where('name', 'Herramientas manuales')->first();
        $truper = Brand::where('name', 'Truper')->first();

        $samples = [
            ['sku' => 'MAR-001', 'name' => 'Martillo de bola 16oz', 'purchase_price' => 80, 'sale_price' => 145, 'stock' => 25, 'min_stock' => 5],
            ['sku' => 'DES-001', 'name' => 'Desarmador plano 6"', 'purchase_price' => 25, 'sale_price' => 55, 'stock' => 40, 'min_stock' => 10],
            ['sku' => 'LLA-001', 'name' => 'Llave inglesa 10"', 'purchase_price' => 120, 'sale_price' => 210, 'stock' => 3, 'min_stock' => 5],
        ];

        foreach ($samples as $s) {
            $product = Product::firstOrCreate(
                ['sku' => $s['sku']],
                array_merge($s, [
                    'category_id' => $herr?->id,
                    'brand_id' => $truper?->id,
                    'unit_id' => $pza?->id,
                    'active' => true,
                ]),
            );

            // Stock por sucursal: replica el stock global en la sucursal principal
            ProductStock::firstOrCreate(
                ['product_id' => $product->id, 'branch_id' => $mainBranch->id],
                ['stock' => $product->stock, 'min_stock' => $product->min_stock],
            );
        }

        $suppliers = [
            ['name' => 'Distribuidora Truper SA de CV', 'tax_id' => 'DTR901234ABC', 'phone' => '5555-0001', 'email' => 'ventas@truper.example'],
            ['name' => 'Ferreteria Mayoreo del Norte', 'tax_id' => 'FMN880101XYZ', 'phone' => '5555-0002', 'email' => 'contacto@fmn.example'],
        ];
        foreach ($suppliers as $s) {
            Supplier::firstOrCreate(['name' => $s['name']], $s + ['active' => true]);
        }

        $customers = [
            ['name' => 'Publico en general', 'tax_id' => 'CF'],
            ['name' => 'Constructora del Valle SA', 'tax_id' => '1234567-8', 'email' => 'compras@cdv.example', 'phone' => '5555-1001'],
        ];
        foreach ($customers as $c) {
            Customer::firstOrCreate(['name' => $c['name']], $c + ['active' => true]);
        }

        \App\Models\CompanySetting::firstOrCreate([], [
            'commercial_name' => 'Ferreteria Central',
            'legal_name' => 'Ferreteria Central',
            'tax_id' => '46851372',
            'tax_regime' => \App\Models\CompanySetting::REGIMEN_PEQUENO,
            'address' => 'Uspantan Quiche',
            'municipality' => 'Uspantan',
            'department' => 'Quiche',
            'postal_code' => '14014',
            'phone' => '51675311',
            'email' => 'ventas@ferreteriacentral.gt',
            'country_code' => 'GT',
            'currency_code' => 'GTQ',
            'default_tax_rate' => 12.00,
            'prices_include_tax' => true,
        ]);
    }
}
