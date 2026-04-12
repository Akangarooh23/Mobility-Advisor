import React from "react";
import {
  SiAudi,
  SiBmw,
  SiHyundai,
  SiKia,
  SiMg,
  SiNissan,
  SiRenault,
  SiSeat,
  SiSkoda,
  SiToyota,
  SiVolkswagen,
  SiVolvo,
} from "react-icons/si";

export function MercedesLogo({ size = 14 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
      <path d="M12 5.2v6.8M12 12l-5.8 3.4M12 12l5.8 3.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function BydLogo({ size = 14 }) {
  return (
    <svg viewBox="0 0 36 24" width={size} height={size} fill="none" aria-hidden="true">
      <rect x="2.5" y="3.5" width="31" height="17" rx="8.5" stroke="currentColor" strokeWidth="2" />
      <text x="18" y="15.2" textAnchor="middle" fontSize="9.2" fontWeight="700" fontFamily="Segoe UI, Arial, sans-serif" fill="currentColor">
        BYD
      </text>
    </svg>
  );
}

export function XPengLogo({ size = 14 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" aria-hidden="true">
      <path d="M4.5 8.2 9.5 12l2.5-1.7L14.5 12l5-3.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.5 12v4.8M14.5 12v4.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export const BLOCK_COLORS = {
  Perfil: "#2563EB",
  "Uso real": "#059669",
  Capacidad: "#D97706",
  Preferencias: "#7C3AED",
  Energía: "#0891B2",
  Financiero: "#DC2626",
  Restricciones: "#9333EA",
  Vinculación: "#E11D48",
  Riesgo: "#65A30D",
  Avanzado: "#14B8A6",
};

export const BRAND_LOGOS = {
  Volkswagen: { icon: SiVolkswagen, color: "#0a58ca" },
  Seat: { icon: SiSeat, color: "#6b7280" },
  Renault: { icon: SiRenault, color: "#f59e0b" },
  Skoda: { icon: SiSkoda, color: "#16a34a" },
  Toyota: { icon: SiToyota, color: "#ef4444" },
  Hyundai: { icon: SiHyundai, color: "#0ea5e9" },
  Kia: { icon: SiKia, color: "#dc2626" },
  Nissan: { icon: SiNissan, color: "#64748b" },
  BMW: { icon: SiBmw, color: "#2563eb" },
  Mercedes: { icon: MercedesLogo, color: "#111827" },
  Audi: { icon: SiAudi, color: "#6b7280" },
  Volvo: { icon: SiVolvo, color: "#0284c7" },
  BYD: { icon: BydLogo, color: "#dc2626" },
  MG: { icon: SiMg, color: "#ef4444" },
  XPeng: { icon: XPengLogo, color: "#111827" },
};
