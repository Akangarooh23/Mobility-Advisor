import { useCallback } from "react";
import { postBillingCheckoutJson } from "../utils/apiClient";
import { normalizeText } from "../utils/offerHelpers";

export function usePlanCheckout({
  currentUserEmail,
  isUserLoggedIn,
  openAuthDialog,
  setPendingPlanCheckoutId,
  setPlanCheckoutLoadingId,
  setPlanCheckoutFeedback,
}) {
  const startSubscriptionCheckout = useCallback(async (planId, options = {}) => {
    const normalizedPlanId = normalizeText(planId).toLowerCase();
    const shouldSkipAuthGate = Boolean(options?.skipAuth);

    if (!normalizedPlanId) {
      return;
    }

    if (!shouldSkipAuthGate && !isUserLoggedIn) {
      setPendingPlanCheckoutId(normalizedPlanId);
      setPlanCheckoutFeedback("Inicia sesión para continuar con la suscripción.");
      openAuthDialog("login", { routePage: "home" });
      return;
    }

    setPlanCheckoutLoadingId(normalizedPlanId);
    setPlanCheckoutFeedback("");

    try {
      const { data } = await postBillingCheckoutJson({
        planId: normalizedPlanId,
        origin: typeof window !== "undefined" ? window.location.origin : "",
        customerEmail: normalizeText(options?.customerEmail || currentUserEmail).toLowerCase(),
      });

      if (normalizeText(data?.url)) {
        if (typeof window !== "undefined") {
          window.location.assign(data.url);
          return;
        }
      }

      setPlanCheckoutFeedback(
        normalizeText(data?.message) ||
          (data?.simulated
            ? "Checkout en modo simulado: falta configurar Stripe (claves/precios)."
            : "No se pudo abrir la pasarela de pago para este plan.")
      );

      setPendingPlanCheckoutId("");
    } catch (error) {
      setPlanCheckoutFeedback(error?.message || "No se pudo iniciar el checkout del plan seleccionado.");
    } finally {
      setPlanCheckoutLoadingId("");
    }
  }, [
    currentUserEmail,
    isUserLoggedIn,
    openAuthDialog,
    setPendingPlanCheckoutId,
    setPlanCheckoutFeedback,
    setPlanCheckoutLoadingId,
  ]);

  return {
    startSubscriptionCheckout,
  };
}
