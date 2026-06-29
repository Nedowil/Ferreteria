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
      <Route path="/cuentas-por-cobrar" element={<Protected><Receivable /></Protected>} />
      <Route path="/caja" element={<Protected><CashBox /></Protected>} />
      <Route path="/caja/historial" element={<Protected><CashSessions /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
