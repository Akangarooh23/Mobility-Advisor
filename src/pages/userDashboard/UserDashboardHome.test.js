import { fireEvent, render, screen } from "@testing-library/react";
import UserDashboardHome from "./UserDashboardHome";

test("shows an alerts inbox summary on the dashboard home", () => {
  const onNavigate = jest.fn();
  const onMarkAllAlertsSeen = jest.fn();

  render(
    <UserDashboardHome
      counts={{ saved: 3, appointments: 1, valuations: 0, vehicles: 2 }}
      sections={[]}
      panelStyle={{}}
      newAlertMatchesCount={2}
      pendingAlertNotifications={[
        {
          id: "alert-byd",
          title: "Alerta Compra · BYD · Dolphin",
          newMatchesCount: 2,
          summary: "2 coincidencias nuevas detectadas en el marketplace",
        },
      ]}
      onNavigate={onNavigate}
      onMarkAllAlertsSeen={onMarkAllAlertsSeen}
    />
  );

  expect(screen.getByText(/bandeja de avisos/i)).toBeInTheDocument();
  expect(screen.getByText(/2 coincidencias nuevas detectadas en el marketplace/i)).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /abrir alertas/i }));
  expect(onNavigate).toHaveBeenCalledWith("saved");

  fireEvent.click(screen.getByRole("button", { name: /marcar todo como revisado/i }));
  expect(onMarkAllAlertsSeen).toHaveBeenCalled();
});

test("shows an email summary action when notifications have an email recipient", () => {
  const onSendAlertEmailDigest = jest.fn();

  render(
    <UserDashboardHome
      counts={{ saved: 1, appointments: 0, valuations: 0, vehicles: 0 }}
      sections={[]}
      panelStyle={{}}
      newAlertMatchesCount={1}
      pendingAlertNotifications={[
        {
          id: "alert-toyota",
          title: "Alerta Compra · Toyota · Corolla",
          newMatchesCount: 1,
          summary: "1 coincidencia nueva detectada en el marketplace",
          email: "cliente@caradvisor.es",
          notifyByEmail: true,
        },
      ]}
      onNavigate={() => {}}
      onMarkAllAlertsSeen={() => {}}
      onSendAlertEmailDigest={onSendAlertEmailDigest}
    />
  );

  expect(screen.getAllByText(/cliente@caradvisor.es/i).length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole("button", { name: /enviar resumen por email/i }));
  expect(onSendAlertEmailDigest).toHaveBeenCalled();
});
