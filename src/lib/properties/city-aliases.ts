/** Shared city alias maps and text helpers for property search normalization. */

export const CITY_ALIASES: Record<string, string> = {
  milan: "Milano",
  milano: "Milano",
  milão: "Milano",
  milao: "Milano",
  lisbon: "Lisboa",
  lisboa: "Lisboa",
  porto: "Porto",
  florence: "Firenze",
  firenze: "Firenze",
  rome: "Roma",
  roma: "Roma",
  madrid: "Madrid",
  barcelona: "Barcelona",
  paris: "Paris",
  london: "London",
  cascais: "Cascais",
  sintra: "Sintra",
  oeiras: "Oeiras",
  faro: "Faro",
  coimbra: "Coimbra",
  braga: "Braga",
};

export const CITY_ALIAS_KEYS = Object.keys(CITY_ALIASES).sort(
  (a, b) => b.length - a.length
);

export function foldKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const PROPERTY_TYPE_ALIASES: Record<string, string> = {
  villa: "moradia",
  house: "moradia",
  home: "moradia",
  townhouse: "moradia",
  townhome: "moradia",
  casa: "moradia",
  maison: "moradia",
  moradia: "moradia",
  vivenda: "moradia",
  villetta: "moradia",
  vivienda: "moradia",
  chalet: "moradia",
  apartment: "apartamento",
  appartamento: "apartamento",
  appartement: "apartamento",
  apartamento: "apartamento",
  flat: "apartamento",
  condo: "apartamento",
  condominium: "apartamento",
  loft: "apartamento",
  duplex: "apartamento",
  penthouse: "apartamento",
  estúdio: "apartamento",
  estudio: "apartamento",
  studio: "apartamento",
  t0: "apartamento",
  t1: "apartamento",
  t2: "apartamento",
  t3: "apartamento",
  t4: "apartamento",
};

const TYPE_ALIAS_KEYS = Object.keys(PROPERTY_TYPE_ALIASES).sort(
  (a, b) => b.length - a.length
);

export function isPropertyTypeToken(value: string): boolean {
  const folded = foldKey(value);
  return TYPE_ALIAS_KEYS.some(
    (key) => folded === key || folded.includes(key) || key.includes(folded)
  );
}

export function normalizeCity(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const folded = foldKey(value);
  const canonical = CITY_ALIASES[folded];
  if (canonical) return canonical;

  return value
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export function normalizePropertyType(
  value: string | null | undefined
): string | null {
  if (!value?.trim()) return null;
  const folded = foldKey(value);
  return PROPERTY_TYPE_ALIASES[folded] ?? value.trim().toLowerCase();
}

export const PROPERTY_TYPE_ALIAS_KEYS = TYPE_ALIAS_KEYS;
export { PROPERTY_TYPE_ALIASES };
