import * as XLSX from "xlsx";
import api from "../api/client";

// Exporta filas a un archivo .xlsx.
// columns: [{ header: "Folio", value: (row) => row.folio }]
export function exportToExcel(filename, columns, rows, sheetName = "Datos") {
  const header = columns.map((c) => c.header);
  const body = rows.map((r) => columns.map((c) => {
    const v = c.value(r);
    return v === null || v === undefined ? "" : v;
  }));
  const ws = XLSX.utils.aoa_to_sheet([header, ...body]);
  // Ancho de columnas aproximado al contenido.
  ws["!cols"] = columns.map((c, i) => {
    const max = Math.max(c.header.length, ...body.map((row) => String(row[i] ?? "").length));
    return { wch: Math.min(Math.max(max + 2, 8), 50) };
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}

// Trae TODAS las filas de un endpoint paginado (respeta los filtros dados).
// Recorre TODAS las páginas hasta juntar el total real: la API tiene un tope de
// 200 por página, así que pedir "todo" de un solo golpe dejaba registros afuera.
export async function fetchAll(url, params = {}) {
  const pageSize = 200; // el máximo que permite la API
  const first = (await api.get(url, { params: { ...params, page: 1, page_size: pageSize } })).data;
  // Endpoints que no paginan (devuelven un arreglo): se devuelven tal cual.
  if (Array.isArray(first)) return first;
  let rows = first.results || [];
  const total = first.count ?? rows.length;
  const pages = Math.ceil(total / pageSize);
  for (let p = 2; p <= pages; p++) {
    const { data } = await api.get(url, { params: { ...params, page: p, page_size: pageSize } });
    rows = rows.concat(data.results || []);
  }
  return rows;
}
