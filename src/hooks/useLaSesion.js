import { useCallback, useState } from "react";
import { writeAuthUser, clearAuthUser } from "../utils/storage";

/**
 * La sesión: quién ha entrado, y si ya se sabe.
 *
 * ## Qué había
 *
 * Cuatro `useState` en `App`, y **dos de ellos cuentan el mismo hecho**:
 * `currentUser` -quién es- e `isUserLoggedIn` -si hay alguien-. Se movían por
 * separado, en cuatro ficheros:
 *
 *   · `useAppBootstrap` los ponía juntos en tres sitios;
 *   · `App` los ponía juntos en dos -al caducar la sesión y al entrar;
 *   · `useAuthSessionReset` ponía **solo** `currentUser` a nulo;
 *   · `useAdvisorController` ponía **solo** `isUserLoggedIn` a falso.
 *
 * Los dos últimos se compensan porque `handleLogout` llama a los dos, uno detrás
 * del otro. Funciona, pero la coherencia de «no hay nadie» dependía de que dos
 * ficheros distintos se llamaran en el orden correcto. Quien llame a
 * `resetLoggedUser` desde otro sitio se queda con `currentUser` a nulo e
 * `isUserLoggedIn` a cierto: la aplicación creyendo que hay alguien y sin nadie.
 *
 * Aquí los dos se mueven juntos, siempre, con `entra()` y `sale()`.
 *
 * ## Y los otros dos, que no son lo mismo
 *
 * `sesionComprobada` y `authRequired` parecen del montón y no lo son:
 *
 *   · **`sesionComprobada`** distingue «no hay nadie» de «todavía no lo sé». Al
 *     arrancar no se sabe: hay que preguntar al servidor. Sin esta diferencia,
 *     media aplicación trataría el primer instante como «no ha entrado» y
 *     mandaría a la portada a quien sí había entrado;
 *   · **`authRequired`** es «hace falta entrar para lo que estás pidiendo». No es
 *     lo contrario de estar dentro: se enciende al pedir una página que necesita
 *     cuenta, y se apaga al conseguirla.
 *
 * ## Lo que NO hace
 *
 * Preguntar al servidor. Eso es `useAppBootstrap`, que arranca media aplicación.
 * Esto guarda la respuesta y la mantiene coherente.
 */
export function useLaSesion() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isUserLoggedIn, setIsUserLoggedIn] = useState(false);

  /* Falso mientras no se sabe. No es lo mismo que «no hay nadie». */
  const [sesionComprobada, setSesionComprobada] = useState(false);

  /* «Hace falta entrar para esto», que no es lo contrario de estar dentro. */
  const [authRequired, setAuthRequired] = useState(false);

  /**
   * Ha entrado alguien: los dos estados se mueven juntos.
   *
   * También se guarda en el navegador, que es lo que hace que al recargar no se
   * vea la portada durante un instante.
   */
  const entra = useCallback((usuario) => {
    writeAuthUser(usuario);
    setCurrentUser(usuario);
    setIsUserLoggedIn(Boolean(usuario?.email));
  }, []);

  /**
   * Se actualizan sus datos sin volver a entrar.
   *
   * Es lo que pasa al aceptar los consentimientos o al cambiar la contraseña: la
   * sesión es la misma, el usuario trae un campo nuevo. No se toca
   * `isUserLoggedIn` porque no ha cambiado.
   */
  const seActualiza = useCallback((usuario) => {
    writeAuthUser(usuario);
    setCurrentUser(usuario);
  }, []);

  /**
   * No hay nadie: los dos a la vez, y lo guardado se borra.
   *
   * `sesionComprobada` **no** se toca: seguir sabiendo que ya se preguntó es lo
   * que evita el parpadeo de «todavía no lo sé» al salir.
   */
  const sale = useCallback(() => {
    clearAuthUser();
    setCurrentUser(null);
    setIsUserLoggedIn(false);
  }, []);

  return {
    currentUser,
    isUserLoggedIn,
    sesionComprobada, setSesionComprobada,
    authRequired, setAuthRequired,

    entra,
    seActualiza,
    sale,
  };
}
