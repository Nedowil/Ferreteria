import { Routes, Route, Navigate, Link } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ProductList from "./pages/products/ProductList";
import ProductForm from "./pages/products/ProductForm";
import InventoryShow from "./pages/products/InventoryShow";
import LowStock from "./pages/products/LowStock";
import StockCount from "./pages/products/StockCount";
import CatalogList from "./pages/catalogs/CatalogList";
import SupplierList from "./pages/partners/SupplierList";
import CustomerList from "./pages/partners/CustomerList";
import PurchaseList from "./pages/purchases/PurchaseList";
import PurchaseForm from "./pages/purchases/PurchaseForm";
import PurchaseDetail from "./pages/purchases/PurchaseDetail";
import Payable from "./pages/purchases/Payable";
import SupplierBills from "./pages/supplierbills/SupplierBills";
import POS from "./pages/pos/POS";
import SalesList from "./pages/pos/SalesList";
import SaleDetail from "./pages/pos/SaleDetail";
import Receivable from "./pages/pos/Receivable";
import CashBox from "./pages/cash/CashBox";
import CashSessions from "./pages/cash/CashSessions";
import QuotationList from "./pages/quotes/QuotationList";
import QuotationForm from "./pages/quotes/QuotationForm";
import QuotationDetail from "./pages/quotes/QuotationDetail";
import ReturnsList from "./pages/returns/ReturnsList";
import ReturnCreate from "./pages/returns/ReturnCreate";
import ReturnDetail from "./pages/returns/ReturnDetail";
import ReportsIndex from "./pages/reports/ReportsIndex";
import SalesReport from "./pages/reports/SalesReport";
import ProfitReport from "./pages/reports/ProfitReport";
import InventoryValue from "./pages/reports/InventoryValue";
import DeadStock from "./pages/reports/DeadStock";
import DailyCash from "./pages/reports/DailyCash";
import { TopProducts, TopCustomers, TopSuppliers, BySeller, ByCategory } from "./pages/reports/Rankings";
import Users from "./pages/admin/Users";
import Roles from "./pages/admin/Roles";
import Branches from "./pages/admin/Branches";
import Transfers from "./pages/admin/Transfers";
import TransferCreate from "./pages/admin/TransferCreate";
import TransferDetail from "./pages/admin/TransferDetail";
import AuditLog from "./pages/admin/AuditLog";
import Invoices from "./pages/billing/Invoices";
import Ticket from "./pages/billing/Ticket";
import CompanySettings from "./pages/billing/CompanySettings";
import ImportData from "./pages/admin/ImportData";
import Backups from "./pages/admin/Backups";
import PublicCatalog from "./pages/public/PublicCatalog";
import CustomerDisplay from "./pages/pos/CustomerDisplay";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPassword from "./pages/auth/ResetPassword";
import ChangePassword from "./pages/auth/ChangePassword";

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

// `perm` opcional: si el usuario no lo tiene, ve la pantalla "Sin acceso"
// (aunque escriba la URL directo). El backend igual valida cada endpoint.
function Protected({ children, perm }) {
  const { user, loading, can } = useAuth();
  if (loading) return <div className="p-10 text-center text-slate-400">Cargando…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (perm && !can(perm)) return <Layout><NoAccess /></Layout>;
  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
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
      <Route path="/cuentas-por-pagar" element={<Protected perm="compras.ver"><Payable /></Protected>} />
      <Route path="/facturas-proveedor" element={<Protected perm="facturas_prov.ver"><SupplierBills /></Protected>} />
      <Route path="/pos" element={<Protected perm="ventas.crear"><POS /></Protected>} />
      <Route path="/ventas" element={<Protected perm="ventas.ver"><SalesList /></Protected>} />
      <Route path="/ventas/:id" element={<Protected perm="ventas.ver"><SaleDetail /></Protected>} />
      <Route path="/ventas/:id/ticket" element={<Protected perm="ventas.ver"><Ticket /></Protected>} />
      <Route path="/cuentas-por-cobrar" element={<Protected perm="ventas.ver"><Receivable /></Protected>} />
      <Route path="/caja" element={<Protected perm="caja.ver"><CashBox /></Protected>} />
      <Route path="/caja/historial" element={<Protected perm="caja.ver"><CashSessions /></Protected>} />
      <Route path="/cotizaciones" element={<Protected perm="cotizaciones.ver"><QuotationList /></Protected>} />
      <Route path="/cotizaciones/nueva" element={<Protected perm="cotizaciones.crear"><QuotationForm /></Protected>} />
      <Route path="/cotizaciones/:id" element={<Protected perm="cotizaciones.ver"><QuotationDetail /></Protected>} />
      <Route path="/devoluciones" element={<Protected perm="ventas.ver"><ReturnsList /></Protected>} />
      <Route path="/devoluciones/nueva" element={<Protected perm="ventas.crear"><ReturnCreate /></Protected>} />
      <Route path="/devoluciones/:id" element={<Protected perm="ventas.ver"><ReturnDetail /></Protected>} />
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
  );
}
