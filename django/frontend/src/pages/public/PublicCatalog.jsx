import { useEffect, useState } from "react";
import api from "../../api/client";

const Q = (v) => "Q" + Number(v || 0).toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function PublicCatalog() {
  const [info, setInfo] = useState(null);
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    api.get("/public/catalog/info/")
      .then((r) => setInfo(r.data))
      .catch(() => setUnavailable(true));
  }, []);

  const load = (q = "") => {
    setLoading(true);
    api.get("/public/catalog/", { params: q ? { search: q } : {} })
      .then((r) => setProducts(r.data.results || r.data))
      .catch(() => setUnavailable(true))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  if (unavailable) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-6">
        <div className="text-center text-slate-500">
          <div className="text-4xl mb-2">🔒</div>
          <p>El catálogo en línea no está disponible por el momento.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-slate-900 text-white">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <h1 className="text-2xl font-bold">{info?.title || "Catálogo"}</h1>
          {info?.intro && <p className="mt-1 text-slate-300 text-sm whitespace-pre-line">{info.intro}</p>}
          <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-300">
            {info?.company?.phone && <span>📞 {info.company.phone}</span>}
            {info?.company?.address && <span>📍 {info.company.address}</span>}
            {info?.whatsapp_link && (
              <a href={info.whatsapp_link} target="_blank" rel="noreferrer" className="text-green-400 hover:underline">
                💬 WhatsApp
              </a>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-6">
        <form onSubmit={(e) => { e.preventDefault(); load(search); }} className="mb-5">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar producto…"
            className="w-full sm:w-96 border border-slate-300 rounded px-4 py-2 text-sm"
          />
        </form>

        {loading ? (
          <div className="text-slate-400">Cargando…</div>
        ) : products.length === 0 ? (
          <div className="text-slate-400">No se encontraron productos.</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {products.map((p) => (
              <div key={p.id} className="bg-white rounded-lg shadow overflow-hidden flex flex-col">
                <div className="aspect-square bg-slate-100 flex items-center justify-center">
                  {p.image
                    ? <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                    : <span className="text-4xl text-slate-300">📦</span>}
                </div>
                <div className="p-3 flex-1 flex flex-col">
                  {p.brand_name && <div className="text-xs text-slate-400">{p.brand_name}</div>}
                  <div className="text-sm font-medium leading-tight">{p.name}</div>
                  {p.description && <div className="text-xs text-slate-500 mt-1 line-clamp-2">{p.description}</div>}
                  <div className="mt-auto pt-2 flex items-center justify-between">
                    {info?.show_prices && p.price != null
                      ? <span className="font-semibold text-slate-800">{Q(p.price)}</span>
                      : <span />}
                    <span className={"text-xs " + (p.in_stock ? "text-green-600" : "text-slate-400")}>
                      {p.in_stock ? "Disponible" : "Agotado"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="text-center text-xs text-slate-400 py-6">
        {info?.company?.name}
      </footer>
    </div>
  );
}
