import { describe, it, expect, beforeEach } from "vitest";
import { publishDisplay, subscribeDisplay } from "./customerDisplay";

describe("customerDisplay", () => {
  beforeEach(() => localStorage.clear());

  it("publishDisplay guarda el estado en localStorage", () => {
    publishDisplay({ type: "cart", company: "Ferre", items: [], total: 0 });
    const saved = JSON.parse(localStorage.getItem("fz_customer_display"));
    expect(saved.type).toBe("cart");
    expect(saved.company).toBe("Ferre");
  });

  it("subscribeDisplay entrega el estado inicial guardado", () => {
    publishDisplay({ type: "sale", company: "Ferre", total: 99 });
    let received = null;
    const unsub = subscribeDisplay((s) => { received = s; });
    expect(received).not.toBeNull();
    expect(received.type).toBe("sale");
    expect(received.total).toBe(99);
    unsub();
  });

  it("subscribeDisplay devuelve una función para desuscribir", () => {
    const unsub = subscribeDisplay(() => {});
    expect(typeof unsub).toBe("function");
    unsub();
  });
});
