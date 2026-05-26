import { formatPropertyPrice } from "@/lib/properties/search-criteria";
import type { Property } from "@/types/database";

export function buildPropertyRecommendationDirective(
  properties: Property[]
): string {
  if (properties.length === 0) {
    return [
      "---",
      "Property recommendations:",
      "- No matching listings found in the database for this lead's criteria.",
      "- Do NOT invent or describe fake properties.",
      "- Say naturally that you'll share more options soon (e.g. 'Vou ver opções para si e partilho em breve').",
      "- Keep it short — one sentence is enough.",
    ].join("\n");
  }

  const lines = [
    "---",
    "Property recommendations:",
    `- ${properties.length} real listing(s) matched the lead's city, budget, and property type.`,
    "- You MAY suggest 1–3 of these naturally in your reply — ONLY properties from this list.",
    "- NEVER invent listings, prices, links, or details not listed here.",
    "- Keep it conversational and short. Weave suggestions into 1–3 sentences max.",
    "- Include title, city/neighborhood, price, and listing link when sharing.",
    "",
    "Available listings:",
  ];

  properties.forEach((property, index) => {
    const location = property.neighborhood
      ? `${property.city}, ${property.neighborhood}`
      : property.city;
    const beds =
      property.bedrooms != null ? `${property.bedrooms} quartos` : null;
    const baths =
      property.bathrooms != null ? `${property.bathrooms} wc` : null;
    const specs = [beds, baths].filter(Boolean).join(" · ");

    lines.push(
      `${index + 1}. ${property.title}`,
      `   Local: ${location}`,
      `   Tipo: ${property.property_type}`,
      `   Preço: ${formatPropertyPrice(property.price)}`,
      specs ? `   Detalhes: ${specs}` : "",
      property.description ? `   Nota: ${property.description}` : "",
      property.listing_url ? `   Link: ${property.listing_url}` : ""
    );
  });

  return lines.filter(Boolean).join("\n");
}
