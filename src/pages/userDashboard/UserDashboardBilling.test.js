import { render, screen, waitFor } from "@testing-library/react";
import UserDashboardBilling from "./UserDashboardBilling";

jest.mock("../../utils/apiClient", () => ({
  getBillingAccountJson: jest.fn(async () => ({
    data: {
      ok: true,
      account: {
        profile: {
          fullName: "Usuario Demo",
          email: "demo@carswise.com",
          phone: "",
          companyName: "",
          taxId: "",
          billingAddress: "",
          iban: "",
          updatedAt: "",
        },
        billingState: {
          planId: "gratis",
          planLabel: "Plan Gratis",
          status: "inactivo",
          nextBillingDate: "",
          stripeCustomerId: "",
          invoices: [],
        },
      },
    },
  })),
  postBillingAccountJson: jest.fn(async () => ({
    data: {
      ok: true,
      account: {
        profile: {
          fullName: "Usuario Demo",
          email: "demo@carswise.com",
          phone: "",
          companyName: "",
          taxId: "",
          billingAddress: "",
          iban: "",
          updatedAt: "2026-04-12T10:00:00.000Z",
        },
      },
    },
  })),
  postBillingCheckoutJson: jest.fn(async () => ({ data: { ok: true, simulated: true, message: "Checkout preparado" } })),
  postBillingPortalJson: jest.fn(async () => ({ data: { ok: true, simulated: true, message: "Portal preparado" } })),
}));

test("renders billing section with account actions", async () => {
  render(
    <UserDashboardBilling
      panelStyle={{}}
      currentUser={{
        name: "Usuario Demo",
        email: "demo@carswise.com",
      }}
    />
  );

  expect(screen.getByText(/Perfil, suscripcion y facturas/i)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Guardar datos/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Iniciar checkout/i })).toBeInTheDocument();

  await waitFor(() => {
    expect(screen.getByDisplayValue("Usuario Demo")).toBeInTheDocument();
  });
});
