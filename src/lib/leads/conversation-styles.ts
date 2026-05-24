import type { ConversationSender } from "@/types/database";

export function getMessageBubbleStyles(sender: ConversationSender): {
  container: string;
  bubble: string;
  label: string;
} {
  switch (sender) {
    case "client":
      return {
        container: "justify-start",
        bubble:
          "rounded-2xl rounded-tl-sm border border-white/10 bg-white/5 text-white/80",
        label: "text-white/40",
      };
    case "ai":
      return {
        container: "justify-end",
        bubble:
          "rounded-2xl rounded-tr-sm bg-gradient-to-br from-[#0066FF] to-[#0088FF] text-white shadow-lg shadow-[#0066FF]/20",
        label: "text-[#00D4FF]",
      };
    case "agent":
      return {
        container: "justify-end",
        bubble:
          "rounded-2xl rounded-tr-sm border border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
        label: "text-emerald-400/80",
      };
  }
}

export function getSenderLabel(sender: ConversationSender): string {
  switch (sender) {
    case "client":
      return "Client";
    case "ai":
      return "AI";
    case "agent":
      return "You";
  }
}

export function formatMessageTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}
