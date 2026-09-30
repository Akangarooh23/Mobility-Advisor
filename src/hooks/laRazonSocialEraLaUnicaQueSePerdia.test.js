/**
 * El diálogo de acceso, y el único campo que no sobrevivía a reabrirlo.
 *
 * ## Qué había
 *
 * Siete `useState` en `App`, más `useAuthDialogControls` —que recibía nueve
 * `set…` para poder abrir y cerrar—, más seis `onChange` idénticos en el JSX,
 * más seis comprobaciones en fila dentro de la función que lo envía. Nada
 * probado.
 *
 * ## Lo que se veía
 *
 * `authForm` tiene **seis** claves y se vaciaba de cuatro maneras: con seis al
 * arrancar, con **cinco** al abrir el diálogo, con **cinco** al cerrarlo y con
 * **tres** al salir de la cuenta.
 *
 * Al abrir en modo registro se conservan a propósito el nombre, los apellidos y
 * el teléfono ya escritos, para no hacerlos teclear otra vez. `company_name` no
 * estaba en esa lista: era **el único campo que se perdía al reabrir**. Quien
 * rellenaba el registro de una empresa perdía la razón social y conservaba el
 * teléfono, sin ningún motivo.
 *
 * Y las claves que faltaban quedaban en `undefined`, que es lo que convierte un
 * campo controlado en no controlado a mitad de vida.
 */

import { renderHook, act } from "@testing-library/react";
import {
  useElDialogoDeAcceso,
  queFaltaParaEntrar,
  FORMULARIO_DE_ACCESO_VACIO,
  PARTICULAR,
  EMPRESA,
} from "./useElDialogoDeAcceso";

const LAS_SEIS = ["name", "apellidos", "phone", "email", "password", "company_name"];

/** Lo que alguien ha escrito rellenando el registro de una empresa. */
function rellenaComoEmpresa(result) {
  act(() => result.current.eligeTipoDeCliente(EMPRESA));
  act(() => result.current.escribe("company_name", "Kangaroo SL"));
  act(() => result.current.escribe("phone", "600111222"));
  act(() => result.current.escribe("email", "ana@popcar.es"));
  act(() => result.current.escribe("password", "secreta123"));
}

describe("la razón social era la única que se perdía", () => {
  test("al reabrir en registro se conserva, como el teléfono", () => {
    const { result } = renderHook(() => useElDialogoDeAcceso({}));

    act(() => result.current.openAuthDialog("register"));
    rellenaComoEmpresa(result);

    act(() => result.current.openAuthDialog("register"));

    expect(result.current.authForm.company_name).toBe("Kangaroo SL");
    expect(result.current.authForm.phone).toBe("600111222");
  });

  test("pero la contraseña nunca se conserva", () => {
    // Es lo único que no se vuelve a proponer, y con razón.
    const { result } = renderHook(() => useElDialogoDeAcceso({}));

    act(() => result.current.openAuthDialog("register"));
    rellenaComoEmpresa(result);

    act(() => result.current.openAuthDialog("register"));

    expect(result.current.authForm.password).toBe("");
  });

  test("y al abrir en modo entrar no se conserva nada de lo del registro", () => {
    /*
     * Quien va a entrar no necesita su razón social en pantalla, y dejarla haría
     * que el paquete la mandara en un login.
     */
    const { result } = renderHook(() => useElDialogoDeAcceso({}));

    act(() => result.current.openAuthDialog("register"));
    rellenaComoEmpresa(result);

    act(() => result.current.openAuthDialog("login"));

    expect(result.current.authForm.company_name).toBe("");
    expect(result.current.authForm.name).toBe("");
    expect(result.current.authForm.apellidos).toBe("");
    expect(result.current.authForm.phone).toBe("");
    // El correo sí: es lo que se propone.
    expect(result.current.authForm.email).toBe("ana@popcar.es");
  });
});

describe("el formulario tiene siempre sus seis claves", () => {
  test("al arrancar", () => {
    const { result } = renderHook(() => useElDialogoDeAcceso({}));
    expect(Object.keys(result.current.authForm).sort()).toEqual([...LAS_SEIS].sort());
  });

  test("al abrir el diálogo", () => {
    const { result } = renderHook(() => useElDialogoDeAcceso({}));
    act(() => result.current.openAuthDialog("register"));
    expect(Object.keys(result.current.authForm).sort()).toEqual([...LAS_SEIS].sort());
  });

  test("al cerrarlo", () => {
    const { result } = renderHook(() => useElDialogoDeAcceso({}));
    act(() => result.current.openAuthDialog("register"));
    act(() => result.current.closeAuthDialog());
    expect(Object.keys(result.current.authForm).sort()).toEqual([...LAS_SEIS].sort());
  });

  test("y al salir de la cuenta", () => {
    /*
     * Aquí se escribían TRES de las seis, así que apellidos, teléfono y razón
     * social quedaban en `undefined` después de cada salida.
     */
    const { result } = renderHook(() => useElDialogoDeAcceso({}));
    rellenaComoEmpresa(result);

    act(() => result.current.olvidaTodo());

    expect(result.current.authForm).toEqual(FORMULARIO_DE_ACCESO_VACIO);
  });

  test("y ninguna clave queda en undefined nunca", () => {
    // Un `value={undefined}` descontrola el campo.
    const { result } = renderHook(() => useElDialogoDeAcceso({}));

    for (const paso of [
      () => result.current.openAuthDialog("register"),
      () => result.current.eligeTipoDeCliente(EMPRESA),
      () => result.current.eligeTipoDeCliente(PARTICULAR),
      () => result.current.closeAuthDialog(),
      () => result.current.openAuthDialog("login"),
      () => result.current.olvidaTodo(),
    ]) {
      act(paso);
      for (const clave of LAS_SEIS) {
        expect(result.current.authForm[clave]).not.toBeUndefined();
      }
    }
  });
});

describe("particular o empresa", () => {
  test("al pasar a empresa se borran nombre y apellidos", () => {
    /*
     * Si no se borraran, el paquete los mandaría igual: los lee del formulario y
     * no mira el tipo de cliente.
     */
    const { result } = renderHook(() => useElDialogoDeAcceso({}));

    act(() => result.current.escribe("name", "Ana"));
    act(() => result.current.escribe("apellidos", "Picazo"));
    act(() => result.current.eligeTipoDeCliente(EMPRESA));

    expect(result.current.clientType).toBe(EMPRESA);
    expect(result.current.authForm.name).toBe("");
    expect(result.current.authForm.apellidos).toBe("");
  });

  test("y al volver a particular se borra la razón social", () => {
    const { result } = renderHook(() => useElDialogoDeAcceso({}));

    act(() => result.current.eligeTipoDeCliente(EMPRESA));
    act(() => result.current.escribe("company_name", "Kangaroo SL"));
    act(() => result.current.eligeTipoDeCliente(PARTICULAR));

    expect(result.current.clientType).toBe(PARTICULAR);
    expect(result.current.authForm.company_name).toBe("");
  });

  test("y el correo y el teléfono sobreviven al cambio, que valen para los dos", () => {
    const { result } = renderHook(() => useElDialogoDeAcceso({}));

    act(() => result.current.escribe("email", "ana@popcar.es"));
    act(() => result.current.escribe("phone", "600111222"));
    act(() => result.current.eligeTipoDeCliente(EMPRESA));

    expect(result.current.authForm.email).toBe("ana@popcar.es");
    expect(result.current.authForm.phone).toBe("600111222");
  });

  test("y cualquier cosa que no sea «business» es particular", () => {
    // Llega de un `onClick` del JSX, y más vale que no haya un tercer tipo.
    const { result } = renderHook(() => useElDialogoDeAcceso({}));

    act(() => result.current.eligeTipoDeCliente("cualquier-cosa"));

    expect(result.current.clientType).toBe(PARTICULAR);
  });
});

describe("las seis comprobaciones del registro", () => {
  const COMPLETO = {
    modo: "register",
    tipoDeCliente: PARTICULAR,
    name: "Ana",
    apellidos: "Picazo",
    phone: "600111222",
    email: "ana@popcar.es",
    password: "secreta123",
  };

  test("con todo puesto no falta nada", () => {
    expect(queFaltaParaEntrar(COMPLETO)).toBeNull();
  });

  test("una empresa necesita razón social y no nombre", () => {
    const empresa = { ...COMPLETO, tipoDeCliente: EMPRESA, name: "", apellidos: "" };

    expect(queFaltaParaEntrar(empresa)).toBe("Indica la razón social de tu empresa.");
    expect(queFaltaParaEntrar({ ...empresa, companyName: "Kangaroo SL" })).toBeNull();
  });

  test("y un particular necesita nombre y apellidos, no razón social", () => {
    expect(queFaltaParaEntrar({ ...COMPLETO, name: "" }))
      .toBe("Indica tu nombre para crear la cuenta.");
    expect(queFaltaParaEntrar({ ...COMPLETO, apellidos: "" }))
      .toBe("Indica tus apellidos para crear la cuenta.");
  });

  test("el teléfono hace falta en los dos tipos", () => {
    expect(queFaltaParaEntrar({ ...COMPLETO, phone: "" }))
      .toBe("Indica tu número de teléfono para crear la cuenta.");
    expect(queFaltaParaEntrar({ ...COMPLETO, tipoDeCliente: EMPRESA, companyName: "Kangaroo SL", phone: "" }))
      .toBe("Indica tu número de teléfono para crear la cuenta.");
  });

  test("y para entrar solo hacen falta correo y contraseña", () => {
    /*
     * Es lo que separa los dos modos: entrando no se piden ni nombre ni
     * teléfono ni razón social, aunque estén vacíos.
     */
    const entrando = { modo: "login", tipoDeCliente: PARTICULAR, email: "ana@popcar.es", password: "x" };

    expect(queFaltaParaEntrar(entrando)).toBeNull();
    expect(queFaltaParaEntrar({ ...entrando, email: "" })).toBe("Indica tu correo electrónico.");
    expect(queFaltaParaEntrar({ ...entrando, password: "" })).toBe("Indica tu contraseña.");
  });

  test("y no se cae sin nada", () => {
    // Se llama desde un manejador de formulario.
    expect(queFaltaParaEntrar()).toBe("Indica tu correo electrónico.");
  });

  test("lo que NO comprueba: que la contraseña llegue a seis caracteres", () => {
    /*
     * El servidor sí lo exige (api/auth.js) y el marcador del campo lo dice,
     * pero aquí no se mira: se manda, se rechaza y se enseña su mensaje. Queda
     * probado como está para que si alguien lo añade sea a propósito.
     */
    expect(queFaltaParaEntrar({ ...COMPLETO, password: "abc" })).toBeNull();
  });
});

describe("abrir y cerrar", () => {
  test("abrir deja el diálogo en su modo y sin avisos", () => {
    const { result } = renderHook(() => useElDialogoDeAcceso({}));

    act(() => result.current.setAuthError("algo pasó antes"));
    act(() => result.current.openAuthDialog("register"));

    expect(result.current.authDialogMode).toBe("register");
    expect(result.current.authError).toBe("");
  });

  test("y cualquier modo que no sea «register» abre para entrar", () => {
    const { result } = renderHook(() => useElDialogoDeAcceso({}));

    act(() => result.current.openAuthDialog());
    expect(result.current.authDialogMode).toBe("login");

    act(() => result.current.openAuthDialog("cualquier-cosa"));
    expect(result.current.authDialogMode).toBe("login");
  });

  test("abrir guarda a dónde se va después", () => {
    const { result } = renderHook(() => useElDialogoDeAcceso({}));

    act(() => result.current.openAuthDialog("login", { routePage: "misCoches", entryMode: "portalVo" }));

    expect(result.current.authTargetPage).toBe("misCoches");
    expect(result.current.authTargetEntryMode).toBe("portalVo");
  });

  test("y sin decir nada, se va a la portada", () => {
    const { result } = renderHook(() => useElDialogoDeAcceso({}));

    act(() => result.current.openAuthDialog("login", { routePage: "misCoches" }));
    act(() => result.current.openAuthDialog("login"));

    expect(result.current.authTargetPage).toBe("home");
    expect(result.current.authTargetEntryMode).toBe("");
  });

  test("cerrar deja de pedir el destino y de estar enviando", () => {
    const { result } = renderHook(() => useElDialogoDeAcceso({}));

    act(() => result.current.openAuthDialog("login", { entryMode: "portalVo" }));
    act(() => result.current.setAuthLoading(true));
    act(() => result.current.closeAuthDialog());

    expect(result.current.authDialogMode).toBe("");
    expect(result.current.authTargetEntryMode).toBe("");
    expect(result.current.authLoading).toBe(false);
    expect(result.current.authError).toBe("");
  });

  test("y avisa a los de fuera de lo que no es suyo", () => {
    /*
     * El menú de cuenta, el panel, el plan a medias y la recuperación son de
     * otros grupos. El diálogo no los toca: se lo pide a quien los tiene.
     */
    const menus = jest.fn();
    const plan = jest.fn();
    const recuperacion = jest.fn();
    const { result } = renderHook(() => useElDialogoDeAcceso({
      cierraLosMenus: menus,
      olvidaElPlanPendiente: plan,
      vuelveAlAcceso: recuperacion,
    }));

    act(() => result.current.openAuthDialog("login"));
    expect(menus).toHaveBeenCalled();
    expect(recuperacion).toHaveBeenCalled();
    expect(plan).not.toHaveBeenCalled();   // abrir no tira el plan pendiente

    act(() => result.current.closeAuthDialog());
    expect(plan).toHaveBeenCalled();
  });

  test("y funciona sin que nadie le dé esas funciones", () => {
    // Se usa en las pruebas y no debe caerse por eso.
    const { result } = renderHook(() => useElDialogoDeAcceso());
    expect(() => act(() => result.current.openAuthDialog("login"))).not.toThrow();
    expect(() => act(() => result.current.closeAuthDialog())).not.toThrow();
  });
});

describe("el enlace de «no tengo cuenta»", () => {
  test("va y vuelve", () => {
    const { result } = renderHook(() => useElDialogoDeAcceso({}));

    act(() => result.current.openAuthDialog("login"));
    act(() => result.current.alternaEntreEntrarYRegistrarse());
    expect(result.current.authDialogMode).toBe("register");

    act(() => result.current.alternaEntreEntrarYRegistrarse());
    expect(result.current.authDialogMode).toBe("login");
  });

  test("y se lleva el aviso de antes", () => {
    /*
     * «Indica tus apellidos» no significa nada una vez que se está entrando en
     * vez de registrándose.
     */
    const { result } = renderHook(() => useElDialogoDeAcceso({}));

    act(() => result.current.openAuthDialog("register"));
    act(() => result.current.setAuthError("Indica tus apellidos para crear la cuenta."));
    act(() => result.current.alternaEntreEntrarYRegistrarse());

    expect(result.current.authError).toBe("");
  });
});

describe("el correo que se propone", () => {
  test("es el de quien ya entró", () => {
    const { result } = renderHook(() => useElDialogoDeAcceso({ currentUserEmail: "ana@popcar.es" }));

    act(() => result.current.openAuthDialog("login"));

    expect(result.current.authForm.email).toBe("ana@popcar.es");
  });

  test("y si no hay nadie, el último que se escribió", () => {
    const { result } = renderHook(() => useElDialogoDeAcceso({}));

    act(() => result.current.escribe("email", "otra@popcar.es"));
    act(() => result.current.closeAuthDialog());

    expect(result.current.authForm.email).toBe("otra@popcar.es");
  });
});
