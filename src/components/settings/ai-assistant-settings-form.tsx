"use client";

import { useActionState, useMemo, useState } from "react";
import {
  saveAiSettingsAction,
  type AiSettingsState,
} from "@/app/actions/ai-settings";
import {
  getLanguageBadge,
  getLanguageLabel,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from "@/lib/i18n/types";
import type { WorkspaceAISettings, WorkspaceFaqItem } from "@/lib/workspace-settings/types";

type AiAssistantSettingsFormProps = {
  workspaceName: string;
  settings: WorkspaceAISettings;
  canEdit: boolean;
};

const initialState: AiSettingsState = {};

const inputClassName =
  "mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white placeholder:text-white/25 focus:border-[#0066FF]/50 focus:outline-none focus:ring-1 focus:ring-[#0066FF]/30";

const textareaClassName = `${inputClassName} min-h-[96px] resize-y`;

const labelClassName =
  "text-xs font-medium uppercase tracking-wider text-white/40";

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-white/45">{description}</p>
        </div>
      </div>
      <div className="mt-6 space-y-4">{children}</div>
    </section>
  );
}

export function AiAssistantSettingsForm({
  workspaceName,
  settings,
  canEdit,
}: AiAssistantSettingsFormProps) {
  const [state, formAction, isPending] = useActionState(
    saveAiSettingsAction,
    initialState
  );
  const [faqs, setFaqs] = useState<WorkspaceFaqItem[]>(settings.faqs);
  const [preferredLanguages, setPreferredLanguages] = useState<
    SupportedLanguage[]
  >(settings.preferredLanguages);
  const [defaultLanguage, setDefaultLanguage] = useState<SupportedLanguage>(
    settings.defaultLanguage
  );

  const faqsJson = useMemo(() => JSON.stringify(faqs), [faqs]);

  function toggleLanguage(language: SupportedLanguage) {
    setPreferredLanguages((current) => {
      if (current.includes(language)) {
        const next = current.filter((item) => item !== language);
        if (defaultLanguage === language && next.length > 0) {
          setDefaultLanguage(next[0]);
        }
        return next.length > 0 ? next : current;
      }
      return [...current, language];
    });
  }

  function addFaq() {
    setFaqs((current) => [...current, { question: "", answer: "" }]);
  }

  function updateFaq(index: number, field: keyof WorkspaceFaqItem, value: string) {
    setFaqs((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      )
    );
  }

  function removeFaq(index: number) {
    setFaqs((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[#0066FF]/20 bg-gradient-to-br from-[#0066FF]/10 via-transparent to-[#00D4FF]/5 px-5 py-4">
        <p className="text-xs font-medium uppercase tracking-wider text-[#00D4FF]">
          Active workspace
        </p>
        <p className="mt-1 text-lg font-semibold text-white">{workspaceName}</p>
        <p className="mt-2 text-sm text-white/45">
          These settings apply to AI replies and follow-ups for this workspace only.
        </p>
        {settings.updatedAt && (
          <p className="mt-2 text-xs text-white/30">
            Last saved {new Date(settings.updatedAt).toLocaleString()}
          </p>
        )}
      </div>

      {!canEdit && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-4 text-sm text-amber-200">
          You can view AI settings, but only workspace owners and admins can save changes.
        </div>
      )}

      {state.error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm text-red-200">
          {state.error}
        </div>
      )}

      {state.success && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-4 text-sm text-emerald-200">
          {state.success}
        </div>
      )}

      <form action={formAction} className="space-y-6">
        <input type="hidden" name="faqs_json" value={faqsJson} />

        <SectionCard
          title="Company profile"
          description="How the assistant introduces your agency and what it knows about your business."
        >
          <label className="block">
            <span className={labelClassName}>Company name</span>
            <input
              name="business_name"
              defaultValue={settings.businessName}
              placeholder="e.g. Agentive Estates"
              maxLength={120}
              disabled={!canEdit}
              className={inputClassName}
            />
          </label>

          <label className="block">
            <span className={labelClassName}>Business description</span>
            <textarea
              name="business_info"
              defaultValue={settings.businessInfo}
              placeholder="What you do, your positioning, and what makes you different."
              maxLength={2000}
              disabled={!canEdit}
              className={textareaClassName}
            />
          </label>

          <label className="block">
            <span className={labelClassName}>Areas served</span>
            <input
              name="areas_served"
              defaultValue={settings.areasServed}
              placeholder="e.g. Lisbon, Cascais, Sintra"
              maxLength={500}
              disabled={!canEdit}
              className={inputClassName}
            />
          </label>

          <label className="block">
            <span className={labelClassName}>Office hours</span>
            <textarea
              name="office_hours"
              defaultValue={settings.officeHours}
              placeholder="e.g. Mon–Fri 9:00–18:00, Sat by appointment"
              maxLength={500}
              disabled={!canEdit}
              className={textareaClassName}
            />
          </label>
        </SectionCard>

        <SectionCard
          title="Voice & personality"
          description="Shape how the assistant sounds on WhatsApp — from first hello to follow-up nudges."
        >
          <label className="block">
            <span className={labelClassName}>Tone of voice</span>
            <textarea
              name="tone_of_voice"
              defaultValue={settings.toneOfVoice}
              placeholder="e.g. Warm, premium, direct — like a trusted consultant texting a friend."
              maxLength={500}
              disabled={!canEdit}
              className={textareaClassName}
            />
          </label>

          <label className="block">
            <span className={labelClassName}>Greeting style</span>
            <textarea
              name="greeting_style"
              defaultValue={settings.greetingStyle}
              placeholder="e.g. Casual first hello, use first name once, no repeated greetings."
              maxLength={500}
              disabled={!canEdit}
              className={textareaClassName}
            />
          </label>

          <label className="block">
            <span className={labelClassName}>Follow-up style</span>
            <textarea
              name="follow_up_style"
              defaultValue={settings.followUpStyle}
              placeholder="e.g. Light check-in, never pushy, one emoji max, reference their last interest."
              maxLength={500}
              disabled={!canEdit}
              className={textareaClassName}
            />
          </label>
        </SectionCard>

        <SectionCard
          title="Languages"
          description="Languages your team serves. The assistant adapts per lead, using these as defaults."
        >
          <fieldset disabled={!canEdit}>
            <legend className={labelClassName}>Preferred languages</legend>
            <div className="mt-3 flex flex-wrap gap-2">
              {SUPPORTED_LANGUAGES.map((language) => {
                const selected = preferredLanguages.includes(language);
                return (
                  <label
                    key={language}
                    className={`cursor-pointer rounded-full border px-4 py-2 text-sm transition-all ${
                      selected
                        ? "border-[#0066FF]/40 bg-[#0066FF]/15 text-[#00D4FF]"
                        : "border-white/10 text-white/50 hover:border-white/20"
                    }`}
                  >
                    <input
                      type="checkbox"
                      name="preferred_languages"
                      value={language}
                      checked={selected}
                      onChange={() => toggleLanguage(language)}
                      className="sr-only"
                    />
                    {getLanguageBadge(language)} · {getLanguageLabel(language)}
                  </label>
                );
              })}
            </div>
          </fieldset>

          <label className="block">
            <span className={labelClassName}>Primary language</span>
            <select
              name="default_language"
              value={defaultLanguage}
              onChange={(event) =>
                setDefaultLanguage(event.target.value as SupportedLanguage)
              }
              disabled={!canEdit}
              className={inputClassName}
            >
              {preferredLanguages.map((language) => (
                <option key={language} value={language}>
                  {getLanguageLabel(language)}
                </option>
              ))}
            </select>
          </label>
        </SectionCard>

        <SectionCard
          title="FAQ knowledge base"
          description="Answers the assistant can use when clients ask common questions."
        >
          <div className="space-y-4">
            {faqs.length === 0 && (
              <p className="text-sm text-white/35">
                No FAQs yet. Add questions your leads ask often.
              </p>
            )}

            {faqs.map((faq, index) => (
              <div
                key={`faq-${index}`}
                className="rounded-xl border border-white/10 bg-black/20 p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wider text-white/35">
                    FAQ {index + 1}
                  </span>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => removeFaq(index)}
                      className="text-xs text-red-300/80 hover:text-red-200"
                    >
                      Remove
                    </button>
                  )}
                </div>

                <label className="block">
                  <span className={labelClassName}>Question</span>
                  <input
                    value={faq.question}
                    onChange={(event) =>
                      updateFaq(index, "question", event.target.value)
                    }
                    maxLength={300}
                    disabled={!canEdit}
                    className={inputClassName}
                  />
                </label>

                <label className="mt-3 block">
                  <span className={labelClassName}>Answer</span>
                  <textarea
                    value={faq.answer}
                    onChange={(event) =>
                      updateFaq(index, "answer", event.target.value)
                    }
                    maxLength={1000}
                    disabled={!canEdit}
                    className={textareaClassName}
                  />
                </label>
              </div>
            ))}
          </div>

          {canEdit && (
            <button
              type="button"
              onClick={addFaq}
              className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/70 hover:border-white/20 hover:text-white"
            >
              Add FAQ
            </button>
          )}
        </SectionCard>

        <SectionCard
          title="Agent behavior"
          description="Hard rules the assistant must follow beyond the default real-estate playbook."
        >
          <label className="block">
            <span className={labelClassName}>Agent behavior instructions</span>
            <textarea
              name="agent_behavior_rules"
              defaultValue={settings.agentBehaviorRules}
              placeholder="e.g. Never discuss off-market deals. Always offer a call for budgets above €1M."
              maxLength={2000}
              disabled={!canEdit}
              className={`${textareaClassName} min-h-[140px]`}
            />
          </label>
        </SectionCard>

        {canEdit && (
          <button
            type="submit"
            disabled={isPending}
            className="rounded-full bg-gradient-to-r from-[#0066FF] to-[#0088FF] px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {isPending ? "Saving…" : "Save AI settings"}
          </button>
        )}
      </form>
    </div>
  );
}
