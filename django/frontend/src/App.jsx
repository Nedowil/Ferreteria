import { Routes, Route, Navigate } from "react-router-dom";
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

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-10 text-center text-slate-400">Cargando…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/catalogo" element={<PublicCatalog />} />
      <Route path="/pantalla-cliente" element={<CustomerDisplay />} />
      <Route path="/" element={<Protected><Dashboard /></Protected>} />
      <Route path="/productos" element={<Protected><ProductList /></Protected>} />
      <Route path="/productos/nuevo" element={<Protected><ProductForm /></Protected>} />
      <Route path="/productos/:id/editar" element={<Protected><ProductForm /></Protected>} />
      <Route path="/productos/:id/inventario" element={<Protected><InventoryShow /></Protected>} />
      <Route path="/bajo-stock" element={<Protected><LowStock /></Protected>} />
      <Route path="/conteo" element={<Protected><StockCount /></Protected>} />
      <Route path="/categorias" element={<Protected><CatalogList kind="categories" /></Protected>} />
      <Route path="/marcas" element={<Protected><CatalogList kind="brands" /></Protected>} />
      <Route path="/unidades" element={<Protected><CatalogList kind="units" /></Protected>} />
      <Route path="/proveedores" element={<Protected><SupplierList /></Protected>} />
      <Route path="/clientes" element={<Protected><CustomerList /></Protected>} />
      <Route path="/compras" element={<Protected><PurchaseList /></Protected>} />
      <Route path="/compras/nueva" element={<Protected><PurchaseForm /></Protected>} />
      <Route path="/compras/:id" element={<Protected><PurchaseDetail /></Protected>} />
      <Route path="/cuentas-por-pagar" element={<Protected><Payable /></Protected>} />
      <Route path="/pos" element={<Protected><POS /></Protected>} />
      <Route path="/ventas" element={<Protected><SalesList /></Protected>} />
      <Route path="/ventas/:id" element={<Protected><SaleDetail /></Protected>} />
      <Route path="/ventas/:id/ticket" element={<Protected><Ticket /></Protected>} />
      <Route path="/cuentas-por-cobrar" element={<Protected><Receivable /></Protected>} />
      <Route path="/caja" element={<Protected><CashBox /></Protected>} />
      <Route path="/caja/historial" element={<Protected><CashSessions /></Protected>} />
      <Route path="/cotizaciones" element={<Protected><QuotationList /></Protected>} />
      <Route path="/cotizaciones/nueva" element={<Protected><QuotationForm /></Protected>} />
      <Route path="/cotizaciones/:id" element={<Protected><QuotationDetail /></Protected>} />
      <Route path="/devoluciones" element={<Protected><ReturnsList /></Protected>} />
      <Route path="/devoluciones/nueva" element={<Protected><ReturnCreate /></Protected>} />
      <Route path="/devoluciones/:id" element={<Protected><ReturnDetail /></Protected>} />
      <Route path="/reportes" element={<Protected><ReportsIndex /></Protected>} />
      <Route path="/reportes/ventas" element={<Protected><SalesReport /></Protected>} />
      <Route path="/reportes/utilidad" element={<Protected><ProfitReport /></Protected>} />
      <Route path="/reportes/top-productos" element={<Protected><TopProducts /></Protected>} />
      <Route path="/reportes/top-clientes" element={<Protected><TopCustomers /></Protected>} />
      <Route path="/reportes/top-proveedores" element={<Protected><TopSuppliers /></Protected>} />
      <Route path="/reportes/por-vendedor" element={<Protected><BySeller /></Protected>} />
      <Route path="/reportes/por-categoria" element={<Protected><ByCategory /></Protected>} />
      <Route path="/reportes/stock-muerto" element={<Protected><DeadStock /></Protected>} />
      <Route path="/reportes/corte-diario" element={<Protected><DailyCash /></Protected>} />
      <Route path="/reportes/valor-inventario" element={<Protected><InventoryValue /></Protected>} />
      <Route path="/admin/usuarios" element={<Protected><Users /></Protected>} />
      <Route path="/admin/roles" element={<Protected><Roles /></Protected>} />
      <Route path="/admin/sucursales" element={<Protected><Branches /></Protected>} />
      <Route path="/transferencias" element={<Protected><Transfers /></Protected>} />
      <Route path="/transferencias/nueva" element={<Protected><TransferCreate /></Protected>} />
      <Route path="/transferencias/:id" element={<Protected><TransferDetail /></Protected>} />
      <Route path="/admin/auditoria" element={<Protected><AuditLog /></Protected>} />
      <Route path="/facturas" element={<Protected><Invoices /></Protected>} />
      <Route path="/admin/empresa" element={<Protected><CompanySettings /></Protected>} />
      <Route path="/admin/importar" element={<Protected><ImportData /></Protected>} />
      <Route path="/admin/respaldos" element={<Protected><Backups /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
