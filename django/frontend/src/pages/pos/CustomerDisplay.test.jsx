import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import CustomerDisplay from "./CustomerDisplay";

describe("CustomerDisplay", () => {
  beforeEach(() => localStorage.clear());

  it("muestra el mensaje de bienvenida cuando el carrito está vacío", () => {
    render(<CustomerDisplay />);
    expect(screen.getByText(/listos para atenderle/i)).toBeInTheDocument();
  });

  it("muestra el total y los artículos del estado inicial", () => {
    localStorage.setItem("fz_customer_display", JSON.stringify({
      type: "cart", company: "Mi Ferretería",
      items: [{ name: "Martillo", quantity: 1, unit_price: 112 }],
      total: 112,
    }));
    render(<CustomerDisplay />);
    expect(screen.getByText("Martillo")).toBeInTheDocument();
    expect(screen.getByText("Mi Ferretería")).toBeInTheDocument();
    expect(screen.getAllByText("Q112.00").length).toBeGreaterThan(0);
  });

  it("muestra el agradecimiento al completar la venta", () => {
    localStorage.setItem("fz_customer_display", JSON.stringify({
      type: "sale", company: "Mi Ferretería", total: 50, paid: 100, change: 50,
    }));
    render(<CustomerDisplay />);
    expect(screen.getByText(/Gracias por su compra/i)).toBeInTheDocument();
  });
});
