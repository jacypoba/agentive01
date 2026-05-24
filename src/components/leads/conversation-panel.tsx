"use client";

import { useRouter } from "next/navigation";
import {
  useEffect,
  useOptimistic,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import { sendMessage } from "@/app/actions/conversations";
import {
  formatMessageTime,
  getMessageBubbleStyles,
  getSenderLabel,
} from "@/lib/leads/conversation-styles";
import type { Conversation, ConversationSender } from "@/types/database";

type ConversationPanelProps = {
  leadId: string;
  conversations: Conversation[];
};

type OptimisticItem = Conversation & { pending?: boolean; typing?: boolean };

const senderOptions: { value: ConversationSender; label: string }[] = [
  { value: "client", label: "Client" },
  { value: "agent", label: "Agent (you)" },
  { value: "ai", label: "AI (manual)" },
];

function createTempMessage(
  leadId: string,
  message: string,
  sender: ConversationSender
): OptimisticItem {
  return {
    id: `temp-${crypto.randomUUID()}`,
    lead_id: leadId,
    message,
    sender,
    created_at: new Date().toISOString(),
    pending: true,
  };
}

function TypingBubble() {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] sm:max-w-[75%]">
        <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-[#00D4FF]">
          AI
        </p>
        <div className="flex items-center gap-1.5 rounded-2xl rounded-tr-sm bg-gradient-to-br from-[#0066FF]/60 to-[#0088FF]/60 px-4 py-3">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/80 [animation-delay:0ms]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/80 [animation-delay:150ms]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/80 [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}

export function ConversationPanel({
  leadId,
  conversations,
}: ConversationPanelProps) {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [pending, startTransition] = useTransition();

  const [optimisticMessages, addOptimistic] = useOptimistic(
    conversations as OptimisticItem[],
    (state, action: { type: "add"; messages: OptimisticItem[] }) => [
      ...state,
      ...action.messages,
    ]
  );

  useEffect(() => {
    setError(null);
  }, [conversations]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [optimisticMessages.length, isTyping, pending]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    const message = (formData.get("message") as string)?.trim();
    const sender = formData.get("sender") as ConversationSender;

    if (!message) return;

    const willTriggerAI = sender === "client";
    formRef.current?.reset();

    startTransition(async () => {
      addOptimistic({
        type: "add",
        messages: [createTempMessage(leadId, message, sender)],
      });

      if (willTriggerAI) {
        setIsTyping(true);
      }

      const result = await sendMessage(leadId, {}, formData);

      setIsTyping(false);

      if (result.error) {
        setError(result.error);
        router.refresh();
        return;
      }

      router.refresh();
    });
  }

  return (
    <div className="relative flex h-[min(70vh,640px)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0a]/90 shadow-2xl shadow-[#0066FF]/5 backdrop-blur-xl">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#25D366]" />
          <span className="text-sm font-medium text-white/80">Conversation</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden rounded-full border border-[#0066FF]/30 bg-[#0066FF]/10 px-2 py-0.5 text-[10px] font-medium text-[#00D4FF] sm:inline">
            AI enabled
          </span>
          <span className="rounded-full border border-[#00D4FF]/30 bg-[#00D4FF]/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[#00D4FF]">
            Live
          </span>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-5"
      >
        {optimisticMessages.length === 0 && !isTyping ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <p className="text-sm text-white/50">No messages yet</p>
            <p className="mt-1 max-w-xs text-xs text-white/30">
              Send a message as the client to trigger an AI reply.
            </p>
          </div>
        ) : (
          <>
            {optimisticMessages.map((item) => {
              const styles = getMessageBubbleStyles(item.sender);

              return (
                <div key={item.id} className={`flex ${styles.container}`}>
                  <div
                    className={`max-w-[85%] sm:max-w-[75%] ${item.pending ? "opacity-70" : ""}`}
                  >
                    <p
                      className={`mb-1 text-[10px] font-medium uppercase tracking-wider ${styles.label}`}
                    >
                      {getSenderLabel(item.sender)}
                    </p>
                    <div
                      className={`px-3.5 py-2.5 text-sm leading-relaxed ${styles.bubble}`}
                    >
                      {item.message}
                    </div>
                    <p className="mt-1 text-[10px] text-white/25">
                      {item.pending ? "Sending…" : formatMessageTime(item.created_at)}
                    </p>
                  </div>
                </div>
              );
            })}
            {isTyping && <TypingBubble />}
          </>
        )}
      </div>

      <form
        ref={formRef}
        onSubmit={handleSubmit}
        className="border-t border-white/10 bg-black/40 p-4 sm:p-5"
      >
        {error && (
          <p role="alert" className="mb-3 text-xs text-red-400">
            {error}
          </p>
        )}

        <div className="mb-3 flex flex-wrap gap-2">
          {senderOptions.map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer items-center gap-1.5"
            >
              <input
                type="radio"
                name="sender"
                value={option.value}
                defaultChecked={option.value === "client"}
                className="accent-[#0066FF]"
              />
              <span className="text-xs text-white/50">{option.label}</span>
            </label>
          ))}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            name="message"
            type="text"
            required
            placeholder="Type as client to get an AI reply…"
            disabled={pending}
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none transition-colors focus:border-[#0066FF]/50 focus:ring-2 focus:ring-[#0066FF]/20 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={pending}
            className="group relative shrink-0 overflow-hidden rounded-full bg-gradient-to-r from-[#0066FF] to-[#0088FF] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-[#0066FF]/25 transition-all hover:shadow-[#0066FF]/40 disabled:cursor-not-allowed disabled:opacity-60 sm:px-8"
          >
            <span className="relative z-10">
              {pending ? "Sending…" : "Send"}
            </span>
            <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
          </button>
        </div>
      </form>
    </div>
  );
}
