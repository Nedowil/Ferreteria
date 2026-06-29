import { NavLink } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const linkClass = ({ isActive }) =>
  "block px-5 py-2 hover:bg-slate-800 " + (isActive ? "bg-slate-800 text-white" : "");

export default function Layout({ children }) {
  const { user, branches, currentBranchId, setBranch, logout, can } = useAuth();
  const showAdmin = can("usuarios.ver") || can("sucursales.gestionar") || can("transferencias.gestionar") || can("auditoria.ver") || can("configuracion.gestionar");
  return (
    <div className="min-h-screen flex">
      <aside className="w-60 bg-slate-900 text-slate-200 flex flex-col fixed inset-y-0">
        <div className="px-5 py-4 text-lg font-bold text-white border-b border-slate-700">
          🔧 Ferretería
        </div>
        <nav className="flex-1 overflow-y-auto py-3 text-sm">
          <NavLink to="/" end className={linkClass}>Tablero</NavLink>
          <div className="px-5 pt-4 pb-1 text-xs uppercase text-slate-500">Ventas</div>
          <NavLink to="/pos" className={linkClass}>Punto de venta</NavLink>
          <NavLink to="/ventas" className={linkClass}>Ventas</NavLink>
          <NavLink to="/caja" className={linkClass}>Caja</NavLink>
          <NavLink to="/cotizaciones" className={linkClass}>Cotizaciones</NavLink>
          <NavLink to="/devoluciones" className={linkClass}>Devoluciones</NavLink>
          {can("facturas.ver") && <NavLink to="/facturas" className={linkClass}>Facturación (FEL)</NavLink>}
          <NavLink to="/cuentas-por-cobrar" className={linkClass}>Cuentas por cobrar</NavLink>
          <div className="px-5 pt-4 pb-1 text-xs uppercase text-slate-500">Inventario</div>
          <NavLink to="/productos" className={linkClass}>Productos</NavLink>
          <NavLink to="/categorias" className={linkClass}>Categorías</NavLink>
          <NavLink to="/marcas" className={linkClass}>Marcas</NavLink>
          <NavLink to="/unidades" className={linkClass}>Unidades</NavLink>
          <NavLink to="/bajo-stock" className={linkClass}>Stock bajo</NavLink>
          <NavLink to="/conteo" className={linkClass}>Conteo físico</NavLink>
          <div className="px-5 pt-4 pb-1 text-xs uppercase text-slate-500">Reportes</div>
          <NavLink to="/reportes" end className={linkClass}>Reportes</NavLink>
          <div className="px-5 pt-4 pb-1 text-xs uppercase text-slate-500">Compras</div>
          <NavLink to="/proveedores" className={linkClass}>Proveedores</NavLink>
          <NavLink to="/compras" className={linkClass}>Compras</NavLink>
          <NavLink to="/cuentas-por-pagar" className={linkClass}>Cuentas por pagar</NavLink>
          <div className="px-5 pt-4 pb-1 text-xs uppercase text-slate-500">Clientes</div>
          <NavLink to="/clientes" className={linkClass}>Clientes</NavLink>
          {showAdmin && (
            <>
              <div className="px-5 pt-4 pb-1 text-xs uppercase text-slate-500">Administración</div>
              {can("transferencias.gestionar") && <NavLink to="/transferencias" className={linkClass}>Transferencias</NavLink>}
              {can("usuarios.ver") && <NavLink to="/admin/usuarios" className={linkClass}>Usuarios</NavLink>}
              {can("roles.gestionar") && <NavLink to="/admin/roles" className={linkClass}>Roles</NavLink>}
              {can("sucursales.gestionar") && <NavLink to="/admin/sucursales" className={linkClass}>Sucursales</NavLink>}
              {can("auditoria.ver") && <NavLink to="/admin/auditoria" className={linkClass}>Auditoría</NavLink>}
              {can("configuracion.gestionar") && <NavLink to="/admin/empresa" className={linkClass}>Empresa</NavLink>}
            </>
          )}
        </nav>
        <div className="px-5 py-3 border-t border-slate-700 text-xs text-slate-400">
          {user?.name || user?.email}
        </div>
      </aside>

      <div className="flex-1 ml-60 flex flex-col">
        <header className="bg-white border-b px-6 py-3 flex items-center justify-between sticky top-0 z-10">
          <div className="text-sm text-slate-500">Sistema de gestión</div>
          <div className="flex items-center gap-4">
            {branches.length > 0 && (
              <select
                value={currentBranchId || ""}
                onChange={(e) => setBranch(e.target.value)}
                className="text-sm border border-slate-300 rounded px-2 py-1"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            )}
            <button onClick={logout} className="text-sm text-slate-500 hover:text-red-600">
              Salir
            </button>
          </div>
        </header>
        <main className="p-6 flex-1">{children}</main>
      </div>
    </div>
  );
}
