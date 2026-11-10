import { describe, it, expect } from "vitest";

// Verifica que jsPDF 3.x + jspdf-autotable 5.x funcionan con el MISMO patrón que
// usa el sistema para generar PDFs (tickets, reportes, cortes de caja): importar
// dinámicamente, crear el doc, escribir texto y una tabla, y producir el binario.
// Si una actualización rompiera la API, esta prueba falla antes de llegar al POS.
describe("generación de PDF (jspdf + autotable)", () => {
  it("arma un PDF con texto y tabla y produce un binario %PDF válido", async () => {
    const { jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;
    expect(typeof autoTable).toBe("function");

    const doc = new jsPDF({ unit: "pt", format: "letter" });
    doc.setFontSize(14);
    doc.text("Movimientos de caja", 40, 40);
    autoTable(doc, {
      startY: 72,
      head: [["Hora", "Tipo", "Monto"]],
      body: [
        ["08:00", "Ingreso", "100.00"],
        ["09:30", "Egreso", "35.00"],
      ],
      styles: { fontSize: 8.5, cellPadding: 4 },
      headStyles: { fillColor: [51, 65, 85] },
      columnStyles: { 2: { halign: "right" } },
    });

    const out = doc.output("arraybuffer");
    const bytes = new Uint8Array(out);
    // Un PDF siempre empieza con "%PDF".
    const header = String.fromCharCode(...bytes.slice(0, 4));
    expect(header).toBe("%PDF");
    expect(bytes.length).toBeGreaterThan(500);
  });
});
