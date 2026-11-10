import ExcelJS from "exceljs";
import api from "../api/client";

// Construye un libro ExcelJS con una hoja: encabezado + filas + ancho de columnas.
// columns: [{ header: "Folio", value: (row) => row.folio }]
// Se exporta aparte para poder probarlo sin tocar el DOM.
export function buildWorkbook(columns, rows, sheetName = "Datos") {
  const header = columns.map((c) => c.header);
  const body = rows.map((r) => columns.map((c) => {
    const v = c.value(r);
    return v === null || v === undefined ? "" : v;
  }));
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName);
  // Ancho de columnas aproximado al contenido.
  ws.columns = columns.map((c, i) => {
    const max = Math.max(c.header.length, ...body.map((row) => String(row[i] ?? "").length));
    return { width: Math.min(Math.max(max + 2, 8), 50) };
  });
  ws.addRow(header);
  ws.getRow(1).font = { bold: true };
  body.forEach((row) => ws.addRow(row));
  return wb;
}

// Exporta filas a un archivo .xlsx (descarga en el navegador).
export async function exportToExcel(filename, columns, rows, sheetName = "Datos") {
  const wb = buildWorkbook(columns, rows, sheetName);
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Trae TODAS las filas de un endpoint paginado (respeta los filtros dados).
// Recorre TODAS las páginas hasta juntar el total real: la API tiene un tope de
// 200 por página, así que pedir "todo" de un solo golpe dejaba registros afuera.
// Red de seguridad: aunque recorra todas las páginas, no intenta cargar más de
// esto en memoria (evita colgar el navegador con millones de filas). Para
// exportar volúmenes enormes, filtrá antes por fecha/criterio.
const FETCH_ALL_MAX = 100000;

export async function fetchAll(url, params = {}) {
  const pageSize = 200; // el máximo que permite la API
  const first = (await api.get(url, { params: { ...params, page: 1, page_size: pageSize } })).data;
  // Endpoints que no paginan (devuelven un arreglo): se devuelven tal cual.
  if (Array.isArray(first)) return first;
  const page1 = first.results || [];
  const total = Math.min(first.count ?? page1.length, FETCH_ALL_MAX);
  const pages = Math.ceil(total / pageSize);
  if (pages <= 1) return page1.slice(0, FETCH_ALL_MAX);

  // Rendimiento: las páginas 2..N se piden EN PARALELO (en tandas para no
  // saturar el servidor/navegador), en vez de una por una. Acelera mucho las
  // exportaciones grandes. Se arman en ORDEN de página al final.
  const CONCURRENCY = 6;
  const byPage = { 1: page1 };
  const pending = [];
  for (let p = 2; p <= pages; p++) pending.push(p);
  for (let i = 0; i < pending.length; i += CONCURRENCY) {
    const batch = pending.slice(i, i + CONCURRENCY);
    const datas = await Promise.all(batch.map((p) =>
      api.get(url, { params: { ...params, page: p, page_size: pageSize } })
        .then((r) => ({ p, rows: r.data.results || [] }))));
    datas.forEach(({ p, rows }) => { byPage[p] = rows; });
  }

  let rows = [];
  for (let p = 1; p <= pages && rows.length < FETCH_ALL_MAX; p++) {
    rows = rows.concat(byPage[p] || []);
  }
  if ((first.count ?? 0) > FETCH_ALL_MAX) {
    // Aviso para el desarrollador; el usuario debería filtrar por fecha.
    console.warn(`Exportación limitada a ${FETCH_ALL_MAX} filas de ${first.count}. Filtrá por fecha para exportar todo.`);
  }
  return rows.slice(0, FETCH_ALL_MAX);
}
