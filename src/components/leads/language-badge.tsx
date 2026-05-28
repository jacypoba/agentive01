import { getLanguageBadge, getLanguageLabel, normalizeLanguage } from "@/lib/i18n/types";

type LanguageBadgeProps = {
  language: string | null | undefined;
  className?: string;
};

export function LanguageBadge({ language, className = "" }: LanguageBadgeProps) {
  const normalized = normalizeLanguage(language);

  return (
    <span
      title={getLanguageLabel(normalized)}
      className={`inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-white/60 ${className}`}
    >
      {getLanguageBadge(normalized)}
    </span>
  );
}
