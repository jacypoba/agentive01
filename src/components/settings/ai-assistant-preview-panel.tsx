"use client";

import { useState, useTransition } from "react";
import {
  previewAiReplyAction,
  type AiPreviewActionResult,
} from "@/app/actions/ai-settings";
import { getLanguageBadge } from "@/lib/i18n/types";
import type { AiPreviewContextSignal } from "@/lib/ai/preview-context-usage";

const inputClassName =
  "mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white placeholder:text-white/25 focus:border-[#0066FF]/50 focus:outline-none focus:ring-1 focus:ring-[#0066FF]/30";

const labelClassName =
  "text-xs font-medium uppercase tracking-wider text-white/40";

const SAMPLE_PROMPTS = [
  "Olá, procuro apartamento em Lisboa até 500k.",
  "What are your office hours?",
  "Do you charge buyer fees?",
  "Quero marcar uma visita amanhã de tarde.",
];

function SignalBadge({
  label,
  signal,
}: {
  label: string;
  signal: AiPreviewContextSignal;
}) {
  let statusLabel = "Not configured";
  let statusClass = "border-white/10 bg-white/[0.03] text-white/35";

  if (signal.configured && signal.likelyUsedInReply) {
    statusLabel = "Likely used";
    statusClass = "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  } else if (signal.configured && signal.includedInPrompt) {
    statusLabel = "In prompt";
    statusClass = "border-[#0066FF]/30 bg-[#0066FF]/10 text-[#00D4FF]";
  } else if (signal.configured) {
    statusLabel = "Not detected";
    statusClass = "border-amber-500/30 bg-amber-500/10 text-amber-200";
  }

  return (
    <div className={`rounded-xl border px-4 py-3 ${statusClass}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium">{label}</span>
        <span className="rounded-full border border-current/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
          {statusLabel}
        </span>
      </div>
      {signal.note && (
        <p className="mt-2 text-xs opacity-80">{signal.note}</p>
      )}
    </div>
  );
}

export function AiAssistantPreviewPanel() {
  const [sampleMessage, setSampleMessage] = useState(SAMPLE_PROMPTS[0]);
  const [result, setResult] = useState<AiPreviewActionResult | null>(null);
  const [isPending, startTransition] = useTransition();

  function handlePreview() {
    setResult(null);
    startTransition(async () => {
      const preview = await previewAiReplyAction(sampleMessage);
      setResult(preview);
    });
  }

  const preview = result && "ok" in result && result.ok ? result : null;
  const error = result && "error" in result ? result.error : null;

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
      <div>
        <h2 className="text-lg font-semibold">Preview & test</h2>
        <p className="mt-1 text-sm text-white/45">
          Simulate a lead message and preview the AI reply using your saved
          workspace settings. Nothing is sent on WhatsApp and no CRM records are
          created.
        </p>
      </div>

      <div className="mt-6 space-y-4">
        <label className="block">
          <span className={labelClassName}>Sample lead message</span>
          <textarea
            value={sampleMessage}
            onChange={(event) => setSampleMessage(event.target.value)}
            maxLength={500}
            rows={4}
            placeholder="Type what a lead might send on WhatsApp…"
            className={`${inputClassName} min-h-[112px] resize-y`}
          />
          <p className="mt-1 text-xs text-white/30">
            {sampleMessage.trim().length}/500 characters · uses saved settings
          </p>
        </label>

        <div className="flex flex-wrap gap-2">
          {SAMPLE_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => setSampleMessage(prompt)}
              className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/55 hover:border-white/20 hover:text-white"
            >
              {prompt.length > 42 ? `${prompt.slice(0, 42)}…` : prompt}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={handlePreview}
          disabled={isPending || !sampleMessage.trim()}
          className="rounded-full bg-gradient-to-r from-[#0066FF] to-[#0088FF] px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {isPending ? "Generating preview…" : "Generate preview reply"}
        </button>
      </div>

      {error && (
        <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm text-red-200">
          {error}
        </div>
      )}

      {preview && (
        <div className="mt-6 space-y-4">
          <div className="rounded-2xl border border-[#0066FF]/20 bg-gradient-to-br from-[#0066FF]/10 via-transparent to-transparent px-5 py-4">
            <p className="text-xs font-medium uppercase tracking-wider text-[#00D4FF]">
              AI preview reply
            </p>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-white">
              {preview.reply}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
              <p className={labelClassName}>Detected language</p>
              <p className="mt-2 text-sm font-medium text-white">
                {getLanguageBadge(preview.detectedLanguage)} ·{" "}
                {preview.detectedLanguageLabel}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
              <p className={labelClassName}>Message intent</p>
              <p className="mt-2 text-sm font-medium text-white">
                {preview.intent.replaceAll("_", " ")}
              </p>
            </div>
          </div>

          <div>
            <p className={labelClassName}>Workspace context usage</p>
            <p className="mt-1 text-xs text-white/35">
              {preview.workspaceContextActive
                ? "Workspace settings were injected into the AI system prompt."
                : "No workspace customization is configured yet — base assistant rules only."}
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <SignalBadge label="Company info" signal={preview.signals.companyInfo} />
              <SignalBadge label="FAQ knowledge" signal={preview.signals.faqs} />
              <SignalBadge label="Office hours" signal={preview.signals.officeHours} />
              <SignalBadge label="Tone of voice" signal={preview.signals.toneOfVoice} />
              <SignalBadge
                label="Agent behavior rules"
                signal={preview.signals.agentBehaviorRules}
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
