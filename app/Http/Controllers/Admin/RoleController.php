<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\View\View;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class RoleController extends Controller
{
    /**
     * Catalogo de permisos agrupados para mostrar amigables en el UI.
     * Cualquier permiso registrado en BD que no este aqui aparecera en "Otros".
     */
    private function permissionGroups(): array
    {
        return [
            'Dashboard (panel principal)' => [
                '_icon' => '📊',
                '_color' => 'sky',
                '_description' => 'Controla qué tarjetas ve cada usuario al entrar al sistema.',
                'dashboard.ventas_hoy' => 'Ver tarjeta "Ventas hoy" (cantidad y monto del día)',
                'dashboard.ventas_mes' => 'Ver tarjeta "Ventas del mes" (total acumulado del mes)',
                'dashboard.productos_total' => 'Ver tarjeta "Productos registrados" (catálogo)',
                'dashboard.stock_bajo' => 'Ver tarjeta "Stock bajo" (contador de alertas)',
                'dashboard.productos_reponer' => 'Ver lista detallada de productos por reponer',
                'dashboard.accesos_rapidos' => 'Ver botones de accesos rápidos (POS, cotizar, etc)',
                'dashboard.cajas_abiertas' => 'Ver tarjeta "Cajas abiertas"',
            ],
            'Usuarios y roles' => [
                '_icon' => '👥',
                '_color' => 'indigo',
                '_description' => 'Quién puede gestionar usuarios y sus permisos.',
                'usuarios.ver' => 'Ver usuarios',
                'usuarios.crear' => 'Crear usuarios',
                'usuarios.editar' => 'Editar usuarios',
                'usuarios.eliminar' => 'Eliminar usuarios',
                'roles.gestionar' => 'Gestionar roles y permisos',
            ],
            'Productos e inventario' => [
                '_icon' => '📦',
                '_color' => 'orange',
                '_description' => 'Catálogo, productos, stock y movimientos.',
                'productos.ver' => 'Ver productos',
                'productos.crear' => 'Crear productos',
                'productos.editar' => 'Editar productos',
                'productos.eliminar' => 'Eliminar productos',
                'catalogos.gestionar' => 'Gestionar catálogos (categorías, marcas, unidades)',
                'inventario.ajustar' => 'Ajustar inventario',
            ],
            'Compras y proveedores' => [
                '_icon' => '🚚',
                '_color' => 'purple',
                '_description' => 'Compras a proveedores y gestión de los mismos.',
                'proveedores.ver' => 'Ver proveedores',
                'proveedores.crear' => 'Crear proveedores',
                'proveedores.editar' => 'Editar proveedores',
                'proveedores.eliminar' => 'Eliminar proveedores',
                'compras.ver' => 'Ver compras',
                'compras.crear' => 'Crear compras',
                'compras.recibir' => 'Recibir compras (suma al stock)',
                'compras.cancelar' => 'Cancelar compras',
            ],
            'Clientes y ventas' => [
                '_icon' => '🛒',
                '_color' => 'green',
                '_description' => 'POS, clientes, cotizaciones y devoluciones.',
                'clientes.ver' => 'Ver clientes',
                'clientes.crear' => 'Crear clientes',
                'clientes.editar' => 'Editar clientes',
                'clientes.eliminar' => 'Eliminar clientes',
                'ventas.ver' => 'Ver ventas',
                'ventas.crear' => 'Crear ventas (POS)',
                'ventas.cancelar' => 'Cancelar ventas / procesar devoluciones',
                'cotizaciones.ver' => 'Ver cotizaciones',
                'cotizaciones.crear' => 'Crear cotizaciones',
                'cotizaciones.convertir' => 'Convertir cotización a venta',
                'cotizaciones.cancelar' => 'Cancelar cotizaciones',
            ],
            'Facturación electrónica FEL' => [
                '_icon' => '📄',
                '_color' => 'blue',
                '_description' => 'Emisión, anulación y consulta de facturas SAT.',
                'facturas.ver' => 'Ver facturas FEL',
                'facturas.emitir' => 'Emitir facturas FEL',
                'facturas.anular' => 'Anular facturas FEL',
            ],
            'Caja' => [
                '_icon' => '💵',
                '_color' => 'emerald',
                '_description' => 'Apertura, cierre y movimientos de la caja registradora.',
                'caja.ver' => 'Ver su propia caja',
                'caja.abrir' => 'Abrir caja',
                'caja.cerrar' => 'Cerrar caja',
                'caja.movimientos' => 'Registrar ingresos/egresos en caja',
                'caja.ver_todas' => 'Ver cajas de todos los usuarios (supervisor)',
            ],
            'Reportes y administración' => [
                '_icon' => '⚙️',
                '_color' => 'slate',
                '_description' => 'Reportes, configuración del sistema y operaciones avanzadas.',
                'reportes.ver' => 'Ver reportes',
                'configuracion.gestionar' => 'Gestionar configuración del emisor (logo, FEL, impresoras)',
                'sucursales.gestionar' => 'Gestionar sucursales',
                'transferencias.gestionar' => 'Crear y gestionar transferencias entre sucursales',
                'auditoria.ver' => 'Ver log de auditoría (quién hizo qué)',
                'backup.gestionar' => 'Gestionar backups',
                'imports.gestionar' => 'Importar datos masivos desde CSV',
            ],
        ];
    }

    public function index(): View
    {
        $roles = Role::with('permissions')->orderBy('name')->get();

        return view('admin.roles.index', compact('roles'));
    }

    public function create(): View
    {
        return view('admin.roles.form', [
            'role' => new Role(),
            'rolePermissions' => [],
            'groups' => $this->permissionGroups(),
            'allPermissionNames' => Permission::pluck('name')->toArray(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:60', 'unique:roles,name'],
            'permissions' => ['nullable', 'array'],
            'permissions.*' => ['string', 'exists:permissions,name'],
        ]);

        $role = Role::create(['name' => $data['name'], 'guard_name' => 'web']);
        $role->syncPermissions($data['permissions'] ?? []);

        return redirect()->route('admin.roles.index')->with('status', "Rol '{$role->name}' creado.");
    }

    public function edit(Role $role): View
    {
        return view('admin.roles.form', [
            'role' => $role,
            'rolePermissions' => $role->permissions->pluck('name')->toArray(),
            'groups' => $this->permissionGroups(),
            'allPermissionNames' => Permission::pluck('name')->toArray(),
        ]);
    }

    public function update(Request $request, Role $role): RedirectResponse
    {
        // No permitir renombrar admin para evitar romper el sistema
        $renameable = $role->name !== 'admin';

        $data = $request->validate([
            'name' => [
                $renameable ? 'required' : 'nullable',
                'string',
                'max:60',
                Rule::unique('roles', 'name')->ignore($role->id),
            ],
            'permissions' => ['nullable', 'array'],
            'permissions.*' => ['string', 'exists:permissions,name'],
        ]);

        if ($renameable && ! empty($data['name'])) {
            $role->update(['name' => $data['name']]);
        }

        // El rol admin siempre conserva todos los permisos
        if ($role->name === 'admin') {
            $role->syncPermissions(Permission::all());
        } else {
            $role->syncPermissions($data['permissions'] ?? []);
        }

        return redirect()->route('admin.roles.index')->with('status', "Permisos del rol '{$role->name}' actualizados.");
    }

    public function destroy(Role $role): RedirectResponse
    {
        if (in_array($role->name, ['admin', 'vendedor', 'almacenista'], true)) {
            return back()->withErrors(['delete' => "El rol '{$role->name}' es del sistema y no se puede eliminar."]);
        }

        if ($role->users()->count() > 0) {
            return back()->withErrors(['delete' => "No se puede eliminar: hay {$role->users()->count()} usuario(s) con este rol."]);
        }

        $name = $role->name;
        $role->delete();

        return redirect()->route('admin.roles.index')->with('status', "Rol '{$name}' eliminado.");
    }
}
