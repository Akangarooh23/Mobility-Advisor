# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)

## Uso local sin Vercel

Ya no hace falta depender de Vercel para probar la app en local.

1. Crea o revisa el archivo `.env.local` en la raíz con:
   - `GEMINI_API_KEY=tu_clave_de_gemini`
2. Si quieres activar emails reales de alertas con Resend, añade también:
   - `RESEND_API_KEY=tu_clave_de_resend`
   - `ALERT_EMAIL_FROM="MoveAdvisor <onboarding@resend.dev>"`
   - `ALERT_EMAIL_PROVIDER=resend`
3. Arranca o reinicia el proyecto con:
   - `npm start`
4. Si quieres cambiar el puerto del frontend:
   - PowerShell: `$env:PORT=3002; npm start`
5. Si te falla `npm start` por puertos ocupados (3002/3003), usa:
   - `npm run start:clean`

`npm start` levanta:
- el frontend de React
- una API local en `http://localhost:3001`

La app sigue usando `api/analyze.js` y `api/find-listing.js`, pero ahora servidos desde un servidor local, sin depender de Vercel.

### Emails reales de alertas

- Sin `RESEND_API_KEY`, el botón `Enviar resumen por email` funciona en **modo local/simulado**.
- Con `RESEND_API_KEY`, el backend usa `api/send-alert-email.js` para intentar el envío real.
- Si cambias el `.env.local`, reinicia `npm start` para que la API recargue la configuración.

### Registro y login persistentes

- La app ya incluye registro e inicio de sesión reales en local mediante `api/auth.js`.
- Puedes usar **SQL Server** para usuarios (`AUTH_PROVIDER=sqlcmd-windows` con Auth de Windows, o `AUTH_PROVIDER=mssql` con usuario SQL) o mantener el fallback local JSON (`AUTH_PROVIDER=local`).
- Con SQL Server, los usuarios se guardan en la tabla `dbo.MoveAdvisorUsers`.
- Script SQL de referencia: `db/sqlserver/init-moveadvisor-auth.sql`.
- El **email del login** se usa como destinatario por defecto en las alertas y en el envío de resúmenes por email.
- Para probarlo, abre la app, pulsa `Acceder` → `Registrarse`, crea una cuenta y luego activa `Enviarme también un resumen por email` en una alerta.

#### Configuración SQL Server para auth

En `.env.local` configura (opción recomendada para SQLEXPRESS local con Windows Auth):

- `AUTH_PROVIDER=sqlcmd-windows`
- `MSSQL_SERVER=tu-servidor`
- `MSSQL_DATABASE=tu-base`

Si prefieres usuario SQL (no Windows Auth), usa:

- `AUTH_PROVIDER=mssql`
- `MSSQL_SERVER=tu-servidor`
- `MSSQL_PORT=1433`
- `MSSQL_DATABASE=tu-base`
- `MSSQL_USER=tu-usuario`
- `MSSQL_PASSWORD=tu-password`
- `MSSQL_ENCRYPT=true`
- `MSSQL_TRUST_SERVER_CERTIFICATE=true`

Después reinicia `npm start`.

Puedes tener varias bases en la misma instancia (por ejemplo `ERPKangaroo` y `Mobilityadvisor`) sin conflicto porque cada proyecto usa su propia base y tablas.

Diagnóstico rápido (local):

- `GET http://localhost:3001/api/auth-status`
- Devuelve proveedor activo (`local`, `sqlcmd-windows`, `mssql`), base utilizada y número de usuarios registrados.

### Sesión segura (auth)

- El login/registro crea una sesión backend y una cookie `httpOnly` (`moveadvisor_session`) con expiración.
- Al abrir la app, el frontend valida sesión con `GET /api/auth` y restaura el usuario automáticamente.
- Al cerrar sesión, se elimina sesión servidor y se limpia la cookie.
- En cada login/registro se rota la sesión (se invalida la cookie/sesión previa del navegador).
- El backend limpia sesiones expiradas automáticamente (probabilidad por petición configurable).
- Puedes ajustar expiración con `AUTH_SESSION_TTL_HOURS` en `.env.local`.
- Puedes ajustar limpieza con `AUTH_SESSION_CLEANUP_PROBABILITY` (0..1) y reforzar firma con `AUTH_SESSION_SECRET`.

### Recuperación de contraseña

- Desde el modal de acceso (`Iniciar sesión`) puedes pulsar `He olvidado mi contraseña`.
- El backend genera un código temporal (15 min), lo guarda de forma segura y lo envía por email.
- Luego introduces `correo + código + nueva contraseña` y se actualiza la clave.
- Tras el reseteo, se inicia sesión automáticamente con cookie segura.
- En local, si quieres ver el código en la respuesta API para pruebas, activa:
   - `AUTH_EXPOSE_RESET_CODE=true`
- Si quieres que la API falle cuando no pueda enviar email (sin fallback local), activa:
   - `AUTH_REQUIRE_EMAIL_DELIVERY=true`
- Rate-limit de seguridad en recuperación (por email/IP) configurable con:
   - `AUTH_RESET_REQUEST_WINDOW_MS`, `AUTH_RESET_REQUEST_MAX_PER_EMAIL`, `AUTH_RESET_REQUEST_MAX_PER_IP`
   - `AUTH_RESET_CONFIRM_WINDOW_MS`, `AUTH_RESET_CONFIRM_MAX_PER_EMAIL`, `AUTH_RESET_CONFIRM_MAX_PER_IP`
- Backoff progresivo tras reintentos bloqueados (429):
   - `AUTH_RESET_BACKOFF_BASE_MS`, `AUTH_RESET_BACKOFF_MAX_MS`
- Auditoría de seguridad en logs (eventos de bloqueo/abuso/reset):
   - `AUTH_SECURITY_LOG_ENABLED=true|false`
- Estado de seguridad en tiempo real (solo debug local):
   - Activa `AUTH_SECURITY_STATUS_ENABLED=true`
   - Consulta `GET /api/auth?security=1` para ver contadores de rate-limit/backoff.
   - También disponible en `GET /api/auth-status?security=1` junto al estado del proveedor/auth DB.

### Cambio de contraseña con sesión iniciada

- Desde `Mi panel` puedes abrir `Seguridad de cuenta` y actualizar la contraseña sin cerrar sesión.
- El backend valida contraseña actual, aplica nueva contraseña y rota la sesión activa por seguridad.
- Endpoint usado: `POST /api/auth` con `action=change_password`.

### Verificación E2E de auth en local

- Con el stack local arrancado, puedes validar el flujo completo (registro + recuperación + cambio de contraseña):
   - `npm run test:auth-local`
- Por defecto apunta a `http://localhost:3003` (cámbialo con `API_BASE_URL`).
- Para incluir recuperación en esta prueba, mantén `AUTH_EXPOSE_RESET_CODE=true` en `.env.local`.
- Si `AUTH_REQUIRE_EMAIL_DELIVERY=true` bloquea la recuperación en local por restricciones del proveedor, el script valida igualmente registro + cambio de contraseña y lo informa en salida.
- Verificación estricta de entrega de email:
   - `npm run test:auth-local:strict`
   - Requiere en `.env.local`: `AUTH_EXPOSE_RESET_CODE=true` y `AUTH_REQUIRE_EMAIL_DELIVERY=true`.
   - Este check está pensado para claves/senders de prueba donde Resend rechaza destinatarios no verificados.
- Ejecución combinada de ambos checks:
   - `npm run test:auth-all-local`
- Verificación de seguridad (rate-limit/backoff) en local:
   - `npm run test:auth-security-local`

## Deploy en hosting opcional

Si más adelante quieres desplegarlo en Vercel u otro hosting, sigue necesitando la variable:
- `GEMINI_API_KEY=tu_clave_de_gemini`
