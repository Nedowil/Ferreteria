<?php

namespace Database\Seeders;

use App\Models\Brand;
use App\Models\Category;
use App\Models\Product;
use App\Models\Unit;
use Illuminate\Database\Seeder;

class InventorySeeder extends Seeder
{
    public function run(): void
    {
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
            Product::firstOrCreate(
                ['sku' => $s['sku']],
                array_merge($s, [
                    'category_id' => $herr?->id,
                    'brand_id' => $truper?->id,
                    'unit_id' => $pza?->id,
                    'active' => true,
                ]),
            );
        }
    }
}
