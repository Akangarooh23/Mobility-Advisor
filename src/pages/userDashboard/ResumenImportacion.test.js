/**
 * La importación aparece en el resumen del panel.
 *
 * Es lo más caro y lo más largo que alguien tiene abierto con nosotros —un
 * coche pedido a Alemania, con una fianza de mil euros por medio— y el resumen
 * solo hablaba del garaje y de los informes. Quien acababa de pedirlo entraba y
 * no veía ni rastro.
 */
import { render, screen } from "@testing-library/react";
import UserDashboardHome from "./UserDashboardHome";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (clave, opciones) => (opciones?.count != null ? `${clave}:${opciones.count}` : clave) }),
}));

const SOLICITUD = {
  id: "imp-1",
  type: "import",
  status: "Pendiente",
  vehicle_title: "Volkswagen Golf VI Trendline",
  meta: JSON.stringify({ deposit_quoted: 1019 }),
};

function pinta(solicitudes) {
  return render(
    <UserDashboardHome
      userSolicitudes={solicitudes}
      counts={{ vehicles: 0, valuations: 0, saved: 0, solicitudes: solicitudes.length }}
      pendingAlertNotifications={[]}
      onNavigate={() => {}}
    />
  );
}

test("sale, con la fianza que falta por pagar", () => {
  pinta([SOLICITUD]);
  expect(screen.getByText(/Importación pendiente de fianza/i)).toBeInTheDocument();
  expect(screen.getByText(/1019 €|1\.019 €/)).toBeInTheDocument();
  expect(screen.getByText(/Volkswagen Golf VI Trendline/)).toBeInTheDocument();
});

test("una vez pagada, se enseña el paso en el que está", () => {
  pinta([{ ...SOLICITUD, status: "En transporte", meta: JSON.stringify({ deposit_quoted: 1019, deposit_paid_at: "2026-08-29T19:30:00Z" }) }]);
  expect(screen.getByText(/Importación en curso: En transporte/i)).toBeInTheDocument();
  expect(screen.queryByText(/pendiente de fianza/i)).not.toBeInTheDocument();
});

test("una entregada ya no ocupa sitio en el resumen", () => {
  pinta([{ ...SOLICITUD, status: "Entregado" }]);
  expect(screen.queryByText(/Importación/i)).not.toBeInTheDocument();
});
