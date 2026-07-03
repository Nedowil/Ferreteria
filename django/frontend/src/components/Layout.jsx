import { NavLink } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import logo from "../assets/logo.svg";

function NavItem({ to, icon, label, end }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) =>
      "mx-3 flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition " +
      (isActive
        ? "bg-white/10 text-white font-medium shadow-inner"
        : "text-slate-300 hover:bg-white/5 hover:text-white")
    }>
      <span className="w-5 text-center text-base leading-none">{icon}</span>
      <span>{label}</span>
    </NavLink>
  );
}

const Section = ({ title }) => (
  <div className="px-6 pt-5 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{title}</div>
);

export default function Layout({ children }) {
  const { user, branches, currentBranchId, setBranch, logout, can } = useAuth();
  const showVentas = can("ventas.crear") || can("ventas.ver") || can("caja.ver")
    || can("cotizaciones.ver") || can("facturas.ver");
  const showInventario = can("productos.ver") || can("inventario.ajustar");
  const showCompras = can("proveedores.ver") || can("compras.ver");
  const showAdmin = can("usuarios.ver") || can("sucursales.gestionar") || can("transferencias.gestionar")
    || can("auditoria.ver") || can("configuracion.gestionar") || can("imports.gestionar") || can("backup.gestionar");
  const initial = (user?.name || user?.email || "U").charAt(0).toUpperCase();

  return (
    <div className="min-h-screen flex bg-slate-50">
      <aside className="w-60 bg-gradient-to-b from-slate-900 to-slate-950 text-slate-200 flex flex-col fixed inset-y-0 shadow-xl">
        <div className="px-4 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 shrink-0 bg-white rounded-xl p-1 shadow ring-1 ring-black/5 flex items-center justify-center overflow-hidden">
              <img src={logo} alt="Ferretería Central" className="max-h-full max-w-full object-contain rounded-md" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-white leading-tight truncate">Ferretería Central</div>
              <div className="text-[11px] text-slate-400 leading-tight truncate">Tu aliado en construcción</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-2">
          <NavItem to="/" end icon="📊" label="Tablero" />

          {showVentas && (
            <>
              <Section title="Ventas" />
              {can("ventas.crear") && <NavItem to="/pos" icon="🛒" label="Punto de venta" />}
              {can("ventas.ver") && <NavItem to="/ventas" icon="🧾" label="Ventas" />}
              {can("caja.ver") && <NavItem to="/caja" icon="💵" label="Caja" />}
              {can("cotizaciones.ver") && <NavItem to="/cotizaciones" icon="📝" label="Cotizaciones" />}
              {can("ventas.ver") && <NavItem to="/devoluciones" icon="↩️" label="Devoluciones" />}
              {can("facturas.ver") && <NavItem to="/facturas" icon="📑" label="Facturación (FEL)" />}
              {can("ventas.ver") && <NavItem to="/cuentas-por-cobrar" icon="💳" label="Cuentas por cobrar" />}
            </>
          )}

          {showInventario && (
            <>
              <Section title="Inventario" />
              {can("productos.ver") && <NavItem to="/productos" icon="📦" label="Productos" />}
              {can("productos.ver") && <NavItem to="/marcas" icon="🔖" label="Marcas" />}
              {can("productos.ver") && <NavItem to="/bajo-stock" icon="⚠️" label="Stock bajo" />}
              {can("inventario.ajustar") && <NavItem to="/conteo" icon="🔢" label="Conteo físico" />}
            </>
          )}

          {can("reportes.ver") && (
            <>
              <Section title="Reportes" />
              <NavItem to="/reportes" end icon="📈" label="Reportes" />
            </>
          )}

          {showCompras && (
            <>
              <Section title="Compras" />
              {can("proveedores.ver") && <NavItem to="/proveedores" icon="🚚" label="Proveedores" />}
              {can("compras.ver") && <NavItem to="/compras" icon="📥" label="Compras" />}
              {can("compras.ver") && <NavItem to="/cuentas-por-pagar" icon="💰" label="Cuentas por pagar" />}
            </>
          )}

          {can("clientes.ver") && (
            <>
              <Section title="Clientes" />
              <NavItem to="/clientes" icon="👥" label="Clientes" />
            </>
          )}

          {showAdmin && (
            <>
              <Section title="Administración" />
              {can("transferencias.gestionar") && <NavItem to="/transferencias" icon="🔄" label="Transferencias" />}
              {can("usuarios.ver") && <NavItem to="/admin/usuarios" icon="👤" label="Usuarios" />}
              {can("roles.gestionar") && <NavItem to="/admin/roles" icon="🛡️" label="Roles" />}
              {can("sucursales.gestionar") && <NavItem to="/admin/sucursales" icon="🏢" label="Sucursales" />}
              {can("auditoria.ver") && <NavItem to="/admin/auditoria" icon="🕵️" label="Auditoría" />}
              {can("configuracion.gestionar") && <NavItem to="/admin/empresa" icon="⚙️" label="Empresa" />}
              {can("imports.gestionar") && <NavItem to="/admin/importar" icon="📂" label="Importar datos" />}
              {can("backup.gestionar") && <NavItem to="/admin/respaldos" icon="💾" label="Respaldos" />}
            </>
          )}
        </nav>

        <div className="px-4 py-3 border-t border-white/10 flex items-center gap-3">
          <span className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white font-bold flex items-center justify-center shrink-0">{initial}</span>
          <div className="min-w-0">
            <div className="text-sm text-white truncate">{user?.name || user?.email}</div>
            <NavLink to="/cambiar-contrasena" className="text-xs text-slate-400 hover:text-white">Cambiar contraseña</NavLink>
          </div>
        </div>
      </aside>

      <div className="flex-1 ml-60 flex flex-col min-h-screen">
        <header className="bg-white/80 backdrop-blur border-b border-slate-200 px-6 py-3 flex items-center justify-between sticky top-0 z-10">
          <div className="text-sm text-slate-400">Sistema de gestión</div>
          <div className="flex items-center gap-3">
            {branches.length > 0 && (
              <div className="flex items-center gap-1.5 text-sm">
                <span className="text-slate-400">🏢</span>
                <select value={currentBranchId || ""} onChange={(e) => setBranch(e.target.value)}
                        className="text-sm border border-slate-300 rounded-lg px-2 py-1.5 bg-white outline-none focus:ring-2 focus:ring-blue-500">
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            )}
            <button onClick={logout}
                    className="text-sm text-slate-600 hover:text-white hover:bg-red-500 border border-slate-200 hover:border-red-500 rounded-lg px-3 py-1.5 transition">
              Salir
            </button>
          </div>
        </header>
        <main className="p-6 flex-1">{children}</main>
      </div>
    </div>
  );
}
