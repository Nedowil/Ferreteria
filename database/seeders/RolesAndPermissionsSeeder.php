<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class RolesAndPermissionsSeeder extends Seeder
{
    public function run(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $permissions = [
            // Usuarios
            'usuarios.ver',
            'usuarios.crear',
            'usuarios.editar',
            'usuarios.eliminar',
            'roles.gestionar',
            // Catalogos (categorias, marcas, unidades)
            'catalogos.gestionar',
            // Productos
            'productos.ver',
            'productos.crear',
            'productos.editar',
            'productos.eliminar',
            // Inventario
            'inventario.ajustar',
            // Proveedores
            'proveedores.ver',
            'proveedores.crear',
            'proveedores.editar',
            'proveedores.eliminar',
            // Compras
            'compras.ver',
            'compras.crear',
            'compras.recibir',
            'compras.cancelar',
            // Clientes
            'clientes.ver',
            'clientes.crear',
            'clientes.editar',
            'clientes.eliminar',
            // Ventas / POS
            'ventas.ver',
            'ventas.crear',
            'ventas.cancelar',
            // Caja
            'caja.ver',
            'caja.abrir',
            'caja.cerrar',
            'caja.movimientos',
            'caja.ver_todas',
            // Reportes
            'reportes.ver',
            // Configuracion
            'configuracion.gestionar',
            // Cotizaciones
            'cotizaciones.ver',
            'cotizaciones.crear',
            'cotizaciones.convertir',
            'cotizaciones.cancelar',
            // Facturacion FEL
            'facturas.ver',
            'facturas.emitir',
            'facturas.anular',
            // Multi-sucursal / Admin operacional
            'sucursales.gestionar',
            'transferencias.gestionar',
            'auditoria.ver',
            'backup.gestionar',
            'imports.gestionar',
            // Dashboard widgets (controlan que ve cada usuario en el panel principal)
            'dashboard.ventas_hoy',
            'dashboard.ventas_mes',
            'dashboard.productos_total',
            'dashboard.stock_bajo',
            'dashboard.productos_reponer',
            'dashboard.accesos_rapidos',
            'dashboard.cajas_abiertas',
            'dashboard.fel_quota',
        ];

        foreach ($permissions as $permission) {
            Permission::firstOrCreate(['name' => $permission, 'guard_name' => 'web']);
        }

        $admin = Role::firstOrCreate(['name' => 'admin', 'guard_name' => 'web']);
        $admin->syncPermissions(Permission::all());

        $almacenista = Role::firstOrCreate(['name' => 'almacenista', 'guard_name' => 'web']);
        $almacenista->syncPermissions([
            'catalogos.gestionar',
            'productos.ver',
            'productos.crear',
            'productos.editar',
            'productos.eliminar',
            'inventario.ajustar',
            'proveedores.ver',
            'proveedores.crear',
            'proveedores.editar',
            'proveedores.eliminar',
            'compras.ver',
            'compras.crear',
            'compras.recibir',
            'compras.cancelar',
            // Dashboard: solo widgets de stock/productos, no ve ventas
            'dashboard.productos_total',
            'dashboard.stock_bajo',
            'dashboard.productos_reponer',
            'dashboard.accesos_rapidos',
        ]);

        $vendedor = Role::firstOrCreate(['name' => 'vendedor', 'guard_name' => 'web']);
        $vendedor->syncPermissions([
            'productos.ver',
            'clientes.ver',
            'clientes.crear',
            'clientes.editar',
            'ventas.ver',
            'ventas.crear',
            'caja.ver',
            'caja.abrir',
            'caja.cerrar',
            'caja.movimientos',
            'cotizaciones.ver',
            'cotizaciones.crear',
            'cotizaciones.convertir',
            'cotizaciones.cancelar',
            'facturas.ver',
            'facturas.emitir',
            // Dashboard: ve sus ventas pero NO el total del mes ni stock bajo
            'dashboard.ventas_hoy',
            'dashboard.cajas_abiertas',
            'dashboard.accesos_rapidos',
        ]);
    }
}
