import { isAiQualityV2Enabled } from "@/lib/ai/quality-v2";
import type { FollowUpContextSnapshot, FollowUpType } from "@/types/database";
import { completeLanguageRecord, type SupportedLanguage } from "@/lib/i18n/types";

function hashPick(seed: string, count: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return count > 0 ? hash % count : 0;
}

export const CLOSING_MARKERS = completeLanguageRecord({
  pt: ["fico por aqui", "é só chamar", "se precisar de mais alguma coisa"],
  en: ["i'll be here", "just reach out", "if you need anything"],
  it: ["resto a disposizione", "scrivimi pure", "se ti serve altro"],
  es: ["quedo atento", "escríbeme", "si necesitas algo"],
});

export const CLOSING_REPLIES = completeLanguageRecord({
  pt: [
    "Perfeito 👌 Fico por aqui então. Se precisar de mais alguma coisa, é só chamar.",
    "Combinado 👌 Qualquer coisa, estou por aqui.",
    "Ótimo — fico à disposição se precisar.",
  ],
  en: [
    "Perfect 👌 I'll be here if you need anything else.",
    "Sounds good 👌 Just reach out anytime.",
    "Great — happy to help whenever you need.",
  ],
  it: [
    "Perfetto 👌 Resto a disposizione, scrivimi pure.",
    "D'accordo 👌 Se ti serve altro, sono qui.",
    "Ottimo — fammi sapere quando vuoi.",
  ],
  es: [
    "Perfecto 👌 Quedo atento por si necesitas algo más.",
    "De acuerdo 👌 Escríbeme cuando quieras.",
    "Genial — aquí estoy si te hace falta.",
  ],
});

export const EXHAUSTED_MATCH_LINES = completeLanguageRecord({
  pt: [
    "Por agora estas são as melhores dentro do perfil. Se entrar algo novo, aviso.",
    "Neste perfil já partilhei o que tenho de melhor — aviso se surgir novidade.",
    "Foi isto que encontrei para o que pediu. Se aparecer algo novo, digo-lhe.",
  ],
  en: [
    "For now these are the best matches for your profile. I'll let you know if something new comes in.",
    "These are the strongest options I have right now for what you asked.",
    "That's what I found for this brief so far — I'll ping you if anything new appears.",
  ],
  it: [
    "Per ora queste sono le migliori opzioni nel tuo profilo. Ti avviso se ne arriva una nuova.",
    "Al momento ho già condiviso le opzioni più adatte a quello che cerchi.",
    "Per adesso è questo il meglio che ho trovato — ti scrivo se compare qualcosa di nuovo.",
  ],
  es: [
    "Por ahora estas son las mejores opciones para tu perfil. Te aviso si entra algo nuevo.",
    "Con este perfil ya compartí lo mejor que tengo ahora mismo.",
    "De momento esto es lo que encaja mejor — te escribo si aparece algo nuevo.",
  ],
});

export const RESHOW_CATALOG_INTROS = completeLanguageRecord({
  pt: [
    "Claro — volto a enviar 👇",
    "Estas foram as opções 👇",
    "Sem problema — mando outra vez 👇",
  ],
  en: [
    "Sure — sending them again 👇",
    "Here are the options again 👇",
    "No problem — resending now 👇",
  ],
  it: [
    "Certo — te le rimando 👇",
    "Ecco di nuovo le opzioni 👇",
    "Nessun problema — te le reinvio 👇",
  ],
  es: [
    "Claro — te las reenvío 👇",
    "Aquí están otra vez las opciones 👇",
    "Sin problema — te las mando de nuevo 👇",
  ],
});

export const RESHOW_SINGLE_INTROS = completeLanguageRecord({
  pt: ["Claro — esta era a opção 👇", "Volto a enviar 👇"],
  en: ["Sure — this was the option 👇", "Sending it again 👇"],
  it: ["Certo — era questa l'opzione 👇", "Te la rimando 👇"],
  es: ["Claro — era esta opción 👇", "Te la reenvío 👇"],
});

/** First property recommendation — warm premium welcome before cards. */
export const FIRST_RECOMMENDATION_CATALOG_INTROS = completeLanguageRecord({
  pt: [
    "Perfeito 👌 Separei algumas opções que encaixam bem no que procura:",
    "Já percebi o perfil 😊 Estas podem fazer sentido para si:",
    "Boa — encontrei algumas opções que batem certo com o que pediu:",
    "Fixe 👌 Veja se alguma destas encaixa:",
  ],
  en: [
    "Perfect 👌 I picked a few options that fit what you're looking for:",
    "Got it 😊 These might be a good fit:",
    "Nice — I pulled a few places that match your brief:",
    "Great 👌 Take a look at these — they line up with what you asked:",
  ],
  it: [
    "Perfetto 👌 Ho selezionato alcune opzioni che potrebbero interessarti:",
    "Ho capito il profilo 😊 Queste potrebbero fare al caso tuo:",
    "Ottimo — ho trovato alcune opzioni in linea con quello che cerchi:",
    "Benissimo 👌 Dà un'occhiata a queste:",
  ],
  es: [
    "Perfecto 👌 He separado algunas opciones que encajan bastante bien contigo:",
    "Entendido 😊 Estas podrían encajar con lo que buscas:",
    "Genial — he encontrado unas opciones que cuadran con tu perfil:",
    "Muy bien 👌 Mira si alguna de estas te encaja:",
  ],
});

export const FIRST_RECOMMENDATION_SINGLE_INTROS = completeLanguageRecord({
  pt: [
    "Perfeito 👌 Tenho uma opção que encaixa bem no que procura:",
    "Já percebi o perfil 😊 Esta pode fazer sentido para si:",
    "Boa — esta parece bater certo com o que pediu:",
  ],
  en: [
    "Perfect 👌 I found one option that fits what you're looking for:",
    "Got it 😊 This might be a good fit:",
    "Nice — this one lines up with your brief:",
  ],
  it: [
    "Perfetto 👌 Ho un'opzione che potrebbe interessarti:",
    "Ho capito il profilo 😊 Questa potrebbe fare al caso tuo:",
    "Ottimo — questa sembra in linea con quello che cerchi:",
  ],
  es: [
    "Perfecto 👌 Tengo una opción que encaja con lo que buscas:",
    "Entendido 😊 Esta podría encajarte:",
    "Genial — esta cuadra bastante bien con tu perfil:",
  ],
});

/** Follow-up batches — short, no repeated welcome. */
export const MORE_OPTIONS_CATALOG_INTROS = completeLanguageRecord({
  pt: [
    "Tenho mais algumas 👇",
    "Estas também encaixam no perfil:",
    "Mais opções que vale a pena ver:",
  ],
  en: [
    "I have a few more 👇",
    "These also fit the brief:",
    "A few more worth a look:",
  ],
  it: [
    "Ne ho altre 👇",
    "Anche queste potrebbero interessarti:",
    "Altre opzioni da vedere:",
  ],
  es: [
    "Tengo algunas más 👇",
    "Estas también encajan:",
    "Más opciones que merecen la pena:",
  ],
});

export const MORE_OPTIONS_SINGLE_INTROS = completeLanguageRecord({
  pt: ["Tenho mais uma opção 👇", "Esta também pode encaixar:"],
  en: ["I have one more option 👇", "This one could work too:"],
  it: ["Ne ho un'altra 👇", "Anche questa potrebbe andare:"],
  es: ["Tengo otra opción 👇", "Esta también podría encajar:"],
});

/** Phase 1 (AI_QUALITY_V2): warmer intros without robotic openers. */
const FIRST_RECOMMENDATION_CATALOG_INTROS_V2 = completeLanguageRecord({
  pt: [
    "Separei algumas opções que encaixam no que procura 👇",
    "Estas podem fazer sentido para o seu perfil 👇",
    "Encontrei algumas que batem certo com o que pediu 👇",
    "Vale a pena ver estas 👇",
  ],
  en: [
    "I picked a few options that fit what you're looking for 👇",
    "These might work for your brief 👇",
    "A few places that line up with what you asked 👇",
    "Worth a look 👇",
  ],
  it: [
    "Ho selezionato alcune opzioni in linea con quello che cerchi 👇",
    "Queste potrebbero fare al caso tuo 👇",
    "Alcune opzioni che potrebbero interessarti 👇",
    "Dà un'occhiata a queste 👇",
  ],
  es: [
    "He separado algunas opciones que encajan contigo 👇",
    "Estas podrían encajar con lo que buscas 👇",
    "Unas opciones que cuadran con tu perfil 👇",
    "Mira si alguna te encaja 👇",
  ],
});

const FIRST_RECOMMENDATION_SINGLE_INTROS_V2 = completeLanguageRecord({
  pt: [
    "Tenho uma opção que encaixa no que procura 👇",
    "Esta pode fazer sentido para si 👇",
    "Esta parece bater certo com o que pediu 👇",
  ],
  en: [
    "I found one option that fits what you're looking for 👇",
    "This might be a good fit 👇",
    "This one lines up with your brief 👇",
  ],
  it: [
    "Ho un'opzione che potrebbe interessarti 👇",
    "Questa potrebbe fare al caso tuo 👇",
    "Questa sembra in linea con quello che cerchi 👇",
  ],
  es: [
    "Tengo una opción que encaja con lo que buscas 👇",
    "Esta podría encajarte 👇",
    "Esta cuadra bastante bien con tu perfil 👇",
  ],
});

const MORE_OPTIONS_CATALOG_INTROS_V2 = completeLanguageRecord({
  pt: [
    "Mais algumas no mesmo perfil 👇",
    "Estas também podem encaixar 👇",
    "Vale a pena ver estas também 👇",
  ],
  en: [
    "A few more in the same profile 👇",
    "These also fit the brief 👇",
    "More worth a look 👇",
  ],
  it: [
    "Altre nello stesso profilo 👇",
    "Anche queste potrebbero interessarti 👇",
    "Altre da vedere 👇",
  ],
  es: [
    "Algunas más en el mismo perfil 👇",
    "Estas también encajan 👇",
    "Más que merecen la pena 👇",
  ],
});

const MORE_OPTIONS_SINGLE_INTROS_V2 = completeLanguageRecord({
  pt: ["Mais uma no mesmo perfil 👇", "Esta também pode encaixar 👇"],
  en: ["One more in the same profile 👇", "This one could work too 👇"],
  it: ["Un'altra nello stesso profilo 👇", "Anche questa potrebbe andare 👇"],
  es: ["Otra en el mismo perfil 👇", "Esta también podría encajar 👇"],
});

const RESHOW_CATALOG_INTROS_V2 = completeLanguageRecord({
  pt: [
    "Claro — volto a enviar 👇",
    "Aqui estão outra vez 👇",
    "Sem problema — mando outra vez 👇",
  ],
  en: [
    "Sure — sending them again 👇",
    "Here they are again 👇",
    "No problem — resending now 👇",
  ],
  it: [
    "Certo — te le rimando 👇",
    "Ecco di nuovo 👇",
    "Nessun problema — te le reinvio 👇",
  ],
  es: [
    "Claro — te las reenvío 👇",
    "Aquí están otra vez 👇",
    "Sin problema — te las mando de nuevo 👇",
  ],
});

const RESHOW_SINGLE_INTROS_V2 = completeLanguageRecord({
  pt: ["Volto a enviar 👇", "Aqui está outra vez 👇"],
  en: ["Sending it again 👇", "Here it is again 👇"],
  it: ["Te la rimando 👇", "Ecco di nuovo 👇"],
  es: ["Te la reenvío 👇", "Aquí está otra vez 👇"],
});

export function getFirstRecommendationCatalogIntros(
  language: SupportedLanguage
): string[] {
  return isAiQualityV2Enabled()
    ? FIRST_RECOMMENDATION_CATALOG_INTROS_V2[language]
    : FIRST_RECOMMENDATION_CATALOG_INTROS[language];
}

export function getFirstRecommendationSingleIntros(
  language: SupportedLanguage
): string[] {
  return isAiQualityV2Enabled()
    ? FIRST_RECOMMENDATION_SINGLE_INTROS_V2[language]
    : FIRST_RECOMMENDATION_SINGLE_INTROS[language];
}

export function getMoreOptionsCatalogIntros(
  language: SupportedLanguage
): string[] {
  return isAiQualityV2Enabled()
    ? MORE_OPTIONS_CATALOG_INTROS_V2[language]
    : MORE_OPTIONS_CATALOG_INTROS[language];
}

export function getMoreOptionsSingleIntros(
  language: SupportedLanguage
): string[] {
  return isAiQualityV2Enabled()
    ? MORE_OPTIONS_SINGLE_INTROS_V2[language]
    : MORE_OPTIONS_SINGLE_INTROS[language];
}

export function getReshowCatalogIntros(language: SupportedLanguage): string[] {
  return isAiQualityV2Enabled()
    ? RESHOW_CATALOG_INTROS_V2[language]
    : RESHOW_CATALOG_INTROS[language];
}

export function getReshowSingleIntros(language: SupportedLanguage): string[] {
  return isAiQualityV2Enabled()
    ? RESHOW_SINGLE_INTROS_V2[language]
    : RESHOW_SINGLE_INTROS[language];
}

export const LISTING_LABELS = completeLanguageRecord({
  pt: "🔗 Ver detalhes",
  en: "🔗 View details",
  it: "🔗 Vedi dettagli",
  es: "🔗 Ver detalles",
});

export const PROPERTY_CARD_LABELS = completeLanguageRecord({
  pt: {
    bedroom: "quarto",
    bedrooms: "quartos",
    bathroom: "casa de banho",
    bathrooms: "casas de banho",
  },
  en: {
    bedroom: "bedroom",
    bedrooms: "bedrooms",
    bathroom: "bathroom",
    bathrooms: "bathrooms",
  },
  it: {
    bedroom: "camera",
    bedrooms: "camere",
    bathroom: "bagno",
    bathrooms: "bagni",
  },
  es: {
    bedroom: "habitación",
    bedrooms: "habitaciones",
    bathroom: "baño",
    bathrooms: "baños",
  },
});

export const VISIT_CONFIRMED = completeLanguageRecord<{
  withWhen: (when: string) => string;
  generic: string;
}>({
  pt: {
    withWhen: (when) => `Perfeito 👌 Ficou marcado para ${when}.`,
    generic: "Perfeito 👌 Visita confirmada.",
  },
  en: {
    withWhen: (when) => `Perfect 👌 It's booked for ${when}.`,
    generic: "Perfect 👌 Visit confirmed.",
  },
  it: {
    withWhen: (when) => `Perfetto 👌 Visita confermata per ${when}.`,
    generic: "Perfetto 👌 Visita confermata.",
  },
  es: {
    withWhen: (when) => `Perfecto 👌 Quedó agendada para ${when}.`,
    generic: "Perfecto 👌 Visita confirmada.",
  },
});

export const VISIT_CANCELLED = completeLanguageRecord<(slotClause: string) => string>({
  pt: (slot) =>
    `Esse horário${slot} já não dá infelizmente 🙏 Tens outra data que te dê jeito?`,
  en: (slot) =>
    `That slot${slot} no longer works unfortunately 🙏 Do you have another time?`,
  it: (slot) =>
    `Quell'orario${slot} purtroppo non va più 🙏 Hai un'altra data comoda?`,
  es: (slot) =>
    `Ese horario${slot} ya no funciona 🙏 ¿Tienes otra fecha que te venga bien?`,
});

export const VISIT_CONFLICT_FALLBACK_SLOT = completeLanguageRecord({
  pt: "outro horário na mesma semana",
  en: "another time the same week",
  it: "un altro orario nella stessa settimana",
  es: "otro horario en la misma semana",
});

export const VISIT_CONFLICT = completeLanguageRecord({
  pt: (suggested) => `Esse horário já não dá 🙏 Consegues ${suggested}?`,
  en: (suggested) => `That slot is taken 🙏 Could you do ${suggested}?`,
  it: (suggested) => `Quell'orario è occupato 🙏 Ti va ${suggested}?`,
  es: (suggested) => `Ese horario ya está ocupado 🙏 ¿Te va ${suggested}?`,
});

const FOLLOW_UP_AREA = completeLanguageRecord({
  pt: "essa zona",
  en: "that area",
  it: "quella zona",
  es: "esa zona",
});

const FOLLOW_UP_PROPERTY = completeLanguageRecord({
  pt: "o imóvel",
  en: "the property",
  it: "l'immobile",
  es: "el inmueble",
});

function areaLabel(language: SupportedLanguage, ctx: FollowUpContextSnapshot): string {
  return ctx.city?.trim() || FOLLOW_UP_AREA[language];
}

function propertyLabel(
  language: SupportedLanguage,
  ctx: FollowUpContextSnapshot
): string {
  return (
    ctx.property_title?.trim() ||
    ctx.shown_property_titles?.at(-1)?.trim() ||
    FOLLOW_UP_PROPERTY[language]
  );
}

type FollowUpVariantFn = (ctx: FollowUpContextSnapshot) => string;
type FollowUpVariantMap = Record<FollowUpType, FollowUpVariantFn[]>;

const FOLLOW_UP_VARIANTS = completeLanguageRecord<FollowUpVariantMap>({
  pt: {
    property_recommended: [
      (ctx) =>
        `Conseguiu dar uma vista de olhos ${propertyLabel("pt", ctx) === FOLLOW_UP_PROPERTY.pt ? "nas opções" : `em ${propertyLabel("pt", ctx)}`}?`,
      (ctx) =>
        `O que achou ${propertyLabel("pt", ctx) === FOLLOW_UP_PROPERTY.pt ? "das sugestões" : `de ${propertyLabel("pt", ctx)}`}?`,
    ],
    silent_lead: [
      (ctx) => `Ainda procura algo em ${areaLabel("pt", ctx)}? Tenho algumas ideias se quiser.`,
      () => "Se quiser retomar, digo-lhe já o que tenho disponível 👌",
    ],
    visit_pending: [
      (ctx) => `Sobre a visita a ${propertyLabel("pt", ctx)} — assim que confirmar o horário, aviso logo.`,
      () => "Estou a ver a disponibilidade para a visita. Prefere manhã ou tarde?",
    ],
    visit_completed: [
      (ctx) => `Conseguiu visitar ${propertyLabel("pt", ctx)}? O que achou?`,
      () => "Depois da visita, ficou com vontade de avançar ou prefere ver mais opções?",
    ],
    new_match: [
      (ctx) =>
        `Entretanto apareceu uma opção nova que pode encaixar melhor 👌${ctx.new_property_title ? ` — ${ctx.new_property_title}` : ""}`,
      (ctx) => `Surgeu algo em ${areaLabel("pt", ctx)} que pode fazer sentido. Quer ver?`,
    ],
  },
  en: {
    property_recommended: [
      (ctx) => `Did you get a chance to look at ${propertyLabel("en", ctx)}?`,
      () => "What did you think of the options I sent?",
    ],
    silent_lead: [
      (ctx) => `Still looking in ${areaLabel("en", ctx)}? I have a few ideas if you want.`,
      () => "If you want to pick this up again, I can send what's available 👌",
    ],
    visit_pending: [
      (ctx) => `About the visit to ${propertyLabel("en", ctx)} — I'll confirm the time shortly.`,
      () => "I'm checking availability for the visit. Do you prefer morning or afternoon?",
    ],
    visit_completed: [
      (ctx) => `How did the visit to ${propertyLabel("en", ctx)} go?`,
      () => "After the visit, do you want to move forward or see more options?",
    ],
    new_match: [
      (ctx) =>
        `A new option came up that could fit better 👌${ctx.new_property_title ? ` — ${ctx.new_property_title}` : ""}`,
      (ctx) => `Something new in ${areaLabel("en", ctx)} might work. Want to see it?`,
    ],
  },
  it: {
    property_recommended: [
      (ctx) => `Sei riuscito/a a dare un'occhiata a ${propertyLabel("it", ctx)}?`,
      () => "Cosa ne pensi delle opzioni che ti ho mandato?",
    ],
    silent_lead: [
      (ctx) => `Stai ancora cercando in ${areaLabel("it", ctx)}? Ho qualche idea se vuoi.`,
      () => "Se vuoi riprendere, ti mando subito cosa ho disponibile 👌",
    ],
    visit_pending: [
      (ctx) => `Per la visita a ${propertyLabel("it", ctx)} — ti confermo l'orario appena possibile.`,
      () => "Sto controllando la disponibilità. Preferisci mattina o pomeriggio?",
    ],
    visit_completed: [
      (ctx) => `Com'è andata la visita a ${propertyLabel("it", ctx)}?`,
      () => "Dopo la visita, vuoi procedere o vedere altre opzioni?",
    ],
    new_match: [
      (ctx) =>
        `Nel frattempo è arrivata una nuova opzione interessante 👌${ctx.new_property_title ? ` — ${ctx.new_property_title}` : ""}`,
      (ctx) => `C'è una novità in ${areaLabel("it", ctx)} che potrebbe fare al caso tuo. Vuoi vederla?`,
    ],
  },
  es: {
    property_recommended: [
      (ctx) => `¿Pudiste echar un vistazo a ${propertyLabel("es", ctx)}?`,
      () => "¿Qué te parecieron las opciones que te envié?",
    ],
    silent_lead: [
      (ctx) => `¿Sigues buscando en ${areaLabel("es", ctx)}? Tengo algunas ideas si quieres.`,
      () => "Si quieres retomarlo, te mando lo que tengo disponible 👌",
    ],
    visit_pending: [
      (ctx) => `Sobre la visita a ${propertyLabel("es", ctx)} — te confirmo la hora en cuanto pueda.`,
      () => "Estoy revisando disponibilidad. ¿Prefieres mañana o tarde?",
    ],
    visit_completed: [
      (ctx) => `¿Cómo fue la visita a ${propertyLabel("es", ctx)}?`,
      () => "Después de la visita, ¿quieres avanzar o ver más opciones?",
    ],
    new_match: [
      (ctx) =>
        `Apareció una opción nueva que puede encajar mejor 👌${ctx.new_property_title ? ` — ${ctx.new_property_title}` : ""}`,
      (ctx) => `Hay una novedad en ${areaLabel("es", ctx)} que puede interesarte. ¿Quieres verla?`,
    ],
  },
});

export function getClosingReplies(language: SupportedLanguage): string[] {
  return CLOSING_REPLIES[language];
}

export function getClosingMarkers(language: SupportedLanguage): string[] {
  return CLOSING_MARKERS[language];
}

export function getExhaustedMatchLines(language: SupportedLanguage): string[] {
  return EXHAUSTED_MATCH_LINES[language];
}

export function buildReshowIntroText(
  language: SupportedLanguage,
  seed: string,
  propertyCount: number
): string {
  const variants =
    propertyCount === 1
      ? getReshowSingleIntros(language)
      : getReshowCatalogIntros(language);
  return variants[hashPick(seed, variants.length)];
}

export function generateLocalizedFollowUpMessage(
  language: SupportedLanguage,
  type: FollowUpType,
  context: FollowUpContextSnapshot,
  seed: string
): string {
  const variants = FOLLOW_UP_VARIANTS[language][type];
  const index = hashPick(`${seed}:${type}:${language}`, variants.length);
  return variants[index](context);
}

export const BANNED_WITHOUT_FRESH_QUERY = completeLanguageRecord({
  pt: [
    /por agora estas são as melhores/i,
    /se entrar algo novo, aviso/i,
    /não tenho mais opções/i,
  ],
  en: [
    /best matches for your profile/i,
    /something new comes in/i,
    /no more options/i,
  ],
  it: [
    /migliori opzioni nel tuo profilo/i,
    /ne arriva una nuova/i,
    /non ho altre opzioni/i,
  ],
  es: [
    /mejores opciones para tu perfil/i,
    /entra algo nuevo/i,
    /no tengo más opciones/i,
  ],
});

export const BANNED_ON_THANKS = completeLanguageRecord({
  pt: [/se entrar algo novo/i, /por agora estas são as melhores/i, /visita/i],
  en: [/something new comes in/i, /best matches/i, /visit/i],
  it: [/qualcosa di nuovo/i, /migliori opzioni/i, /visita/i],
  es: [/algo nuevo/i, /mejores opciones/i, /visita/i],
});

export const BANNED_DEFERRAL = completeLanguageRecord({
  pt: [
    /vou verificar/i,
    /deixa-me ver/i,
    /deixe-me ver/i,
    /j[aá] te digo/i,
    /vou confirmar/i,
    /vou procurar/i,
    /vou atualizar/i,
  ],
  en: [
    /i['']ll check/i,
    /let me check/i,
    /i will check/i,
    /i['']ll look/i,
    /get back to you/i,
    /i['']ll update you/i,
  ],
  it: [
    /verifico/i,
    /controllo/i,
    /ti faccio sapere/i,
    /ti aggiorno/i,
  ],
  es: [
    /voy a verificar/i,
    /déjame ver/i,
    /dejame ver/i,
    /te confirmo/i,
    /te aviso/i,
  ],
});

export const NO_MATCH_LINES = completeLanguageRecord({
  pt: [
    "Neste perfil não encontrei nada de momento — se alargarmos zona ou orçamento, vejo já.",
    "Por agora nada encaixa neste perfil. Quer ajustar algum critério?",
  ],
  en: [
    "Nothing matched this profile right now — happy to widen the search if you want.",
    "No exact matches for this brief at the moment.",
  ],
  it: [
    "Al momento non ho nulla in questo profilo — se vuoi allargare zona o budget, guardo subito.",
    "Per ora nessun match preciso con questi criteri.",
  ],
  es: [
    "Por ahora no hay nada que encaje con este perfil — si ampliamos zona o presupuesto, lo miro.",
    "De momento no encuentro matches exactos con estos criterios.",
  ],
});

export function getNoMatchLine(
  language: SupportedLanguage,
  seed: string
): string {
  const lines = NO_MATCH_LINES[language];
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return lines[hash % lines.length];
}

export const AI_LANGUAGE_INSTRUCTION = completeLanguageRecord({
  pt: "Responda SEMPRE em português de Portugal — 100% da mensagem, sem exceções. Tom natural de consultor imobiliário premium. PROIBIDO misturar espanhol, italiano ou inglês. Nunca use palavras como perfecto, gracias, thanks, ciao ou grazie.",
  en: "ALWAYS reply in English — the entire message, no exceptions. Natural premium real estate consultant tone. NEVER mix Portuguese, Spanish, or Italian. Do not use words like perfeito, gracias, ciao, or obrigado.",
  it: "Rispondi SEMPRE in italiano — l'intero messaggio, senza eccezioni. Tono naturale da consulente immobiliare premium. VIETATO mescolare portoghese, spagnolo o inglese. Non usare parole come perfecto, gracias, thanks o obrigado.",
  es: "Responde SIEMPRE en español — todo el mensaje, sin excepciones. Tono natural de consultor inmobiliario premium. PROHIBIDO mezclar portugués, italiano o inglés. No uses palabras como perfeito, obrigado, thanks o ciao.",
});

export const LEAD_CONTEXT_LABELS = completeLanguageRecord({
  pt: {
    name: "Nome do cliente",
    interest: "Interesse inicial",
    phone: "Telefone",
    status: "Estado do lead",
    budget: "Orçamento",
    area: "Zona preferida",
    type: "Tipo de imóvel",
    timeline: "Prazo",
    visitHistory: "Pedido de visita (histórico CRM)",
    visitWhen: "Data/hora visita (histórico)",
    memoryNote:
      "Memória persistente: contexto de apoio apenas. Responda sobretudo à última mensagem do cliente.",
    noHistory: "Nenhuma mensagem anterior.",
    client: "Cliente",
    assistant: "Assistente",
    agent: "Consultor",
  },
  en: {
    name: "Client name",
    interest: "Initial interest",
    phone: "Phone",
    status: "Lead status",
    budget: "Budget",
    area: "Preferred area",
    type: "Property type",
    timeline: "Timeline",
    visitHistory: "Visit request (CRM history)",
    visitWhen: "Visit date/time (history)",
    memoryNote:
      "Persistent memory is supporting context only. Reply primarily to the client's latest message.",
    noHistory: "No previous messages.",
    client: "Client",
    assistant: "Assistant",
    agent: "Agent",
  },
  it: {
    name: "Nome cliente",
    interest: "Interesse iniziale",
    phone: "Telefono",
    status: "Stato lead",
    budget: "Budget",
    area: "Zona preferita",
    type: "Tipo di immobile",
    timeline: "Tempistiche",
    visitHistory: "Richiesta visita (storico CRM)",
    visitWhen: "Data/ora visita (storico)",
    memoryNote:
      "La memoria persistente è solo contesto di supporto. Rispondi soprattutto all'ultimo messaggio del cliente.",
    noHistory: "Nessun messaggio precedente.",
    client: "Cliente",
    assistant: "Assistente",
    agent: "Consulente",
  },
  es: {
    name: "Nombre del cliente",
    interest: "Interés inicial",
    phone: "Teléfono",
    status: "Estado del lead",
    budget: "Presupuesto",
    area: "Zona preferida",
    type: "Tipo de inmueble",
    timeline: "Plazo",
    visitHistory: "Solicitud de visita (histórico CRM)",
    visitWhen: "Fecha/hora visita (histórico)",
    memoryNote:
      "La memoria persistente es solo contexto de apoyo. Responde sobre todo al último mensaje del cliente.",
    noHistory: "Sin mensajes anteriores.",
    client: "Cliente",
    assistant: "Asistente",
    agent: "Agente",
  },
});

export const CATALOG_COMPARISON_PROMPTS = completeLanguageRecord({
  pt: `Escreve 1–2 linhas curtas em português de Portugal. Referencia as opções como "A primeira", "A segunda". Sem perguntas.`,
  en: `Write 1–2 short lines in English. Reference listings as "The first one", "The second one". No questions.`,
  it: `Scrivi 1–2 righe brevi in italiano. Riferisci le opzioni come "La prima", "La seconda". Nessuna domanda.`,
  es: `Escribe 1–2 líneas cortas en español. Referencia las opciones como "La primera", "La segunda". Sin preguntas.`,
});

export function getRecentClientContextLabel(language: SupportedLanguage): string {
  const labels = completeLanguageRecord({
    pt: "Sem mensagens recentes do cliente.",
    en: "No recent client messages.",
    it: "Nessun messaggio recente del cliente.",
    es: "Sin mensajes recientes del cliente.",
});
  return labels[language];
}

export function getRecentClientContextHeader(language: SupportedLanguage): string {
  const labels = completeLanguageRecord({
    pt: "Últimas mensagens do cliente:",
    en: "Recent client messages:",
    it: "Ultimi messaggi del cliente:",
    es: "Últimos mensajes del cliente:",
});
  return labels[language];
}

const COMPARISON_ORDINALS = completeLanguageRecord({
  pt: ["A primeira", "A segunda", "A terceira", "A quarta"],
  en: ["The first one", "The second one", "The third one", "The fourth one"],
  it: ["La prima", "La seconda", "La terza", "La quarta"],
  es: ["La primera", "La segunda", "La tercera", "La cuarta"],
});

export function getComparisonOrdinal(
  language: SupportedLanguage,
  index: number
): string {
  const ordinals = COMPARISON_ORDINALS[language];
  return ordinals[index] ?? `${index + 1}`;
}

export const CATALOG_CONTEXT_LABELS = completeLanguageRecord({
  pt: {
    listingsHeader: "Listagens enviadas (por ordem):",
    preferencesHeader: "Preferências do cliente (CRM + conversa):",
    noPreferences: "nenhuma preferência explícita detectada",
    budget: "Orçamento",
    area: "Zona",
    type: "Tipo",
    bedrooms: "quartos",
    bathrooms: "wc",
  },
  en: {
    listingsHeader: "Listings sent (in order):",
    preferencesHeader: "Client preferences (CRM + chat):",
    noPreferences: "no explicit preferences detected",
    budget: "Budget",
    area: "Area",
    type: "Type",
    bedrooms: "bedrooms",
    bathrooms: "bathrooms",
  },
  it: {
    listingsHeader: "Annunci inviati (in ordine):",
    preferencesHeader: "Preferenze del cliente (CRM + chat):",
    noPreferences: "nessuna preferenza esplicita rilevata",
    budget: "Budget",
    area: "Zona",
    type: "Tipo",
    bedrooms: "camere",
    bathrooms: "bagni",
  },
  es: {
    listingsHeader: "Anuncios enviados (en orden):",
    preferencesHeader: "Preferencias del cliente (CRM + chat):",
    noPreferences: "ninguna preferencia explícita detectada",
    budget: "Presupuesto",
    area: "Zona",
    type: "Tipo",
    bedrooms: "habitaciones",
    bathrooms: "baños",
  },
});

type HeuristicComparisonKey =
  | "balanced_space"
  | "balanced_price"
  | "premium_garden_modern"
  | "premium_garden"
  | "premium_profile"
  | "pref_garden"
  | "pref_modern"
  | "pref_central"
  | "pref_family"
  | "pref_investment"
  | "spacious"
  | "fits_profile"
  | "solid_alternative";

export function getHeuristicComparisonLine(
  language: SupportedLanguage,
  key: HeuristicComparisonKey,
  ordinal: string
): string {
  const lines = HEURISTIC_COMPARISON_LINES[language];
  return lines[key](ordinal);
}

const HEURISTIC_COMPARISON_LINES = completeLanguageRecord<
  Record<HeuristicComparisonKey, (ordinal: string) => string>
>({
    pt: {
      balanced_space: (o) => `${o} parece mais equilibrada pelo espaço interior.`,
      balanced_price: (o) => `${o} parece mais equilibrada pelo preço.`,
      premium_garden_modern: (o) =>
        `${o} destaca-se mais pelo jardim e estilo moderno.`,
      premium_garden: (o) => `${o} destaca-se mais pelo jardim.`,
      premium_profile: (o) => `${o} tem um perfil mais premium.`,
      pref_garden: (o) => `${o} pode fazer mais sentido se valoriza espaço exterior.`,
      pref_modern: (o) => `${o} encaixa melhor para quem quer algo mais moderno.`,
      pref_central: (o) => `${o} destaca-se pela localização mais central.`,
      pref_family: (o) => `${o} parece a mais indicada para família — mais espaço.`,
      pref_investment: (o) => `${o} pode ser interessante a nível de investimento.`,
      spacious: (o) => `${o} destaca-se pelo espaço.`,
      fits_profile: (o) => `${o} encaixa bem no perfil.`,
      solid_alternative: (o) => `${o} é uma alternativa sólida.`,
    },
    en: {
      balanced_space: (o) => `${o} looks more balanced on interior space.`,
      balanced_price: (o) => `${o} looks more balanced on price.`,
      premium_garden_modern: (o) =>
        `${o} stands out more for the garden and modern style.`,
      premium_garden: (o) => `${o} stands out more for the garden.`,
      premium_profile: (o) => `${o} has a more premium profile.`,
      pref_garden: (o) => `${o} may make more sense if you value outdoor space.`,
      pref_modern: (o) => `${o} fits better if you want something more modern.`,
      pref_central: (o) => `${o} stands out for the more central location.`,
      pref_family: (o) => `${o} seems best for a family — more space.`,
      pref_investment: (o) => `${o} could be interesting from an investment angle.`,
      spacious: (o) => `${o} stands out for space.`,
      fits_profile: (o) => `${o} fits the brief well.`,
      solid_alternative: (o) => `${o} is a solid alternative.`,
    },
    it: {
      balanced_space: (o) => `${o} sembra più equilibrata sugli spazi interni.`,
      balanced_price: (o) => `${o} sembra più equilibrata sul prezzo.`,
      premium_garden_modern: (o) =>
        `${o} spicca di più per giardino e stile moderno.`,
      premium_garden: (o) => `${o} spicca di più per il giardino.`,
      premium_profile: (o) => `${o} ha un profilo più premium.`,
      pref_garden: (o) => `${o} ha più senso se valorizzi lo spazio esterno.`,
      pref_modern: (o) => `${o} è più adatta se cerchi qualcosa di moderno.`,
      pref_central: (o) => `${o} spicca per la posizione più centrale.`,
      pref_family: (o) => `${o} sembra la più adatta per famiglia — più spazio.`,
      pref_investment: (o) => `${o} può essere interessante come investimento.`,
      spacious: (o) => `${o} spicca per gli spazi.`,
      fits_profile: (o) => `${o} encaixa bene nel profilo.`,
      solid_alternative: (o) => `${o} è un'alternativa solida.`,
    },
    es: {
      balanced_space: (o) => `${o} parece más equilibrada en espacio interior.`,
      balanced_price: (o) => `${o} parece más equilibrada en precio.`,
      premium_garden_modern: (o) =>
        `${o} destaca más por el jardín y el estilo moderno.`,
      premium_garden: (o) => `${o} destaca más por el jardín.`,
      premium_profile: (o) => `${o} tiene un perfil más premium.`,
      pref_garden: (o) => `${o} encaja mejor si valoras espacio exterior.`,
      pref_modern: (o) => `${o} encaja mejor si buscas algo más moderno.`,
      pref_central: (o) => `${o} destaca por la ubicación más céntrica.`,
      pref_family: (o) => `${o} parece la más indicada para familia — más espacio.`,
      pref_investment: (o) => `${o} puede ser interesante a nivel inversión.`,
      spacious: (o) => `${o} destaca por el espacio.`,
      fits_profile: (o) => `${o} encaja bien en el perfil.`,
      solid_alternative: (o) => `${o} es una alternativa sólida.`,
    },
});
