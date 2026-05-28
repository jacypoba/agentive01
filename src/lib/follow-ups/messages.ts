import type { FollowUpContextSnapshot, FollowUpType } from "@/types/database";

function hashPick(seed: string, count: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash % count;
}

function areaLabel(context: FollowUpContextSnapshot): string {
  return context.city?.trim() || "essa zona";
}

function propertyLabel(context: FollowUpContextSnapshot): string {
  return (
    context.property_title?.trim() ||
    context.shown_property_titles?.at(-1)?.trim() ||
    "o imóvel"
  );
}

const MESSAGE_VARIANTS: Record<FollowUpType, ((ctx: FollowUpContextSnapshot) => string)[]> = {
  property_recommended: [
    (ctx) =>
      `Conseguiu dar uma vista de olhos ${propertyLabel(ctx) === "o imóvel" ? "nas opções" : `em ${propertyLabel(ctx)}`}?`,
    (ctx) =>
      `O que achou ${propertyLabel(ctx) === "o imóvel" ? "das sugestões" : `de ${propertyLabel(ctx)}`}? Se quiser, mando mais no mesmo perfil.`,
    (ctx) =>
      `Ficou com alguma dúvida sobre ${propertyLabel(ctx)}? Estou por aqui.`,
  ],
  silent_lead: [
    (ctx) => `Ainda procura algo em ${areaLabel(ctx)}? Tenho algumas ideias se quiser.`,
    (ctx) =>
      `Passo só para saber se ainda faz sentido procurar ${ctx.property_type ? `um ${ctx.property_type}` : "imóvel"} por ${areaLabel(ctx)}.`,
    () => "Se quiser retomar, digo-lhe já o que tenho disponível 👌",
    (ctx) =>
      `Continua à procura${ctx.budget ? ` até ${ctx.budget}` : ""}? Posso filtrar melhor se me disser o que mudou.`,
  ],
  visit_pending: [
    (ctx) =>
      `Sobre a visita a ${propertyLabel(ctx)} — assim que confirmar o horário, aviso logo.`,
    () => "Estou a ver a disponibilidade para a visita. Prefere manhã ou tarde?",
    (ctx) =>
      `Quando puder, confirme o horário da visita${ctx.property_title ? ` a ${ctx.property_title}` : ""} 🙏`,
  ],
  visit_completed: [
    (ctx) =>
      `Conseguiu visitar ${propertyLabel(ctx)}? O que achou?`,
    (ctx) =>
      `Como correu a visita a ${propertyLabel(ctx)}? Se quiser, vemos alternativas.`,
    () => "Depois da visita, ficou com vontade de avançar ou prefere ver mais opções?",
  ],
  new_match: [
    (ctx) =>
      `Entretanto apareceu uma opção nova que pode encaixar melhor 👌${ctx.new_property_title ? ` — ${ctx.new_property_title}` : ""}`,
    (ctx) =>
      `Surgeu algo em ${areaLabel(ctx)} que pode fazer sentido${ctx.new_property_title ? `: ${ctx.new_property_title}` : ""}. Quer ver?`,
    (ctx) =>
      `Tenho uma novidade em ${areaLabel(ctx)}${ctx.budget ? ` dentro do perfil` : ""}. Mando detalhes?`,
  ],
};

export function generateFollowUpMessage(
  type: FollowUpType,
  context: FollowUpContextSnapshot,
  seed: string
): string {
  const variants = MESSAGE_VARIANTS[type];
  const index = hashPick(`${seed}:${type}:${new Date().toISOString().slice(0, 10)}`, variants.length);
  return variants[index](context);
}
