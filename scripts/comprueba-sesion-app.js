/**
 * La sesión de las dos maneras, en el mismo proceso y sin servidor.
 *
 * ## Qué vigila
 *
 *  1. La web sigue recibiendo **exactamente** la misma respuesta de login que
 *     antes: `sessionId`, `expiresAt`, la cookie `HttpOnly`, y **ningún token**.
 *     Es la comprobación que importa: devolverle el token al navegador sería
 *     regalarle a cualquier script de la página lo que la cookie le esconde.
 *  2. Quien se identifica como app (`X-PopCar-Client: app`) sí lo recibe,
 *     porque es lo único que va a poder guardar entre arranques.
 *  3. Ese token vale como `Authorization: Bearer` en peticiones posteriores.
 *  4. Uno inventado no entra.
 *  5. La cookie de siempre sigue valiendo igual.
 *  6. Sin `CORS_ORIGENES` no se añade ni una cabecera; con la lista puesta, se
 *     abre solo para quien está en ella.
 *
 * ## Por qué en proceso y no contra un servidor
 *
 * Las pruebas de `scripts/auth-e2e-local.js` necesitan levantar el servidor
 * local. Esto no: llama al handler con un `req` y un `res` de mentira, así que
 * corre en un segundo y se puede lanzar sin puertos ni base de datos. Usa el
 * proveedor local de ficheros, que está en `.gitignore`.
 */
process.env.AUTH_PROVIDER = "local";

const authHandler = require("../api/auth.js");

function creaRes() {
  const res = {
    cabeceras: {},
    codigo: 0,
    cuerpo: null,
    setHeader(k, v) { this.cabeceras[k.toLowerCase()] = v; },
    getHeader(k) { return this.cabeceras[k.toLowerCase()]; },
    status(c) { this.codigo = c; return this; },
    json(b) { this.cuerpo = b; return this; },
    send(b) { this.cuerpo = b; return this; },
    end() { return this; },
  };
  return res;
}

function cookieDe(res) {
  const raw = res.cabeceras["set-cookie"];
  if (!raw) return "";
  return String(raw).split(";")[0];
}

const fallos = [];
function comprueba(nombre, condicion, detalle = "") {
  if (condicion) {
    console.log("  OK   " + nombre);
  } else {
    console.log("  FALLA " + nombre + (detalle ? " — " + detalle : ""));
    fallos.push(nombre);
  }
}

(async () => {
  const email = `prueba.sesion.${Date.now()}@example.com`;
  const password = "UnaClaveLarga123";

  console.log("\n1) Registro y login desde la web (sin cabecera de app)");
  const resReg = creaRes();
  await authHandler(
    { method: "POST", headers: {}, query: {}, body: { action: "register", email, password, name: "Prueba" } },
    resReg
  );
  comprueba("el registro responde 200", resReg.codigo === 200, JSON.stringify(resReg.cuerpo));

  const resWeb = creaRes();
  await authHandler(
    { method: "POST", headers: {}, query: {}, body: { action: "login", email, password } },
    resWeb
  );
  comprueba("el login de la web responde 200", resWeb.codigo === 200);
  comprueba("la web NO recibe el token en el cuerpo", !("token" in (resWeb.cuerpo?.session || {})),
    JSON.stringify(resWeb.cuerpo?.session));
  comprueba("la web sigue recibiendo sessionId y expiresAt",
    Boolean(resWeb.cuerpo?.session?.sessionId) && Boolean(resWeb.cuerpo?.session?.expiresAt));
  comprueba("la web sigue recibiendo la cookie HttpOnly",
    String(resWeb.cabeceras["set-cookie"] || "").includes("HttpOnly"));

  console.log("\n2) Login desde la app (X-PopCar-Client: app)");
  const resApp = creaRes();
  await authHandler(
    { method: "POST", headers: { "x-popcar-client": "app" }, query: {}, body: { action: "login", email, password } },
    resApp
  );
  const token = resApp.cuerpo?.session?.token;
  comprueba("la app SÍ recibe el token", Boolean(token));
  comprueba("el token tiene la forma sessionId.token", typeof token === "string" && token.includes("."));

  console.log("\n3) El token vale como Bearer en una petición posterior");
  const resBearer = creaRes();
  await authHandler(
    { method: "GET", headers: { authorization: `Bearer ${token}` }, query: {} },
    resBearer
  );
  comprueba("GET /api/auth con Bearer devuelve autenticado",
    resBearer.cuerpo?.authenticated === true, JSON.stringify(resBearer.cuerpo));
  comprueba("y devuelve el usuario correcto",
    String(resBearer.cuerpo?.user?.email || "").toLowerCase() === email.toLowerCase());

  console.log("\n4) Un Bearer inventado no entra");
  const resMalo = creaRes();
  await authHandler(
    { method: "GET", headers: { authorization: "Bearer inventado.deltodo" }, query: {} },
    resMalo
  );
  comprueba("Bearer falso NO autentica", resMalo.cuerpo?.authenticated !== true);

  console.log("\n5) La cookie de siempre sigue funcionando");
  const resCookieLogin = creaRes();
  await authHandler(
    { method: "POST", headers: {}, query: {}, body: { action: "login", email, password } },
    resCookieLogin
  );
  const cookie = cookieDe(resCookieLogin);
  const resCookie = creaRes();
  await authHandler({ method: "GET", headers: { cookie }, query: {} }, resCookie);
  comprueba("GET /api/auth con cookie devuelve autenticado", resCookie.cuerpo?.authenticated === true);

  console.log("\n6) CORS");
  delete process.env.CORS_ORIGENES;
  const resSinCors = creaRes();
  await authHandler({ method: "GET", headers: { origin: "https://loquesea.com" }, query: {} }, resSinCors);
  comprueba("sin CORS_ORIGENES no se añade ninguna cabecera",
    !resSinCors.cabeceras["access-control-allow-origin"]);

  process.env.CORS_ORIGENES = "capacitor://localhost,https://localhost";
  const resPermitido = creaRes();
  await authHandler({ method: "GET", headers: { origin: "capacitor://localhost" }, query: {} }, resPermitido);
  comprueba("el origen de la lista recibe su origen concreto",
    resPermitido.cabeceras["access-control-allow-origin"] === "capacitor://localhost");
  comprueba("y el permiso de credenciales",
    resPermitido.cabeceras["access-control-allow-credentials"] === "true");
  comprueba("y Vary: Origin", resPermitido.cabeceras["vary"] === "Origin");
  comprueba("Authorization está en los headers permitidos",
    String(resPermitido.cabeceras["access-control-allow-headers"] || "").includes("Authorization"));

  const resAjeno = creaRes();
  await authHandler({ method: "GET", headers: { origin: "https://malo.example" }, query: {} }, resAjeno);
  comprueba("un origen fuera de la lista NO recibe permiso",
    !resAjeno.cabeceras["access-control-allow-origin"]);

  const resPreflight = creaRes();
  await authHandler(
    { method: "OPTIONS", headers: { origin: "capacitor://localhost" }, query: {} },
    resPreflight
  );
  comprueba("el preflight se contesta con 204", resPreflight.codigo === 204);

  console.log(fallos.length
    ? `\n[sesion-app] FALLA — ${fallos.length}: ${fallos.join(", ")}`
    : "\n[sesion-app] OK: la web recibe lo de siempre y sin token, la app recibe el suyo, " +
      "el Bearer entra, uno inventado no, la cookie sigue valiendo igual y CORS solo abre para la lista.");
  process.exit(fallos.length ? 1 : 0);
})().catch((err) => {
  console.error("se ha roto:", err);
  process.exit(1);
});
