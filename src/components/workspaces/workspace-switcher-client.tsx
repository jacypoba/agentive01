"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { switchDefaultWorkspaceAction } from "@/app/actions/workspaces";
import type { CurrentWorkspace } from "@/lib/workspaces/get-current-workspace";

const pillClassName =
  "inline-flex max-w-[180px] truncate rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-white/45";

type WorkspaceSwitcherClientProps = {
  workspaces: CurrentWorkspace[];
  currentWorkspaceId: string | null;
  isUnset?: boolean;
};

export function WorkspaceSwitcherClient({
  workspaces,
  currentWorkspaceId,
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

  if (isUnset || !current) {
    return (
      <span
        className={`${pillClassName} border-amber-500/20 bg-amber-500/10 text-amber-200/70`}
        title="No workspace is configured for this account yet"
      >
        Workspace not set
      </span>
    );
  }

  if (workspaces.length === 1) {
    return (
      <span className={pillClassName} title={current.name}>
        {current.name}
      </span>
    );
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
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={pending}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex max-w-[200px] items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-left text-xs font-medium text-white/70 transition-all hover:border-[#0066FF]/30 hover:bg-[#0066FF]/10 hover:text-white disabled:opacity-60"
      >
        <span className="truncate">{current.name}</span>
        <svg
          aria-hidden
          viewBox="0 0 20 20"
          className={`h-3.5 w-3.5 shrink-0 text-white/40 transition-transform ${open ? "rotate-180" : ""}`}
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
          className="absolute right-0 z-50 mt-2 min-w-[220px] overflow-hidden rounded-xl border border-white/10 bg-[#0a0a0a]/95 p-1 shadow-xl shadow-black/40 backdrop-blur-xl"
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
