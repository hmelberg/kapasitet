export const AGE_GROUPS = ["0-17", "18-29", "30-49", "50-66", "67-79", "80-89", "90+"];
const UPPER = [17, 29, 49, 66, 79, 89];

/** Single-year age code ("000", "17", "105+") → one of AGE_GROUPS. */
export function ageGroup(code) {
  const n = parseInt(String(code), 10);
  if (Number.isNaN(n)) throw new Error(`Kan ikke tolke aldersgruppe fra koden "${code}"`);
  for (let i = 0; i < UPPER.length; i++) if (n <= UPPER[i]) return AGE_GROUPS[i];
  return AGE_GROUPS[AGE_GROUPS.length - 1];
}
