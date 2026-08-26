import { render, screen, waitFor } from "@testing-library/react";
import i18next from "i18next";
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

  // El titulo paso de "Perfil, suscripcion y facturas" a lo que diga la clave.
  // Se pregunta por la clave para que un cambio de redaccion no rompa nada.
  expect(screen.getByText(i18next.t("dashboard.billingTitle"))).toBeInTheDocument();
  expect(screen.getByRole("button", { name: i18next.t("dashboard.billingSaveData") })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: i18next.t("dashboard.billingStartCheckout") })).toBeInTheDocument();

  await waitFor(() => {
    expect(screen.getByDisplayValue("Usuario Demo")).toBeInTheDocument();
  });
});
