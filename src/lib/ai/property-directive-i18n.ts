import { completeLanguageRecord, type SupportedLanguage } from "@/lib/i18n/types";

export type PropertyDirectiveExamples = {
  allShownReply: string;
  noMatchReply: string;
  reshowCatalogIntro: string;
  reshowSingleIntro: string;
  catalogIntroOptions: [string, string];
  singleIntro: string;
  hasMoreInProfile: string;
};

export const PROPERTY_DIRECTIVE_EXAMPLES = completeLanguageRecord<PropertyDirectiveExamples>({
  pt: {
    allShownReply:
      "Por agora estas são as melhores dentro do perfil. Se entrar algo novo, aviso.",
    noMatchReply: "Não encontrei imóveis neste perfil de momento.",
    reshowCatalogIntro: "Estas foram as opções 👇",
    reshowSingleIntro: "Volto a enviar 👇",
    catalogIntroOptions: ["Tenho mais algumas 👇", "Estas também encaixam."],
    singleIntro: "Tenho mais uma opção 👇",
    hasMoreInProfile: "Tenho mais no mesmo perfil",
  },
  en: {
    allShownReply:
      "For now these are the best matches for your profile. I'll let you know if something new comes in.",
    noMatchReply: "Nothing matched this profile right now.",
    reshowCatalogIntro: "Here are the options again 👇",
    reshowSingleIntro: "Sending it again 👇",
    catalogIntroOptions: ["I have a few more 👇", "These also fit the brief."],
    singleIntro: "I have one more option 👇",
    hasMoreInProfile: "I have more in the same profile",
  },
  it: {
    allShownReply:
      "Per ora queste sono le migliori opzioni nel tuo profilo. Ti avviso se ne arriva una nuova.",
    noMatchReply: "Al momento non ho trovato immobili per questo profilo.",
    reshowCatalogIntro: "Ecco di nuovo le opzioni 👇",
    reshowSingleIntro: "Te la rimando 👇",
    catalogIntroOptions: ["Ne ho altre 👇", "Anche queste potrebbero interessarti."],
    singleIntro: "Ne ho un'altra 👇",
    hasMoreInProfile: "Ne ho altre nello stesso profilo",
  },
  es: {
    allShownReply:
      "Por ahora estas son las mejores opciones para tu perfil. Te aviso si entra algo nuevo.",
    noMatchReply: "De momento no encontré inmuebles para este perfil.",
    reshowCatalogIntro: "Aquí están otra vez las opciones 👇",
    reshowSingleIntro: "Te la reenvío 👇",
    catalogIntroOptions: ["Tengo algunas más 👇", "Estas también encajan."],
    singleIntro: "Tengo otra opción 👇",
    hasMoreInProfile: "Tengo más en el mismo perfil",
  },
  fr: {
    allShownReply:
      "Pour l'instant ce sont les meilleures options pour votre profil. Je vous préviens si quelque chose de nouveau arrive.",
    noMatchReply: "Je n'ai rien trouvé pour ce profil pour le moment.",
    reshowCatalogIntro: "Voici à nouveau les options 👇",
    reshowSingleIntro: "Je vous la renvoie 👇",
    catalogIntroOptions: ["J'en ai quelques autres 👇", "Celles-ci conviennent aussi."],
    singleIntro: "J'ai une autre option 👇",
    hasMoreInProfile: "J'en ai d'autres dans le même profil",
  },
});

export function getPropertyDirectiveExamples(
  language: SupportedLanguage
): PropertyDirectiveExamples {
  return PROPERTY_DIRECTIVE_EXAMPLES[language];
}
