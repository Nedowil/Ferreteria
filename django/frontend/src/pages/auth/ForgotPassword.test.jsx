import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

// Mockeamos el cliente axios para no tocar la red.
vi.mock("../../api/client", () => ({
  default: { post: vi.fn(() => Promise.resolve({ data: {} })) },
}));
import api from "../../api/client";
import ForgotPassword from "./ForgotPassword";

const renderPage = () =>
  render(<MemoryRouter><ForgotPassword /></MemoryRouter>);

describe("ForgotPassword", () => {
  beforeEach(() => vi.clearAllMocks());

  it("envía la solicitud y muestra confirmación sin revelar existencia", async () => {
    renderPage();
    await userEvent.type(screen.getByRole("textbox"), "u@test.com");
    await userEvent.click(screen.getByRole("button", { name: /enviar enlace/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/auth/password-reset/", { email: "u@test.com" });
    });
    expect(await screen.findByText(/recibirás un enlace/i)).toBeInTheDocument();
  });
});
