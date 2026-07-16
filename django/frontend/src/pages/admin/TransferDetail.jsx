import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../api/client";

const BADGE = {
  pendiente: "bg-amber-100 text-amber-700", en_transito: "bg-blue-100 text-blue-700",
  recibida: "bg-green-100 text-green-700", cancelada: "bg-slate-200 text-slate-500",
};

export default function TransferDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [t, setT] = useState(null);
  const [error, setError] = useState("");

  const load = () => { api.get(`/transfers/${id}/`).then((r) => setT(r.data)); };
  useEffect(load, [id]);

  const act = async (action) => {
    setError("");
    let body = {};
    if (action === "cancel") {
      const reason = prompt("Motivo de la cancelación:");
      if (reason === null) return;
      body = { reason };
    } else if (!confirm(`¿Confirmás ${action === "send" ? "enviar (descuenta stock de origen)" : "recibir (suma stock a destino)"}?`)) return;
    try { await api.post(`/transfers/${id}/${action}/`, body); load(); }
    catch (err) { setError(err.response?.data?.detail || "Error"); }
  };

  if (!t) return <div className="text-slate-400">Cargando…</div>;

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold">Transferencia {t.folio}
          <span className={"ml-3 text-xs px-2 py-0.5 rounded align-middle " + BADGE[t.status]}>{t.status_display}</span>
        </h1>
        <button onClick={() => navigate("/transferencias")} className="inline-flex items-center gap-1 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg px-4 py-2 shadow-sm hover:bg-slate-50 hover:border-slate-400 transition">← Volver</button>
      </div>
      {error && <div className="bg-red-600 text-white font-semibold rounded px-4 py-2 text-sm mb-4">{error}</div>}

      <section className="bg-white rounded-lg shadow p-5 text-sm grid grid-cols-2 gap-2 mb-5">
        <div><span className="text-slate-500">Origen:</span> <b>{t.from_branch_name}</b></div>
        <div><span className="text-slate-500">Destino:</span> <b>{t.to_branch_name}</b></div>
        <div><span className="text-slate-500">Creada por:</span> {t.user_name || "—"}</div>
        <div><span className="text-slate-500">Fecha:</span> {new Date(t.date).toLocaleString()}</div>
        {t.sent_at && <div><span className="text-slate-500">Enviada:</span> {new Date(t.sent_at).toLocaleString()} ({t.sent_by_name})</div>}
        {t.received_at && <div><span className="text-slate-500">Recibida:</span> {new Date(t.received_at).toLocaleString()} ({t.received_by_name})</div>}
        {t.reason_cancelled && <div className="col-span-2 text-red-600"><span className="text-slate-500">Cancelada:</span> {t.reason_cancelled}</div>}
      </section>

      <section className="bg-white rounded-lg shadow overflow-hidden mb-4">
        <div className="px-5 py-3 border-b font-semibold">Productos</div>
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left"><tr><th className="px-4 py-2">Producto</th><th className="px-4 py-2 text-right">Cantidad</th><th className="px-4 py-2 text-right">Base</th></tr></thead>
          <tbody>
            {t.items.map((it) => (
              <tr key={it.id} className="border-t">
                <td className="px-4 py-2"><span className="font-mono text-xs text-slate-400">{it.product_sku}</span> {it.product_name}</td>
                <td className="px-4 py-2 text-right">{it.quantity_input} {it.unit_label}</td>
                <td className="px-4 py-2 text-right text-slate-500">{it.quantity_base}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </section>

      <div className="flex gap-2">
        {t.status === "pendiente" && <>
          <button onClick={() => act("send")} className="bg-blue-600 text-white rounded px-5 py-2 text-sm font-medium">Enviar</button>
          <button onClick={() => act("cancel")} className="bg-white border border-red-300 text-red-600 rounded px-5 py-2 text-sm">Cancelar</button>
        </>}
        {t.status === "en_transito" && <>
          <button onClick={() => act("receive")} className="bg-green-600 text-white rounded px-5 py-2 text-sm font-medium">Recibir</button>
          <button onClick={() => act("cancel")} className="bg-white border border-red-300 text-red-600 rounded px-5 py-2 text-sm">Cancelar (devuelve stock)</button>
        </>}
      </div>
    </div>
  );
}
