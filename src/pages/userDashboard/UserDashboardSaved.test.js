import { fireEvent, render, screen } from "@testing-library/react";
import UserDashboardSaved from "./UserDashboardSaved";

test("shows a market alerts section inside saved offers", () => {
  render(
    <UserDashboardSaved
      savedComparisons={[]}
      panelStyle={{}}
      getOfferBadgeStyle={() => ({})}
      formatCurrency={(value) => `${value} €`}
      getSavedComparisonHref={() => ""}
      onOpenOffer={() => {}}
      onRemoveSavedComparison={() => {}}
    />
  );

  expect(screen.getByText(/alertas de mercado/i)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /añadir alerta/i })).toBeInTheDocument();
});

test("shows marketplace matches for an active alert", () => {
  render(
    <UserDashboardSaved
      savedComparisons={[]}
      marketAlerts={[
        {
          id: "alert-toyota",
          title: "Alerta Compra · Toyota · Corolla",
          createdAt: "11/04/2026, 12:00",
          status: "Vigilando mercado",
          modeLabel: "Compra",
          brand: "Toyota",
          model: "Corolla",
        },
      ]}
      marketAlertMatches={{
        "alert-toyota": {
          count: 1,
          matches: [
            {
              id: "vo-001",
              title: "Toyota Corolla 120H Active Tech",
              price: 21990,
              location: "Madrid",
              mileage: 34800,
            },
          ],
        },
      }}
      panelStyle={{}}
      getOfferBadgeStyle={() => ({})}
      formatCurrency={(value) => `${value} €`}
      getSavedComparisonHref={() => ""}
      onOpenOffer={() => {}}
      onRemoveSavedComparison={() => {}}
      onRemoveMarketAlert={() => {}}
    />
  );

  expect(screen.getByText(/1 coincidencia ahora/i)).toBeInTheDocument();
  expect(screen.getByText(/Toyota Corolla 120H Active Tech/i)).toBeInTheDocument();
});

test("opens concrete marketplace offer detail when clicking a match", () => {
  const onOpenMarketplaceOffer = jest.fn();

  render(
    <UserDashboardSaved
      savedComparisons={[]}
      marketAlerts={[
        {
          id: "alert-toyota",
          title: "Alerta Compra · Toyota · Corolla",
          createdAt: "11/04/2026, 12:00",
          status: "Vigilando mercado",
          modeLabel: "Compra",
          brand: "Toyota",
          model: "Corolla",
        },
      ]}
      marketAlertMatches={{
        "alert-toyota": {
          count: 1,
          matches: [
            {
              id: "vo-001",
              title: "Toyota Corolla 120H Active Tech",
              price: 21990,
              location: "Madrid",
              mileage: 34800,
            },
          ],
        },
      }}
      panelStyle={{}}
      getOfferBadgeStyle={() => ({})}
      formatCurrency={(value) => `${value} €`}
      getSavedComparisonHref={() => ""}
      onOpenOffer={() => {}}
      onOpenMarketplaceOffer={onOpenMarketplaceOffer}
      onRemoveSavedComparison={() => {}}
      onRemoveMarketAlert={() => {}}
      onMarkAlertSeen={() => {}}
    />
  );

  fireEvent.click(screen.getByRole("button", { name: /ver oferta/i }));

  expect(onOpenMarketplaceOffer).toHaveBeenCalledWith(expect.objectContaining({ id: "vo-001" }));
});

test("shows a new matches badge when an alert has unseen offers", () => {
  render(
    <UserDashboardSaved
      savedComparisons={[]}
      marketAlerts={[
        {
          id: "alert-byd",
          title: "Alerta Compra · BYD · Dolphin",
          createdAt: "11/04/2026, 13:00",
          status: "Vigilando mercado",
          modeLabel: "Compra",
          brand: "BYD",
          model: "Dolphin",
        },
      ]}
      marketAlertMatches={{
        "alert-byd": {
          count: 2,
          matches: [],
        },
      }}
      marketAlertStatus={{
        "alert-byd": {
          seenCount: 1,
        },
      }}
      panelStyle={{}}
      getOfferBadgeStyle={() => ({})}
      formatCurrency={(value) => `${value} €`}
      getSavedComparisonHref={() => ""}
      onOpenOffer={() => {}}
      onRemoveSavedComparison={() => {}}
      onRemoveMarketAlert={() => {}}
      onMarkAlertSeen={() => {}}
    />
  );

  expect(screen.getByText(/1 novedad pendiente/i)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /marcar como revisada/i })).toBeInTheDocument();
});

test("shows the email digest button directly in saved alerts", () => {
  render(
    <UserDashboardSaved
      savedComparisons={[]}
      marketAlerts={[
        {
          id: "alert-email",
          title: "Alerta Compra · Toyota · Corolla",
          createdAt: "11/04/2026, 13:30",
          status: "Vigilando mercado",
          modeLabel: "Compra",
          brand: "Toyota",
          model: "Corolla",
          notifyByEmail: true,
          email: "cliente@caradvisor.es",
        },
      ]}
      panelStyle={{}}
      getOfferBadgeStyle={() => ({})}
      formatCurrency={(value) => `${value} €`}
      getSavedComparisonHref={() => ""}
      onOpenOffer={() => {}}
      onRemoveSavedComparison={() => {}}
      onRemoveMarketAlert={() => {}}
      onSendAlertEmailDigest={() => {}}
    />
  );

  expect(screen.getByRole("button", { name: /enviar resumen por email/i })).toBeInTheDocument();
});

test("uses the login email as the default recipient for new alerts", () => {
  render(
    <UserDashboardSaved
      savedComparisons={[]}
      currentUserEmail="cliente@caradvisor.es"
      panelStyle={{}}
      getOfferBadgeStyle={() => ({})}
      formatCurrency={(value) => `${value} €`}
      getSavedComparisonHref={() => ""}
      onOpenOffer={() => {}}
      onRemoveSavedComparison={() => {}}
    />
  );

  fireEvent.click(screen.getByRole("button", { name: /añadir alerta/i }));
  fireEvent.click(screen.getByRole("checkbox", { name: /enviarme también un resumen por email/i }));

  expect(screen.getByDisplayValue("cliente@caradvisor.es")).toBeInTheDocument();
});
