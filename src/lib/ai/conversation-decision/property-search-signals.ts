/** Shared multilingual property-search heuristics for the decision engine. */

export const PROPERTY_SEARCH_PATTERN =
  /\b(procuro|procurar|procura|quero|preciso|interess(?:a|o)|busco|pesquiso|looking for|searching for|cerco|cercare|voglio|quiero|buscar|je cherche|je souhaite|je veux|acheter|louer|cherche|souhaite)\b/i;

export const PROPERTY_TYPE_PATTERN =
  /\b(apartamento|moradia|vivenda|loft|duplex|penthouse|estúdio|estudio|studio|house|apartment|appartamento|appartement|flat|villa|home|casa|maison|villetta|vivienda|t[0-4])\b/i;

export const CITY_SIGNAL =
  /\b(em\s+[a-zà-ú]|in\s+[a-z]|en\s+[a-z]|a\s+[a-z]|à\s+[a-zà-ú]|lisboa|porto|milano|milan|milão|firenze|florence|roma|rome|madrid|paris|london|londres)\b/i;

export function isPropertySearchMessage(text: string): boolean {
  if (!text.trim()) return false;
  const hasSearchVerb = PROPERTY_SEARCH_PATTERN.test(text);
  const hasType = PROPERTY_TYPE_PATTERN.test(text);
  const hasLocation = CITY_SIGNAL.test(text);
  if (hasSearchVerb && (hasType || hasLocation)) return true;
  return hasType && hasLocation;
}

export function hasResolvedPropertySearchCriteria(criteria: {
  city?: string | null;
  propertyType?: string | null;
  buyRentIntent?: "buy" | "rent" | null;
}): boolean {
  return (
    Boolean(criteria.city?.trim()) &&
    (Boolean(criteria.propertyType?.trim()) || criteria.buyRentIntent != null)
  );
}
