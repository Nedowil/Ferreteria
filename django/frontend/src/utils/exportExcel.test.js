import { describe, it, expect, vi, beforeEach } from "vitest";
import ExcelJS from "exceljs";
import { buildWorkbook, exportToExcel } from "./exportExcel";

const columns = [
  { header: "Folio", value: (r) => r.folio },
  { header: "Total", value: (r) => r.total },
  { header: "Cliente", value: (r) => r.cliente },
];
const rows = [
  { folio: "V-001", total: 150.5, cliente: "Juan" },
  { folio: "V-002", total: 0, cliente: null }, // null → celda vacía
];

describe("buildWorkbook", () => {
  it("arma la hoja con encabezado y filas, y se puede releer como .xlsx", async () => {
    const wb = buildWorkbook(columns, rows, "Ventas");
    const buffer = await wb.xlsx.writeBuffer();

    // Relectura: el buffer es un .xlsx válido con los datos correctos.
    const wb2 = new ExcelJS.Workbook();
    await wb2.xlsx.load(buffer);
    const ws = wb2.getWorksheet("Ventas");
    expect(ws).toBeTruthy();
    // Encabezado.
    expect(ws.getRow(1).getCell(1).value).toBe("Folio");
    expect(ws.getRow(1).getCell(2).value).toBe("Total");
    expect(ws.getRow(1).getCell(1).font?.bold).toBe(true);
    // Primera fila de datos (el número se conserva como número).
    expect(ws.getRow(2).getCell(1).value).toBe("V-001");
    expect(ws.getRow(2).getCell(2).value).toBe(150.5);
    expect(ws.getRow(2).getCell(3).value).toBe("Juan");
    // Segunda fila: el null se exporta como celda vacía (no "null").
    const c = ws.getRow(3).getCell(3).value;
    expect(c === null || c === "" || c === undefined).toBe(true);
  });

  it("respeta el nombre de hoja por defecto 'Datos'", async () => {
    const wb = buildWorkbook(columns, rows);
    const buffer = await wb.xlsx.writeBuffer();
    const wb2 = new ExcelJS.Workbook();
    await wb2.xlsx.load(buffer);
    expect(wb2.getWorksheet("Datos")).toBeTruthy();
  });
});

describe("exportToExcel", () => {
  beforeEach(() => {
    // jsdom no implementa createObjectURL: lo mockeamos para probar la descarga.
    globalThis.URL.createObjectURL = vi.fn(() => "blob:fake");
    globalThis.URL.revokeObjectURL = vi.fn();
  });

  it("dispara la descarga de un .xlsx sin lanzar", async () => {
    const clicked = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    await exportToExcel("reporte", columns, rows);
    expect(clicked).toHaveBeenCalledTimes(1);
    clicked.mockRestore();
  });
});
