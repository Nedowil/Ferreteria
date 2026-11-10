import { useEffect, useState } from "react";
import { subscribeDisplay } from "../../pos/customerDisplay";

const Q = (v) => "Q" + Number(v || 0).toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function CustomerDisplay() {
  const [s, setS] = useState({ type: "idle", company: "Ferretería", items: [] });

  useEffect(() => subscribeDisplay(setS), []);

  const company = s.company || "Ferretería";
  const items = s.items || [];

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col">
      <header className="px-8 py-5 bg-slate-950 flex items-center justify-between">
        <div className="text-2xl font-bold">{company}</div>
        <div className="text-sm text-slate-400">¡Bienvenido!</div>
      </header>

      {s.type === "sale" ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-6">
          <div className="text-5xl font-bold text-green-400">¡Gracias por su compra!</div>
          <div className="text-2xl text-slate-300">Total</div>
          <div className="text-7xl font-extrabold">{Q(s.total)}</div>
          <div className="flex gap-10 text-xl text-slate-300">
            <div>Recibido: <span className="text-white">{Q(s.paid)}</span></div>
            {Number(s.change) > 0 && <div>Vuelto: <span className="text-amber-300">{Q(s.change)}</span></div>}
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="text-6xl">🛒</div>
          <div className="text-3xl text-slate-300">Estamos listos para atenderle</div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col">
          <div className="flex-1 overflow-auto px-8 py-4">
            <table className="w-full text-2xl">
              <thead className="text-slate-400 text-left text-lg border-b border-slate-700">
                <tr>
                  <th className="py-2">Producto</th>
                  <th className="py-2 text-right w-32">Cant.</th>
                  <th className="py-2 text-right w-44">Precio</th>
                  <th className="py-2 text-right w-48">Importe</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={i} className="border-b border-slate-800">
                    <td className="py-3">{it.name}</td>
                    <td className="py-3 text-right">{it.quantity}</td>
                    <td className="py-3 text-right">{Q(it.unit_price)}</td>
                    <td className="py-3 text-right">{Q(Number(it.quantity || 0) * Number(it.unit_price || 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bg-slate-950 px-8 py-6 flex items-center justify-between">
            <div className="text-3xl text-slate-300">{items.length} artículo(s)</div>
            <div className="text-right">
              <div className="text-xl text-slate-400">Total a pagar</div>
              <div className="text-7xl font-extrabold">{Q(s.total)}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
