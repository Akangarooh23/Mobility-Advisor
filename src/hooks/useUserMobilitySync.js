import { useEffect } from "react";
import { getUserMobilityDataJson } from "../utils/apiClient";
import {
  writeSavedComparisons,
  writeUserAppointments,
  writeUserMaintenances,
  writeUserInsurances,
  writeUserValuations,
  writeUserVehicleStates,
  writeUserSolicitudes,
  writeCachedGarageVehicleCount,
  writeUserBillingState,
  readUserBillingState,
} from "../utils/storage";

export function useUserMobilitySync({
  currentUserEmail,
  setSavedComparisons,
  setUserAppointments,
  setUserMaintenances,
  setUserInsurances,
  setUserValuations,
  setUserVehicleStates,
  setUserSolicitudes,
  setGarageVehicleCount,
  setCurrentPlanId,
  // Sube de uno en uno cuando algo ha cambiado y hay que volver a pedirlo:
  // al reservar una visita, al entrar en el panel. Sin esto los datos se
  // pedían una sola vez, al entrar la sesión, y quien reservaba una visita
  // tenía que recargar la página entera para verla en sus solicitudes.
  refrescos = 0,
  /** Se llama cuando el servidor contesta que ya no hay sesión. */
  alCaducarLaSesion,
}) {
  useEffect(() => {
    let disposed = false;

    if (!currentUserEmail) {
      setUserValuations([]);
      setUserVehicleStates([]);
      setUserMaintenances([]);
      setUserInsurances([]);
      if (setUserSolicitudes) setUserSolicitudes([]);
      return () => {
        disposed = true;
      };
    }

    void (async () => {
      try {
        const { response, data } = await getUserMobilityDataJson(currentUserEmail);

        if (disposed) return;

        /*
         * Un 401 es «ya no hay sesión», y eso no se puede tragar.
         *
         * Se tragaba: entraba por el `!response.ok` de aquí abajo, se dejaban
         * los datos de la caché del navegador y la pantalla seguía enseñando
         * «1 tasación, 1 solicitud» de la última vez. Parecía que la sesión
         * estaba abierta —los números estaban ahí— y al abrir cualquier cosa
         * que sí necesita la sesión pedía la contraseña otra vez, sin venir a
         * cuento. El servidor llevaba rato diciendo que no había nadie.
         *
         * Este endpoint solo devuelve 401 por eso: la identidad sale de la
         * sesión y nunca de la dirección.
         */
        if (response.status === 401) {
          if (alCaducarLaSesion) alCaducarLaSesion();
          return;
        }

        if (!response.ok) {
          return;
        }

        const nextSaved = Array.isArray(data?.savedOffers) ? data.savedOffers.slice(0, 6) : [];
        const nextAppointments = Array.isArray(data?.appointments) ? data.appointments.slice(0, 8) : [];
        const nextMaintenances = Array.isArray(data?.maintenances) ? data.maintenances.slice(0, 12) : [];
        const nextInsurances = Array.isArray(data?.insurances) ? data.insurances.slice(0, 8) : [];
        const nextValuations = Array.isArray(data?.valuations) ? data.valuations.slice(0, 12) : [];
        const nextVehicleStates = Array.isArray(data?.vehicleStates) ? data.vehicleStates.slice(0, 30) : [];
        const nextSolicitudes = Array.isArray(data?.solicitudes) ? data.solicitudes.slice(0, 20) : [];

        setSavedComparisons(nextSaved);
        setUserAppointments(nextAppointments);
        setUserMaintenances(nextMaintenances);
        setUserInsurances(nextInsurances);
        setUserValuations(nextValuations);
        setUserVehicleStates(nextVehicleStates);
        if (setUserSolicitudes) setUserSolicitudes(nextSolicitudes);
        if (typeof data?.garageVehicleCount === "number") {
          writeCachedGarageVehicleCount(data.garageVehicleCount);
          if (setGarageVehicleCount) setGarageVehicleCount(data.garageVehicleCount);
        }
        if (data?.planId) {
          writeUserBillingState({ ...(readUserBillingState() || {}), planId: data.planId });
          if (setCurrentPlanId) setCurrentPlanId(data.planId);
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("planIdUpdated", { detail: { planId: data.planId } }));
          }
        }

        writeSavedComparisons(nextSaved);
        writeUserAppointments(nextAppointments);
        writeUserMaintenances(nextMaintenances);
        writeUserInsurances(nextInsurances);
        writeUserValuations(nextValuations);
        writeUserVehicleStates(nextVehicleStates);
        writeUserSolicitudes(nextSolicitudes);
      } catch {
        // Keep local fallback if mobility API is unavailable.
      }
    })();

    return () => {
      disposed = true;
    };
  }, [
    currentUserEmail,
    setSavedComparisons,
    setUserAppointments,
    setUserMaintenances,
    setUserInsurances,
    setUserValuations,
    setUserVehicleStates,
    setUserSolicitudes,
    setGarageVehicleCount,
    setCurrentPlanId,
    refrescos,
    alCaducarLaSesion,
  ]);
}
