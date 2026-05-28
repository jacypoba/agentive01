"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LanguageBadge } from "@/components/leads/language-badge";
import { createClient } from "@/lib/supabase/client";
import {
  formatRelativeTime,
  getActivityLabel,
  getStatusBadgeColor,
} from "@/lib/data/dashboard";
import type { Conversation, Lead, RecentActivity } from "@/types/database";

type WhatsAppLiveFeedProps = {
  userId: string;
  initialActivity: RecentActivity[];
};

function toActivityFromConversation(
  conversation: Conversation,
  lead: Pick<Lead, "client_name" | "interest" | "status" | "preferred_language">
): RecentActivity {
  return {
    id: conversation.id,
    lead_id: conversation.lead_id,
    message: conversation.message,
    sender: conversation.sender,
    created_at: conversation.created_at,
    client_name: lead.client_name,
    interest: lead.interest,
    status: lead.status,
    preferred_language: lead.preferred_language,
    kind: "conversation",
  };
}

function toActivityFromLead(lead: Lead): RecentActivity {
  return {
    id: lead.id,
    lead_id: lead.id,
    message: lead.interest ?? "New WhatsApp lead",
    sender: "client",
    created_at: lead.created_at,
    client_name: lead.client_name,
    interest: lead.interest,
    status: lead.status,
    preferred_language: lead.preferred_language,
    kind: "lead",
  };
}

export function WhatsAppLiveFeed({
  userId,
  initialActivity,
}: WhatsAppLiveFeedProps) {
  const [activity, setActivity] = useState(initialActivity);
  const [live, setLive] = useState(false);

  useEffect(() => {
    setActivity(initialActivity);
  }, [initialActivity]);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`whatsapp-live-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "conversations" },
        async (payload) => {
          const conversation = payload.new as Conversation;

          const { data: lead } = await supabase
            .from("leads")
            .select("id, client_name, interest, status, user_id, preferred_language")
            .eq("id", conversation.lead_id)
            .maybeSingle();

          if (!lead || lead.user_id !== userId) return;

          const item = toActivityFromConversation(conversation, lead);
          setActivity((prev) => {
            const filtered = prev.filter(
              (entry) =>
                !(
                  entry.lead_id === item.lead_id &&
                  entry.id.startsWith("temp-")
                )
            );
            const exists = filtered.some((entry) => entry.id === item.id);
            if (exists) return filtered;
            return [item, ...filtered].slice(0, 8);
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "leads" },
        (payload) => {
          const lead = payload.new as Lead;
          if (lead.user_id !== userId) return;

          const item = toActivityFromLead(lead);
          setActivity((prev) => {
            const exists = prev.some(
              (entry) => entry.lead_id === item.lead_id && entry.kind === "lead"
            );
            if (exists) return prev;
            return [item, ...prev].slice(0, 8);
          });
        }
      )
      .subscribe((status) => {
        setLive(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return (
    <section id="whatsapp" className="mt-12">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">WhatsApp live</h2>
          <p className="mt-1 text-xs text-white/40">
            Incoming messages from Evolution API appear here in real time.
          </p>
        </div>
        <span
          className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-medium uppercase tracking-wider ${
            live
              ? "border-[#25D366]/30 bg-[#25D366]/10 text-[#25D366]"
              : "border-white/10 bg-white/5 text-white/40"
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${live ? "bg-[#25D366] animate-pulse" : "bg-white/30"}`}
          />
          {live ? "Connected" : "Connecting…"}
        </span>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0a]/80 backdrop-blur-xl">
        {activity.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-white/50">Waiting for WhatsApp messages</p>
            <p className="mt-1 text-xs text-white/30">
              Point your Evolution API webhook to{" "}
              <code className="rounded bg-black/40 px-1.5 py-0.5">
                /api/webhooks/evolution
              </code>
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {activity.map((item) => (
              <Link
                key={`${item.kind}-${item.id}`}
                href={`/leads/${item.lead_id}`}
                className="flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-white/[0.02] sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-[#25D366]" />
                    <p className="text-sm font-medium text-white">
                      {item.client_name}
                    </p>
                    <LanguageBadge language={item.preferred_language} />
                  </div>
                  <p className="mt-1 truncate text-xs text-white/40">
                    {getActivityLabel(item)} · {item.message}
                  </p>
                  <p className="mt-1 text-[10px] text-white/30">
                    {formatRelativeTime(item.created_at)}
                  </p>
                </div>
                <span
                  className={`w-fit shrink-0 rounded-full border px-3 py-1 text-xs font-medium capitalize ${getStatusBadgeColor(item.status)}`}
                >
                  {item.status}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
