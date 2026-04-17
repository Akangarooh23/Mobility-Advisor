import { useMemo } from "react";
import { buildMarketAlertMatches } from "../utils/portalVoHelpers";

export function useMarketAlertInsights({
  marketAlerts,
  marketAlertStatus,
  offers,
  currentUserEmail,
  resolveAlertRecipientEmail,
}) {
  const marketAlertMatches = useMemo(
    () => buildMarketAlertMatches({ alerts: marketAlerts, offers }),
    [marketAlerts, offers]
  );

  const newAlertMatchesCount = useMemo(
    () =>
      marketAlerts.reduce((acc, alert) => {
        const matchCount = Number(marketAlertMatches?.[alert.id]?.count || 0);
        const seenCount = Number(marketAlertStatus?.[alert.id]?.seenCount || 0);
        return acc + Math.max(matchCount - seenCount, 0);
      }, 0),
    [marketAlertMatches, marketAlertStatus, marketAlerts]
  );

  const pendingAlertNotifications = useMemo(
    () =>
      marketAlerts
        .map((alert) => {
          const matchInfo = marketAlertMatches?.[alert.id] || { count: 0, matches: [] };
          const seenCount = Number(marketAlertStatus?.[alert.id]?.seenCount || 0);
          const newMatchesCount = Math.max(Number(matchInfo.count || 0) - seenCount, 0);

          if (newMatchesCount <= 0) {
            return null;
          }

          const alertEmail = resolveAlertRecipientEmail(alert, currentUserEmail);

          return {
            id: alert.id,
            title: alert.title,
            newMatchesCount,
            summary: `${newMatchesCount} ${newMatchesCount === 1 ? "coincidencia nueva detectada" : "coincidencias nuevas detectadas"} en el marketplace`,
            matches: Array.isArray(matchInfo.matches) ? matchInfo.matches.slice(0, 2) : [],
            notifyByEmail: Boolean(alert.notifyByEmail && alertEmail),
            email: alertEmail,
          };
        })
        .filter(Boolean)
        .sort((a, b) => b.newMatchesCount - a.newMatchesCount || a.title.localeCompare(b.title, "es")),
    [currentUserEmail, marketAlertMatches, marketAlertStatus, marketAlerts, resolveAlertRecipientEmail]
  );

  return {
    marketAlertMatches,
    newAlertMatchesCount,
    pendingAlertNotifications,
  };
}
