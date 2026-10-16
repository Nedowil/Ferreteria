import { useParams } from "react-router-dom";
import SaleDetailView from "./SaleDetailView";

// Página del detalle de venta (ruta /ventas/:id). El contenido vive en
// SaleDetailView, que también se reutiliza en el modal flotante de la lista.
export default function SaleDetail() {
  const { id } = useParams();
  return (
    <div className="max-w-4xl">
      <SaleDetailView id={id} />
    </div>
  );
}
