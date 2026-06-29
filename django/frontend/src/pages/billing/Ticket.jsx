import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../../api/client";

const Q = (v) => "Q" + Number(v || 0).toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function Ticket() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [t, setT] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api.get(`/sales/${id}/ticket/`).then((r) => setT(r.data)).catch(() => setErr("No se pudo cargar el comprobante."));
  }, [id]);

  if (err) return <div className="text-red-600">{err}</div>;
  if (!t) return <div className="text-slate-400">Cargando…</div>;

  const { company, sale, fel } = t;

  const printThermal = async () => {
    try {
      const { data } = await api.post(`/sales/${id}/print/`);
      if (data.status === "sent") {
        alert("Ticket enviado a la impresora de red.");
        return;
      }
      // system/bluetooth: descarga el .bin ESC/POS para entregarlo a la impresora.
      const bytes = Uint8Array.from(atob(data.escpos_base64), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/octet-stream" }));
      const a = document.createElement("a");
      a.href = url; a.download = `ticket-${sale.folio}.escpos.bin`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(e.response?.data?.detail || "No se pudo imprimir en la térmica.");
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="flex justify-between mb-3 print:hidden">
        <button onClick={() => navigate(-1)} className="text-sm text-slate-500">← Volver</button>
        <div className="flex gap-2">
          <button onClick={printThermal} className="bg-blue-600 text-white rounded px-4 py-2 text-sm">Imprimir térmica</button>
          <button onClick={() => window.print()} className="bg-slate-700 text-white rounded px-4 py-2 text-sm">Imprimir</button>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-6 text-sm font-mono leading-tight" id="ticket">
        <div className="text-center mb-3">
          <div className="font-bold text-base">{company.name}</div>
          {company.legal_name && <div>{company.legal_name}</div>}
          <div>NIT: {company.tax_id}</div>
          {company.address && <div>{company.address}</div>}
          {company.phone && <div>Tel: {company.phone}</div>}
        </div>

        <div className="border-t border-dashed border-slate-400 my-2" />
        <div className="flex justify-between"><span>Folio:</span><span>{sale.folio}</span></div>
        <div className="flex justify-between"><span>Fecha:</span><span>{new Date(sale.date).toLocaleString()}</span></div>
        <div className="flex justify-between"><span>Cliente:</span><span>{sale.customer}</span></div>
        <div className="flex justify-between"><span>NIT:</span><span>{sale.customer_nit}</span></div>

        <div className="border-t border-dashed border-slate-400 my-2" />
        {sale.items.map((it, idx) => (
          <div key={idx} className="mb-1">
            <div>{it.name}{it.unit_label ? ` (${it.unit_label})` : ""}</div>
            <div className="flex justify-between text-slate-600">
              <span>{it.qty} x {Q(it.unit_price)}</span>
              <span>{Q(it.subtotal)}</span>
            </div>
          </div>
        ))}

        <div className="border-t border-dashed border-slate-400 my-2" />
        <div className="flex justify-between"><span>Subtotal:</span><span>{Q(sale.subtotal)}</span></div>
        {Number(sale.discount) > 0 && <div className="flex justify-between"><span>Descuento:</span><span>−{Q(sale.discount)}</span></div>}
        <div className="flex justify-between"><span>IVA:</span><span>{Q(sale.tax)}</span></div>
        <div className="flex justify-between font-bold text-base"><span>TOTAL:</span><span>{Q(sale.total)}</span></div>
        <div className="flex justify-between"><span>Recibido:</span><span>{Q(sale.paid)}</span></div>
        {Number(sale.change) > 0 && <div className="flex justify-between"><span>Vuelto:</span><span>{Q(sale.change)}</span></div>}

        {fel && (
          <>
            <div className="border-t border-dashed border-slate-400 my-2" />
            <div className="text-center text-xs">
              <div className="font-bold">FACTURA ELECTRÓNICA EN LÍNEA (FEL)</div>
              <div>Autorización: {fel.uuid}</div>
              <div>Serie: {fel.serie}  Número: {fel.numero}</div>
              <div>Certificador: {fel.certificador}</div>
              {fel.fecha_certificacion && <div>{new Date(fel.fecha_certificacion).toLocaleString()}</div>}
              {fel.status === "anulada" && <div className="text-red-600 font-bold">** ANULADA **</div>}
            </div>
          </>
        )}

        <div className="text-center mt-3 text-xs">¡Gracias por su compra!</div>
      </div>
    </div>
  );
}
