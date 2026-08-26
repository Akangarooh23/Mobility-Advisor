import { fireEvent, render, screen } from "@testing-library/react";
import i18next from "i18next";
import UserDashboardPage from "./UserDashboardPage";

test("shows a bell shortcut in the header when there are new alert matches", () => {
  const onNavigate = jest.fn();

  render(
    <UserDashboardPage
      centerStyle={{}}
      blockBadgeStyle={{}}
      panelStyle={{}}
      userDashboardPage="home"
      savedComparisons={[]}
      marketAlerts={[]}
      marketAlertStatus={{}}
      marketAlertMatches={{}}
      newAlertMatchesCount={2}
      dashboardAppointments={[]}
      dashboardValuations={[]}
      userVehicleSections={[]}
      onNavigate={onNavigate}
      onRestart={() => {}}
      onLogout={() => {}}
      onRequestAppointment={() => {}}
      onOpenOffer={() => {}}
      onRemoveSavedComparison={() => {}}
      onCreateMarketAlert={() => {}}
      onRemoveMarketAlert={() => {}}
      onMarkAlertSeen={() => {}}
      onBrowseMarketplace={() => {}}
      getOfferBadgeStyle={() => ({})}
      formatCurrency={(value) => `${value} €`}
      getSavedComparisonHref={() => ""}
    />
  );

  fireEvent.click(
    screen.getByRole("button", {
      name: i18next.t("dashboardPage.alertsAriaLabel", { count: 2 }),
    })
  );

  // Antes llevaba a "saved": las alertas vivian dentro de Guardados. Ahora son
  // una seccion propia del panel, con su entrada en el menu y su vista, asi que
  // la campana lleva ahi. La prueba se escribio antes de esa separacion.
  expect(onNavigate).toHaveBeenCalledWith("alerts");
});
