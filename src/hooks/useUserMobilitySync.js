import { useEffect } from "react";
import { getUserMobilityDataJson } from "../utils/apiClient";
import { writeSavedComparisons, writeUserAppointments } from "../utils/storage";

export function useUserMobilitySync({
  currentUserEmail,
  setSavedComparisons,
  setUserAppointments,
  setUserMaintenances,
  setUserInsurances,
  setUserValuations,
  setUserVehicleStates,
}) {
  useEffect(() => {
    let disposed = false;

    if (!currentUserEmail) {
      setUserValuations([]);
      setUserVehicleStates([]);
      setUserMaintenances([]);
      setUserInsurances([]);
      return () => {
        disposed = true;
      };
    }

    void (async () => {
      try {
        const { response, data } = await getUserMobilityDataJson(currentUserEmail);

        if (!response.ok || disposed) {
          return;
        }

        const nextSaved = Array.isArray(data?.savedOffers) ? data.savedOffers.slice(0, 6) : [];
        const nextAppointments = Array.isArray(data?.appointments) ? data.appointments.slice(0, 8) : [];
        const nextMaintenances = Array.isArray(data?.maintenances) ? data.maintenances.slice(0, 12) : [];
        const nextInsurances = Array.isArray(data?.insurances) ? data.insurances.slice(0, 8) : [];
        const nextValuations = Array.isArray(data?.valuations) ? data.valuations.slice(0, 12) : [];
        const nextVehicleStates = Array.isArray(data?.vehicleStates) ? data.vehicleStates.slice(0, 30) : [];

        setSavedComparisons(nextSaved);
        setUserAppointments(nextAppointments);
        setUserMaintenances(nextMaintenances);
        setUserInsurances(nextInsurances);
        setUserValuations(nextValuations);
        setUserVehicleStates(nextVehicleStates);

        writeSavedComparisons(nextSaved);
        writeUserAppointments(nextAppointments);
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
  ]);
}
