"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { switchDefaultWorkspaceAction } from "@/app/actions/workspaces";
import {
  WORKSPACE_FALLBACK_LABEL,
  WorkspacePill,
} from "@/components/workspaces/workspace-pill";
import type { CurrentWorkspace } from "@/lib/workspaces/get-current-workspace";

type WorkspaceSwitcherClientProps = {
  workspaces: CurrentWorkspace[];
  currentWorkspaceId: string | null;
  fallbackLabel?: string;
  isUnset?: boolean;
};

export function WorkspaceSwitcherClient({
  workspaces,
  currentWorkspaceId,
  fallbackLabel = WORKSPACE_FALLBACK_LABEL,
  isUnset = false,
}: WorkspaceSwitcherClientProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState(currentWorkspaceId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);

  const current =
    workspaces.find((workspace) => workspace.id === activeId) ?? workspaces[0];

  const displayLabel =
    isUnset || !current?.name?.trim() ? fallbackLabel : current.name;

  useEffect(() => {
    setActiveId(currentWorkspaceId ?? "");
  }, [currentWorkspaceId]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  if (isUnset || workspaces.length === 0 || !current) {
    return <WorkspacePill label={displayLabel} title={displayLabel} />;
  }

  if (workspaces.length === 1) {
    return <WorkspacePill label={displayLabel} title={displayLabel} />;
  }

  function handleSelect(workspaceId: string) {
    if (workspaceId === activeId || pending) {
      setOpen(false);
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await switchDefaultWorkspaceAction(workspaceId);

      if (result.error) {
        setError(result.error);
        return;
      }

      setActiveId(workspaceId);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Workspace: ${displayLabel}`}
        disabled={pending}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex max-w-[160px] shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-gradient-to-r from-white/[0.06] to-white/[0.02] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/60 shadow-sm shadow-black/20 transition-all hover:border-[#0066FF]/30 hover:text-white/80 disabled:opacity-60"
      >
        <span className="truncate">{displayLabel}</span>
        <svg
          aria-hidden
          viewBox="0 0 20 20"
          className={`h-3 w-3 shrink-0 text-white/35 transition-transform ${open ? "rotate-180" : ""}`}
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Switch workspace"
          className="absolute right-0 z-[60] mt-2 min-w-[220px] overflow-hidden rounded-xl border border-white/10 bg-[#0a0a0a]/95 p-1 shadow-xl shadow-black/40 backdrop-blur-xl"
        >
          <p className="px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-white/35">
            Workspace
          </p>
          {workspaces.map((workspace) => {
            const isActive = workspace.id === activeId;

            return (
              <button
                key={workspace.id}
                type="button"
                role="option"
                aria-selected={isActive}
                onClick={() => handleSelect(workspace.id)}
                className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  isActive
                    ? "bg-[#0066FF]/15 text-white"
                    : "text-white/70 hover:bg-white/5 hover:text-white"
                }`}
              >
                <span className="truncate">{workspace.name}</span>
                {isActive && (
                  <span className="shrink-0 text-[10px] font-medium uppercase tracking-wider text-[#00D4FF]">
                    Active
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {error && (
        <p className="absolute right-0 top-full mt-1 max-w-[220px] text-right text-[10px] text-amber-300">
          {error}
        </p>
      )}
    </div>
  );
}
