import { Component, lazy, Suspense } from "react";
import { Routes, Route, Navigate, Link, useLocation } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import Layout from "./components/Layout";
import Login from "./pages/Login"; // eager: es la puerta de entrada

// Code-splitting: cada pantalla se carga en su propio "chunk" solo cuando se
// visita, así la primera carga de la app es mucho más liviana.
const Dashboard = lazy(() => import("./pages/Dashboard"));
const ProductList = lazy(() => import("./pages/products/ProductList"));
const ProductForm = lazy(() => import("./pages/products/ProductForm"));
const InventoryShow = lazy(() => import("./pages/products/InventoryShow"));
const LowStock = lazy(() => import("./pages/products/LowStock"));
const StockCount = lazy(() => import("./pages/products/StockCount"));
const CatalogList = lazy(() => import("./pages/catalogs/CatalogList"));
const SupplierList = lazy(() => import("./pages/partners/SupplierList"));
const CustomerList = lazy(() => import("./pages/partners/CustomerList"));
const PurchaseList = lazy(() => import("./pages/purchases/PurchaseList"));
const PurchaseForm = lazy(() => import("./pages/purchases/PurchaseForm"));
const PurchaseDetail = lazy(() => import("./pages/purchases/PurchaseDetail"));
const Payable = lazy(() => import("./pages/purchases/Payable"));
const SupplierBills = lazy(() => import("./pages/supplierbills/SupplierBills"));
const POS = lazy(() => import("./pages/pos/POS"));
const SalesList = lazy(() => import("./pages/pos/SalesList"));
const SaleDetail = lazy(() => import("./pages/pos/SaleDetail"));
const Receivable = lazy(() => import("./pages/pos/Receivable"));
const CashBox = lazy(() => import("./pages/cash/CashBox"));
const CashSessions = lazy(() => import("./pages/cash/CashSessions"));
const QuotationList = lazy(() => import("./pages/quotes/QuotationList"));
const QuotationForm = lazy(() => import("./pages/quotes/QuotationForm"));
const QuotationDetail = lazy(() => import("./pages/quotes/QuotationDetail"));
const ReturnsList = lazy(() => import("./pages/returns/ReturnsList"));
const ReturnCreate = lazy(() => import("./pages/returns/ReturnCreate"));
const ReturnDetail = lazy(() => import("./pages/returns/ReturnDetail"));
const ReportsIndex = lazy(() => import("./pages/reports/ReportsIndex"));
const SalesReport = lazy(() => import("./pages/reports/SalesReport"));
const ProfitReport = lazy(() => import("./pages/reports/ProfitReport"));
const InventoryValue = lazy(() => import("./pages/reports/InventoryValue"));
const DeadStock = lazy(() => import("./pages/reports/DeadStock"));
const DailyCash = lazy(() => import("./pages/reports/DailyCash"));
const TopProducts = lazy(() => import("./pages/reports/Rankings").then((m) => ({ default: m.TopProducts })));
const TopCustomers = lazy(() => import("./pages/reports/Rankings").then((m) => ({ default: m.TopCustomers })));
const TopSuppliers = lazy(() => import("./pages/reports/Rankings").then((m) => ({ default: m.TopSuppliers })));
const BySeller = lazy(() => import("./pages/reports/Rankings").then((m) => ({ default: m.BySeller })));
const ByCategory = lazy(() => import("./pages/reports/Rankings").then((m) => ({ default: m.ByCategory })));
const SupplierPayments = lazy(() => import("./pages/reports/SupplierPayments"));
const Users = lazy(() => import("./pages/admin/Users"));
const Roles = lazy(() => import("./pages/admin/Roles"));
const Branches = lazy(() => import("./pages/admin/Branches"));
const Transfers = lazy(() => import("./pages/admin/Transfers"));
const TransferCreate = lazy(() => import("./pages/admin/TransferCreate"));
const TransferDetail = lazy(() => import("./pages/admin/TransferDetail"));
const AuditLog = lazy(() => import("./pages/admin/AuditLog"));
const Invoices = lazy(() => import("./pages/billing/Invoices"));
const Ticket = lazy(() => import("./pages/billing/Ticket"));
const CompanySettings = lazy(() => import("./pages/billing/CompanySettings"));
const ImportData = lazy(() => import("./pages/admin/ImportData"));
const Backups = lazy(() => import("./pages/admin/Backups"));
const PublicCatalog = lazy(() => import("./pages/public/PublicCatalog"));
const CustomerDisplay = lazy(() => import("./pages/pos/CustomerDisplay"));
const ForgotPassword = lazy(() => import("./pages/auth/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/auth/ResetPassword"));
const ChangePassword = lazy(() => import("./pages/auth/ChangePassword"));

const Loading = () => <div className="p-10 text-center text-slate-400">Cargando…</div>;

function NoAccess() {
  return (
    <div className="max-w-md mx-auto mt-20 text-center">
      <div className="text-5xl mb-4">🔒</div>
      <h1 className="text-xl font-bold text-slate-800">Sin acceso</h1>
      <p className="text-slate-500 mt-2">
        No tenés permiso para ver esta sección. Si creés que es un error, pedile a un
        administrador que te habilite el permiso correspondiente.
      </p>
      <Link to="/" className="inline-block mt-5 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium">
        Volver al Dashboard
      </Link>
    </div>
  );
}

// Red de seguridad: si una pantalla lanza un error de render, en vez de dejar
// TODA la app en blanco (obligando a refrescar), muestra un aviso y permite
// reintentar/seguir navegando. Se reinicia al cambiar de ruta (key=pathname).
class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) {
    // Queda en consola para diagnóstico (no rompe la app).
    console.error("Error en la pantalla:", error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="max-w-md mx-auto mt-16 text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <h1 className="text-xl font-bold text-slate-800">No se pudo mostrar esta pantalla</h1>
          <p className="text-slate-500 mt-2">
            Ocurrió un error al cargar este módulo. Podés reintentar o ir a otra sección.
          </p>
          <div className="flex gap-2 justify-center mt-5">
            <button onClick={() => this.setState({ error: null })}
                    className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium">Reintentar</button>
            <button onClick={() => window.location.reload()}
                    className="border border-slate-300 text-slate-700 rounded-lg px-4 py-2 text-sm font-medium">Recargar página</button>
          </div>
          <details className="mt-5 text-left text-xs text-slate-400">
            <summary className="cursor-pointer">Detalle técnico</summary>
            <pre className="whitespace-pre-wrap break-words mt-2 bg-slate-100 rounded p-2">{String(this.state.error?.message || this.state.error)}</pre>
          </details>
        </div>
      );
    }
    return this.props.children;
  }
}

// `perm` opcional: si el usuario no lo tiene, ve la pantalla "Sin acceso"
// (aunque escriba la URL directo). El backend igual valida cada endpoint.
function Protected({ children, perm }) {
  const { user, loading, can } = useAuth();
  const location = useLocation();
  if (loading) return <div className="p-10 text-center text-slate-400">Cargando…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (perm && !can(perm)) return <Layout><NoAccess /></Layout>;
  return (
    <Layout>
      <ErrorBoundary key={location.pathname}>
        <Suspense fallback={<Loading />}>{children}</Suspense>
      </ErrorBoundary>
    </Layout>
  );
}

export default function App() {
  return (
    <Suspense fallback={<Loading />}>
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/recuperar-contrasena" element={<ForgotPassword />} />
      <Route path="/restablecer-contrasena" element={<ResetPassword />} />
      <Route path="/catalogo" element={<PublicCatalog />} />
      <Route path="/pantalla-cliente" element={<CustomerDisplay />} />
      <Route path="/" element={<Protected><Dashboard /></Protected>} />
      <Route path="/productos" element={<Protected perm="productos.ver"><ProductList /></Protected>} />
      <Route path="/productos/nuevo" element={<Protected perm="productos.crear"><ProductForm /></Protected>} />
      <Route path="/productos/:id/editar" element={<Protected perm="productos.editar"><ProductForm /></Protected>} />
      <Route path="/productos/:id/inventario" element={<Protected perm="productos.ver"><InventoryShow /></Protected>} />
      <Route path="/bajo-stock" element={<Protected perm="productos.ver"><LowStock /></Protected>} />
      <Route path="/conteo" element={<Protected perm="inventario.ajustar"><StockCount /></Protected>} />
      <Route path="/categorias" element={<Protected perm="productos.ver"><CatalogList kind="categories" /></Protected>} />
      <Route path="/marcas" element={<Protected perm="productos.ver"><CatalogList kind="brands" /></Protected>} />
      <Route path="/unidades" element={<Protected perm="productos.ver"><CatalogList kind="units" /></Protected>} />
      <Route path="/proveedores" element={<Protected perm="proveedores.ver"><SupplierList /></Protected>} />
      <Route path="/clientes" element={<Protected perm="clientes.ver"><CustomerList /></Protected>} />
      <Route path="/compras" element={<Protected perm="compras.ver"><PurchaseList /></Protected>} />
      <Route path="/compras/nueva" element={<Protected perm="compras.crear"><PurchaseForm /></Protected>} />
      <Route path="/compras/:id" element={<Protected perm="compras.ver"><PurchaseDetail /></Protected>} />
      <Route path="/cuentas-por-pagar" element={<Protected perm="cuentas_pagar.ver"><Payable /></Protected>} />
      <Route path="/facturas-proveedor" element={<Protected perm="facturas_prov.ver"><SupplierBills /></Protected>} />
      <Route path="/pos" element={<Protected perm="ventas.crear"><POS /></Protected>} />
      <Route path="/ventas" element={<Protected perm="ventas.ver"><SalesList /></Protected>} />
      <Route path="/ventas/:id" element={<Protected perm="ventas.ver"><SaleDetail /></Protected>} />
      <Route path="/ventas/:id/ticket" element={<Protected perm="ventas.ver"><Ticket /></Protected>} />
      <Route path="/cuentas-por-cobrar" element={<Protected perm="cuentas_cobrar.ver"><Receivable /></Protected>} />
      <Route path="/caja" element={<Protected perm="caja.ver"><CashBox /></Protected>} />
      <Route path="/caja/historial" element={<Protected perm="caja.ver"><CashSessions /></Protected>} />
      <Route path="/cotizaciones" element={<Protected perm="cotizaciones.ver"><QuotationList /></Protected>} />
      <Route path="/cotizaciones/nueva" element={<Protected perm="cotizaciones.crear"><QuotationForm /></Protected>} />
      <Route path="/cotizaciones/:id" element={<Protected perm="cotizaciones.ver"><QuotationDetail /></Protected>} />
      <Route path="/devoluciones" element={<Protected perm="devoluciones.ver"><ReturnsList /></Protected>} />
      <Route path="/devoluciones/nueva" element={<Protected perm="devoluciones.crear"><ReturnCreate /></Protected>} />
      <Route path="/devoluciones/:id" element={<Protected perm="devoluciones.ver"><ReturnDetail /></Protected>} />
      <Route path="/reportes" element={<Protected perm="reportes.ver"><ReportsIndex /></Protected>} />
      <Route path="/reportes/ventas" element={<Protected perm="reportes.ver"><SalesReport /></Protected>} />
      <Route path="/reportes/utilidad" element={<Protected perm="reportes.ver"><ProfitReport /></Protected>} />
      <Route path="/reportes/top-productos" element={<Protected perm="reportes.ver"><TopProducts /></Protected>} />
      <Route path="/reportes/top-clientes" element={<Protected perm="reportes.ver"><TopCustomers /></Protected>} />
      <Route path="/reportes/top-proveedores" element={<Protected perm="reportes.ver"><TopSuppliers /></Protected>} />
      <Route path="/reportes/por-vendedor" element={<Protected perm="reportes.ver"><BySeller /></Protected>} />
      <Route path="/reportes/por-categoria" element={<Protected perm="reportes.ver"><ByCategory /></Protected>} />
      <Route path="/reportes/stock-muerto" element={<Protected perm="reportes.ver"><DeadStock /></Protected>} />
      <Route path="/reportes/corte-diario" element={<Protected perm="reportes.ver"><DailyCash /></Protected>} />
      <Route path="/reportes/valor-inventario" element={<Protected perm="reportes.ver"><InventoryValue /></Protected>} />
      <Route path="/reportes/pagos-proveedor" element={<Protected perm="reportes.ver"><SupplierPayments /></Protected>} />
      <Route path="/admin/usuarios" element={<Protected perm="usuarios.ver"><Users /></Protected>} />
      <Route path="/admin/roles" element={<Protected perm="roles.gestionar"><Roles /></Protected>} />
      <Route path="/admin/sucursales" element={<Protected perm="sucursales.gestionar"><Branches /></Protected>} />
      <Route path="/transferencias" element={<Protected perm="transferencias.gestionar"><Transfers /></Protected>} />
      <Route path="/transferencias/nueva" element={<Protected perm="transferencias.gestionar"><TransferCreate /></Protected>} />
      <Route path="/transferencias/:id" element={<Protected perm="transferencias.gestionar"><TransferDetail /></Protected>} />
      <Route path="/admin/auditoria" element={<Protected perm="auditoria.ver"><AuditLog /></Protected>} />
      <Route path="/facturas" element={<Protected perm="facturas.ver"><Invoices /></Protected>} />
      <Route path="/admin/empresa" element={<Protected perm="configuracion.gestionar"><CompanySettings /></Protected>} />
      <Route path="/cambiar-contrasena" element={<Protected><ChangePassword /></Protected>} />
      <Route path="/admin/importar" element={<Protected perm="imports.gestionar"><ImportData /></Protected>} />
      <Route path="/admin/respaldos" element={<Protected perm="backup.gestionar"><Backups /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  );
}
