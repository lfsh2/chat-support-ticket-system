export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "Client Hub";
export const SUPPORT_EMAIL = "CoachOS@AliveAndFreeConsulting.com";

export const PROGRAMS = {
  alive_free: { label: "Alive & Free", accent: "var(--accent-af)" },
  coachos: { label: "CoachOS", accent: "var(--accent-coachos)" },
} as const;
