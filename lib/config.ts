export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "Alive + Free Client Hub";
export const ORG_NAME = "Alive + Free Consulting";
export const SUPPORT_EMAIL = "CoachOS@AliveAndFreeConsulting.com";

export const PROGRAMS = {
  alive_free: { label: "Alive & Free", accent: "var(--accent-af)" },
  coachos: { label: "CoachOS", accent: "var(--accent-coachos)" },
} as const;
