import type { FollowUpContextSnapshot, FollowUpType } from "@/types/database";
import type { SupportedLanguage } from "@/lib/i18n/types";

function hashPick(seed: string, count: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return count > 0 ? hash % count : 0;
}

export const CLOSING_MARKERS: Record<SupportedLanguage, string[]> = {
  pt: ["fico por aqui", "é só chamar", "se precisar de mais alguma coisa"],
  en: ["i'll be here", "just reach out", "if you need anything"],
  it: ["resto a disposizione", "scrivimi pure", "se ti serve altro"],
  es: ["quedo atento", "escríbeme", "si necesitas algo"],
};

export const CLOSING_REPLIES: Record<SupportedLanguage, string[]> = {
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
};

export const EXHAUSTED_MATCH_LINES: Record<SupportedLanguage, string[]> = {
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
};

export const RESHOW_CATALOG_INTROS: Record<SupportedLanguage, string[]> = {
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
};

export const RESHOW_SINGLE_INTROS: Record<SupportedLanguage, string[]> = {
  pt: ["Claro — esta era a opção 👇", "Volto a enviar 👇"],
  en: ["Sure — this was the option 👇", "Sending it again 👇"],
  it: ["Certo — era questa l'opzione 👇", "Te la rimando 👇"],
  es: ["Claro — era esta opción 👇", "Te la reenvío 👇"],
};

export const LISTING_LABELS: Record<SupportedLanguage, string> = {
  pt: "🔗 Ver detalhes",
  en: "🔗 View details",
  it: "🔗 Vedi dettagli",
  es: "🔗 Ver detalles",
};

export const PROPERTY_CARD_LABELS: Record<
  SupportedLanguage,
  { bedroom: string; bedrooms: string; bathroom: string; bathrooms: string }
> = {
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
};

export const VISIT_CONFIRMED: Record<
  SupportedLanguage,
  { withWhen: (when: string) => string; generic: string }
> = {
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
};

export const VISIT_CANCELLED: Record<
  SupportedLanguage,
  (slotClause: string) => string
> = {
  pt: (slot) =>
    `Esse horário${slot} já não dá infelizmente 🙏 Tens outra data que te dê jeito?`,
  en: (slot) =>
    `That slot${slot} no longer works unfortunately 🙏 Do you have another time?`,
  it: (slot) =>
    `Quell'orario${slot} purtroppo non va più 🙏 Hai un'altra data comoda?`,
  es: (slot) =>
    `Ese horario${slot} ya no funciona 🙏 ¿Tienes otra fecha que te venga bien?`,
};

export const VISIT_CONFLICT: Record<SupportedLanguage, (suggested: string) => string> = {
  pt: (suggested) => `Esse horário já não dá 🙏 Consegues ${suggested}?`,
  en: (suggested) => `That slot is taken 🙏 Could you do ${suggested}?`,
  it: (suggested) => `Quell'orario è occupato 🙏 Ti va ${suggested}?`,
  es: (suggested) => `Ese horario ya está ocupado 🙏 ¿Te va ${suggested}?`,
};

const FOLLOW_UP_AREA: Record<SupportedLanguage, string> = {
  pt: "essa zona",
  en: "that area",
  it: "quella zona",
  es: "esa zona",
};

const FOLLOW_UP_PROPERTY: Record<SupportedLanguage, string> = {
  pt: "o imóvel",
  en: "the property",
  it: "l'immobile",
  es: "el inmueble",
};

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

const FOLLOW_UP_VARIANTS: Record<
  SupportedLanguage,
  Record<FollowUpType, ((ctx: FollowUpContextSnapshot) => string)[]>
> = {
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
};

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
      ? RESHOW_SINGLE_INTROS[language]
      : RESHOW_CATALOG_INTROS[language];
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

export const BANNED_WITHOUT_FRESH_QUERY: Record<SupportedLanguage, RegExp[]> = {
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
};

export const BANNED_ON_THANKS: Record<SupportedLanguage, RegExp[]> = {
  pt: [/se entrar algo novo/i, /por agora estas são as melhores/i, /visita/i],
  en: [/something new comes in/i, /best matches/i, /visit/i],
  it: [/qualcosa di nuovo/i, /migliori opzioni/i, /visita/i],
  es: [/algo nuevo/i, /mejores opciones/i, /visita/i],
};

export const BANNED_DEFERRAL: Record<SupportedLanguage, RegExp[]> = {
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
};

export const NO_MATCH_LINES: Record<SupportedLanguage, string[]> = {
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
};

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

export const AI_LANGUAGE_INSTRUCTION: Record<SupportedLanguage, string> = {
  pt: "Responda SEMPRE em português de Portugal. Tom natural de consultor imobiliário premium. Nunca misture idiomas na mesma mensagem.",
  en: "ALWAYS reply in English. Natural premium real estate consultant tone. Never mix languages in the same message.",
  it: "Rispondi SEMPRE in italiano. Tono naturale da consulente immobiliare premium. Non mescolare mai le lingue nello stesso messaggio.",
  es: "Responde SIEMPRE en español. Tono natural de consultor inmobiliario premium. Nunca mezcles idiomas en el mismo mensaje.",
};

export const LEAD_CONTEXT_LABELS: Record<
  SupportedLanguage,
  {
    name: string;
    interest: string;
    phone: string;
    status: string;
    budget: string;
    area: string;
    type: string;
    timeline: string;
    visitHistory: string;
    visitWhen: string;
    memoryNote: string;
    noHistory: string;
    client: string;
    assistant: string;
    agent: string;
  }
> = {
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
};

export const CATALOG_COMPARISON_PROMPTS: Record<SupportedLanguage, string> = {
  pt: `Escreve 1–2 linhas curtas em português de Portugal. Referencia as opções como "A primeira", "A segunda". Sem perguntas.`,
  en: `Write 1–2 short lines in English. Reference listings as "The first one", "The second one". No questions.`,
  it: `Scrivi 1–2 righe brevi in italiano. Riferisci le opzioni come "La prima", "La seconda". Nessuna domanda.`,
  es: `Escribe 1–2 líneas cortas en español. Referencia las opciones como "La primera", "La segunda". Sin preguntas.`,
};

export function getRecentClientContextLabel(language: SupportedLanguage): string {
  const labels: Record<SupportedLanguage, string> = {
    pt: "Sem mensagens recentes do cliente.",
    en: "No recent client messages.",
    it: "Nessun messaggio recente del cliente.",
    es: "Sin mensajes recientes del cliente.",
  };
  return labels[language];
}

export function getRecentClientContextHeader(language: SupportedLanguage): string {
  const labels: Record<SupportedLanguage, string> = {
    pt: "Últimas mensagens do cliente:",
    en: "Recent client messages:",
    it: "Ultimi messaggi del cliente:",
    es: "Últimos mensajes del cliente:",
  };
  return labels[language];
}

const COMPARISON_ORDINALS: Record<SupportedLanguage, string[]> = {
  pt: ["A primeira", "A segunda", "A terceira", "A quarta"],
  en: ["The first one", "The second one", "The third one", "The fourth one"],
  it: ["La prima", "La seconda", "La terza", "La quarta"],
  es: ["La primera", "La segunda", "La tercera", "La cuarta"],
};

export function getComparisonOrdinal(
  language: SupportedLanguage,
  index: number
): string {
  const ordinals = COMPARISON_ORDINALS[language];
  return ordinals[index] ?? `${index + 1}`;
}

export const CATALOG_CONTEXT_LABELS: Record<
  SupportedLanguage,
  {
    listingsHeader: string;
    preferencesHeader: string;
    noPreferences: string;
    budget: string;
    area: string;
    type: string;
    bedrooms: string;
    bathrooms: string;
  }
> = {
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
};

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
  const lines: Record<
    SupportedLanguage,
    Record<HeuristicComparisonKey, (ordinal: string) => string>
  > = {
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
  };

  return lines[language][key](ordinal);
}
