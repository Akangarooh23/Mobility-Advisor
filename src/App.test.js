import { fireEvent, render, screen } from "@testing-library/react";
import App from "./App";

test("renders the CarsWise landing page", () => {
  render(<App />);

  expect(
    screen.getByRole("button", {
      name: /quiero un vehículo/i,
    })
  ).toBeInTheDocument();
});

test("shows resume action when there is a saved questionnaire draft", () => {
  window.localStorage.setItem(
    "movilidad-advisor.questionnaireDraft.v1",
    JSON.stringify({
      step: 2,
      advancedMode: false,
      answers: { perfil: "particular", flexibilidad: "renting" },
      updatedAt: new Date().toISOString(),
    })
  );

  render(<App />);

  expect(screen.getByRole("button", { name: /continuar cuestionario/i })).toBeInTheDocument();
});

test.each([
  ["propiedad_contado", "Comprar al contado"],
  ["propiedad_financiada", "Comprar financiado"],
  ["propiedad_entrada_inicial", "Entrada inicial"],
  ["renting", "Renting"],
  ["no_tengo_claro", "No lo tengo claro"],
])("shows resume action with flexibilidad option: %s", (flexibilidadValue, flexibilidadLabel) => {
  window.localStorage.setItem(
    "movilidad-advisor.questionnaireDraft.v1",
    JSON.stringify({
      step: 2,
      advancedMode: false,
      answers: { perfil: "particular", flexibilidad: flexibilidadValue },
      updatedAt: new Date().toISOString(),
    })
  );

  render(<App />);

  expect(screen.getByRole("button", { name: /continuar cuestionario/i })).toBeInTheDocument();
});

test("opens a real registration form from the user access menu", () => {
  render(<App />);

  fireEvent.click(screen.getByRole("button", { name: /acceder/i }));
  fireEvent.click(screen.getByRole("button", { name: /registrarse/i }));

  expect(screen.getByText(/crear tu cuenta/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/correo electrónico/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/contraseña/i)).toBeInTheDocument();
});
