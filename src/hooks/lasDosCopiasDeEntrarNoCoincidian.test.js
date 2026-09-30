/**
 * Recuperar la cuenta, y las dos copias de «ya estás dentro» que no coincidían.
 *
 * ## Qué había
 *
 * El bloque que se ejecuta cuando alguien acaba de entrar —guardar quién es,
 * llevarle a donde iba, cerrar el diálogo, contarlo, arrancar el plan que dejó a
 * medias— estaba escrito **dos veces**, unas cincuenta líneas cada copia: una al
 * entrar o registrarse y otra al terminar de recuperar la contraseña.
 *
 * Y no coincidían:
 *
 *   · **la copia de recuperación no tenía la rama de «quédate donde estás»**.
 *     Al entrar, si estabas en una página pública —la ficha de un coche, el
 *     mercado— te quedas ahí. Recuperando la contraseña no: caías en la rama
 *     siguiente y acababas en el panel, lejos del coche que estabas mirando;
 *   · **no llamaba a `trackFunnelEvent`**, así que un acceso hecho por
 *     recuperación no se contaba en ninguna parte: el embudo contaba de menos y
 *     nadie podía saberlo mirando los números;
 *   · y las dos vaciaban `authForm` con distinta forma —tres claves una, cinco
 *     la otra— cuando el estado tiene **seis**.
 *
 * Se unificaron a la versión de entrar, que es la que llevaba los comentarios
 * que explican cada rama y por tanto la que alguien mantuvo.
 *
 * ## Y el trío escrito cinco veces
 *
 * Volver al acceso normal —`paso`, `código` y `aviso` a cero— estaba escrito
 * **cinco veces en tres ficheros**: dos en `useAuthDialogControls`, una en
 * `useAuthSessionReset` y dos en el JSX. Cinco copias de un reinicio de tres
 * estados es donde alguien añade un cuarto y lo pone en cuatro sitios.
 *
 * Al unificar las dos copias de «ya estás dentro» se vio que el reinicio de la
 * recuperación estaba **solo en la copia de recuperación**: unificando a la otra
 * se habría quedado en «confirm» hasta la siguiente vez que se abriera el
 * diálogo. Está en `yaEstaDentro`, y se prueba aquí que existe.
 */

import { renderHook, act } from "@testing-library/react";
import fs from "fs";
import path from "path";
import {
  useLaRecuperacionDeLaCuenta,
  EL_ACCESO_NORMAL,
  PEDIR_EL_CODIGO,
  ESCRIBIR_EL_CODIGO,
} from "./useLaRecuperacionDeLaCuenta";

const APP = fs
  .readFileSync(path.join(__dirname, "..", "App.js"), "utf8")
  .replace(/\r\n/g, "\n");

/** Lo que hace `yaEstaDentro`, que es la copia única. */
const YA_ESTA_DENTRO = APP.slice(
  APP.indexOf("const yaEstaDentro = useCallback"),
  APP.indexOf("const submitAuthForm = useCallback")
);

describe("ya estás dentro: una sola copia", () => {
  test("la función existe y las dos ramas la llaman", () => {
    // Una llamada por camino: entrar/registrarse, y recuperar la contraseña.
    const llamadas = APP.split("yaEstaDentro(nextUser, {").length - 1;
    expect(llamadas).toBe(2);
  });

  test("y distingue de dónde viene", () => {
    expect(APP).toContain('motivo: "recuperacion"');
    expect(APP).toContain("motivo: mode,");
  });

  test("tiene la rama de «quédate donde estás», que le faltaba a una", () => {
    /*
     * Es la que hace que quien recupera la contraseña mirando un coche vuelva al
     * coche, y no al panel.
     */
    expect(YA_ESTA_DENTRO).toContain('entryMode !== "userDashboard"');
  });

  test("cuenta el acceso, que la otra no contaba", () => {
    expect(YA_ESTA_DENTRO).toContain("trackFunnelEvent");
  });

  test("y cierra la recuperación, que solo estaba en la otra", () => {
    /*
     * Sin esto, recuperar la contraseña dejaba el paso en «confirm» hasta que
     * otro de los cinco reinicios lo limpiaba al abrir el diálogo.
     */
    expect(YA_ESTA_DENTRO).toContain("vuelveAlAcceso()");
  });

  test("y vacía el formulario con sus seis claves, no con tres ni con cinco", () => {
    // Las que falten quedan en `undefined`, y eso descontrola un campo.
    expect(YA_ESTA_DENTRO).toContain("...FORMULARIO_DE_ACCESO_VACIO");

    // La forma vive con el diálogo, que es quien la usa en casi todos los sitios.
    const DIALOGO = fs.readFileSync(path.join(__dirname, "useElDialogoDeAcceso.js"), "utf8");
    expect(DIALOGO).toMatch(/export const FORMULARIO_DE_ACCESO_VACIO = \{/);

    const forma = DIALOGO.slice(
      DIALOGO.indexOf("export const FORMULARIO_DE_ACCESO_VACIO = {"),
      DIALOGO.indexOf("export const PARTICULAR")
    );
    for (const clave of ["name", "apellidos", "phone", "email", "password", "company_name"]) {
      expect(forma).toContain(`${clave}: ""`);
    }
  });

  test("y nadie escribe un formulario vacío a mano, en ningún fichero", () => {
    /*
     * Eran CUATRO formas distintas -seis claves al arrancar, cinco al abrir el
     * diálogo, cinco al cerrarlo y tres al salir de la cuenta- y las tres
     * incompletas dejaban claves en `undefined`.
     *
     * La primera versión de esta prueba solo miraba `App.js`, y por eso no vio
     * que `useAuthSessionReset` seguía con la de tres claves. Ahora se barre
     * `App.js` y todos los hooks: cualquier `setAuthForm({` con un objeto
     * literal escrito a mano salta, y la forma buena se escribe extendiendo la
     * constante.
     */
    const aBarrer = [
      path.join(__dirname, "..", "App.js"),
      ...fs.readdirSync(__dirname)
        .filter((n) => n.endsWith(".js") && !n.endsWith(".test.js"))
        .map((n) => path.join(__dirname, n)),
    ];

    const culpables = [];

    for (const fichero of aBarrer) {
      const fuente = fs.readFileSync(fichero, "utf8");
      // `setAuthForm({ name: ...` — un literal a mano. Con `...` de la constante
      // o con `(prev) =>` no es uno.
      for (const [linea] of fuente.matchAll(/setAuthForm\(\{\s*[a-z]/gi)) {
        culpables.push(`${path.basename(fichero)}: ${linea.trim()}`);
      }
    }

    expect(culpables).toEqual([]);
  });

  test("y la forma buena se usa extendiéndola, no copiándola", () => {
    const DIALOGO = fs.readFileSync(path.join(__dirname, "useElDialogoDeAcceso.js"), "utf8");
    // Al abrir, al cerrar y al salir de la cuenta.
    expect(DIALOGO.split("FORMULARIO_DE_ACCESO_VACIO").length - 1).toBeGreaterThanOrEqual(4);
  });
});

describe("los tres sitios donde se puede estar", () => {
  test("se empieza en el acceso normal", () => {
    const { result } = renderHook(() => useLaRecuperacionDeLaCuenta());

    expect(result.current.paso).toBe(EL_ACCESO_NORMAL);
    expect(result.current.enElAccesoNormal).toBe(true);
    expect(result.current.codigo).toBe("");
    expect(result.current.aviso).toBe("");
  });

  test("«he olvidado mi contraseña» pide el correo", () => {
    const { result } = renderHook(() => useLaRecuperacionDeLaCuenta());

    act(() => result.current.empiezaARecuperar());

    expect(result.current.paso).toBe(PEDIR_EL_CODIGO);
    expect(result.current.pidiendoElCorreo).toBe(true);
  });

  test("y cuando el servidor lo manda, se pasa a escribirlo", () => {
    const { result } = renderHook(() => useLaRecuperacionDeLaCuenta());

    act(() => result.current.empiezaARecuperar());
    act(() => result.current.pideQueEscribaElCodigo("Revisa tu correo."));

    expect(result.current.paso).toBe(ESCRIBIR_EL_CODIGO);
    expect(result.current.escribiendoElCodigo).toBe(true);
    expect(result.current.aviso).toBe("Revisa tu correo.");
  });

  test("el código NO se rellena solo, ni en local", () => {
    /*
     * El servidor lo manda en el aviso cuando se trabaja en local. Rellenarlo
     * haría que el paso se saltara solo aquí y nadie probaría nunca lo que hace
     * todo el mundo.
     */
    const { result } = renderHook(() => useLaRecuperacionDeLaCuenta());

    act(() => result.current.pideQueEscribaElCodigo("Código (modo local): ABC123"));

    expect(result.current.codigo).toBe("");
  });
});

describe("volver al acceso normal", () => {
  test("no deja rastro del intento anterior", () => {
    // Esto es lo que estaba escrito cinco veces en tres ficheros.
    const { result } = renderHook(() => useLaRecuperacionDeLaCuenta());

    act(() => result.current.empiezaARecuperar());
    act(() => result.current.pideQueEscribaElCodigo("Revisa tu correo."));
    act(() => result.current.escribeElCodigo("ABC123"));

    act(() => result.current.vuelveAlAcceso());

    expect(result.current.paso).toBe(EL_ACCESO_NORMAL);
    expect(result.current.codigo).toBe("");
    expect(result.current.aviso).toBe("");
  });

  test("y empezar de nuevo tampoco arrastra el código de antes", () => {
    /*
     * Si lo arrastrara, el segundo intento mandaría al servidor un código que ya
     * caducó y el aviso diría que es incorrecto sin que nadie lo haya tecleado.
     */
    const { result } = renderHook(() => useLaRecuperacionDeLaCuenta());

    act(() => result.current.pideQueEscribaElCodigo("Revisa tu correo."));
    act(() => result.current.escribeElCodigo("ABC123"));

    act(() => result.current.empiezaARecuperar());

    expect(result.current.codigo).toBe("");
    expect(result.current.aviso).toBe("");
  });
});

describe("el aviso entre intentos", () => {
  test("se borra sin cambiar de paso", () => {
    /*
     * Antes de cada intento, lo que se dijo en el anterior deja de valer. Pero
     * no se sale del paso: se sigue escribiendo el código.
     */
    const { result } = renderHook(() => useLaRecuperacionDeLaCuenta());

    act(() => result.current.pideQueEscribaElCodigo("Ese código no vale."));
    act(() => result.current.escribeElCodigo("ABC123"));

    act(() => result.current.olvidaElAviso());

    expect(result.current.aviso).toBe("");
    expect(result.current.paso).toBe(ESCRIBIR_EL_CODIGO);
    expect(result.current.codigo).toBe("ABC123");
  });
});

describe("y los cinco reinicios son uno", () => {
  test("nadie pone los tres a cero a mano", () => {
    /*
     * Ni en `App`, ni en `useAuthDialogControls`, ni en `useAuthSessionReset`. Si
     * vuelve a aparecer, vuelve el riesgo de añadir un cuarto estado y ponerlo
     * solo en tres sitios.
     */
    const ficheros = ["App.js", "hooks/useElDialogoDeAcceso.js", "hooks/useAuthSessionReset.js"];

    for (const rel of ficheros) {
      const fuente = fs.readFileSync(path.join(__dirname, "..", rel), "utf8");
      expect(fuente).not.toContain("setAuthRecoveryMode(");
      expect(fuente).not.toContain("setAuthRecoveryCode(");
      expect(fuente).not.toContain("setAuthRecoveryFeedback(");
    }
  });
});
