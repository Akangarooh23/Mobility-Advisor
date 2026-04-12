import { fireEvent, render, screen } from "@testing-library/react";
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

  fireEvent.click(screen.getByRole("button", { name: /2 novedades en alertas/i }));

  expect(onNavigate).toHaveBeenCalledWith("saved");
});
