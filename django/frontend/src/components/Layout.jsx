import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import ScannerRedirect from "./ScannerRedirect";
import logo from "../assets/mascota.png";

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
  const [open, setOpen] = useState(false); // cajón del menú en móvil
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("fz_theme", next ? "dark" : "light");
  };

  // Instalar como app (PWA): el navegador avisa cuándo se puede instalar.
  const [installPrompt, setInstallPrompt] = useState(null);
  useEffect(() => {
    const onBIP = (e) => { e.preventDefault(); setInstallPrompt(e); };
    const onInstalled = () => setInstallPrompt(null);
    window.addEventListener("beforeinstallprompt", onBIP);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);
  const doInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };
  const showVentas = can("ventas.crear") || can("ventas.ver") || can("caja.ver")
    || can("cotizaciones.ver") || can("facturas.ver") || can("devoluciones.ver")
    || can("cuentas_cobrar.ver");
  const showInventario = can("productos.ver") || can("inventario.ajustar");
  const showCompras = can("proveedores.ver") || can("compras.ver") || can("facturas_prov.ver")
    || can("cuentas_pagar.ver");
  const showAdmin = can("usuarios.ver") || can("sucursales.gestionar") || can("transferencias.gestionar")
    || can("auditoria.ver") || can("configuracion.gestionar") || can("imports.gestionar") || can("backup.gestionar");
  const initial = (user?.name || user?.email || "U").charAt(0).toUpperCase();

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-900">
      <ScannerRedirect />
      {/* Fondo oscuro al abrir el menú en móvil */}
      {open && <div onClick={() => setOpen(false)} className="fixed inset-0 bg-black/40 z-30 lg:hidden" aria-hidden="true" />}

      <aside className={"w-60 bg-gradient-to-b from-slate-900 to-slate-950 text-slate-200 flex flex-col fixed inset-y-0 z-40 shadow-xl "
        + "transform transition-transform duration-200 lg:translate-x-0 "
        + (open ? "translate-x-0" : "-translate-x-full")}>
        <div className="px-4 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 shrink-0 rounded-xl shadow ring-1 ring-white/10 overflow-hidden">
              <img src={logo} alt="Ferretería Central" className="h-full w-full object-cover" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-white leading-tight truncate">Ferretería Central</div>
              <div className="text-[11px] text-slate-400 leading-tight truncate">Tu aliado en construcción</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-2" onClick={() => setOpen(false)}>
          <NavItem to="/" end icon="📊" label="Dashboard" />

          {showVentas && (
            <>
              <Section title="Ventas" />
              {can("ventas.crear") && <NavItem to="/pos" icon="🛒" label="Punto de venta" />}
              {can("ventas.ver") && <NavItem to="/ventas" icon="🧾" label="Ventas" />}
              {can("caja.ver") && <NavItem to="/caja" icon="💵" label="Caja" />}
              {can("cotizaciones.ver") && <NavItem to="/cotizaciones" icon="📝" label="Cotizaciones" />}
              {can("devoluciones.ver") && <NavItem to="/devoluciones" icon="↩️" label="Devoluciones" />}
              {can("facturas.ver") && <NavItem to="/facturas" icon="📑" label="Facturación (FEL)" />}
              {can("cuentas_cobrar.ver") && <NavItem to="/cuentas-por-cobrar" icon="💳" label="Cuentas por cobrar" />}
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
              {can("cuentas_pagar.ver") && <NavItem to="/cuentas-por-pagar" icon="💰" label="Cuentas por pagar" />}
              {can("facturas_prov.ver") && <NavItem to="/facturas-proveedor" icon="🧾" label="Facturas de proveedor" />}
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
              {can("configuracion.gestionar") && (
                <a href="/catalogo" target="_blank" rel="noreferrer"
                   className="mx-3 flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition text-slate-300 hover:bg-white/5 hover:text-white">
                  <span className="w-5 text-center text-base leading-none">🌐</span>
                  <span>Catálogo público ↗</span>
                </a>
              )}
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

      <div className="flex-1 lg:ml-60 flex flex-col min-h-screen min-w-0">
        <header className="bg-white/80 dark:bg-slate-800/80 backdrop-blur border-b border-slate-200 dark:border-slate-700 px-4 sm:px-6 py-3 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setOpen(true)} aria-label="Abrir menú"
                    className="lg:hidden text-slate-600 dark:text-slate-300 hover:text-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg px-2.5 py-1.5 text-lg leading-none">☰</button>
            <span className="hidden sm:inline text-sm text-slate-400">Sistema de gestión</span>
            <span className="sm:hidden font-semibold text-slate-700 dark:text-slate-200 truncate">Ferretería Central</span>
          </div>
          <div className="flex items-center gap-3">
            {branches.length > 0 && (
              <div className="flex items-center gap-1.5 text-sm">
                <span className="text-slate-400">🏢</span>
                <select value={currentBranchId || ""} onChange={(e) => setBranch(e.target.value)}
                        className="text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-700 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500">
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            )}
            {installPrompt && (
              <button onClick={doInstall} title="Instalar la app en este dispositivo"
                      className="inline-flex items-center gap-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-3 py-1.5 transition">
                ⬇️ <span className="hidden sm:inline">Instalar app</span>
              </button>
            )}
            <button onClick={toggleTheme} title={dark ? "Modo claro" : "Modo oscuro"} aria-label="Cambiar tema"
                    className="text-lg leading-none border border-slate-200 dark:border-slate-600 rounded-lg px-2.5 py-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition">
              {dark ? "☀️" : "🌙"}
            </button>
            <button onClick={logout}
                    className="text-sm text-slate-600 dark:text-slate-300 hover:text-white hover:bg-red-500 border border-slate-200 dark:border-slate-600 hover:border-red-500 rounded-lg px-3 py-1.5 transition">
              Salir
            </button>
          </div>
        </header>
        <main className="p-4 sm:p-6 flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
