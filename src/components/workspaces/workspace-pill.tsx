const pillClassName =
  "inline-flex shrink-0 max-w-[140px] truncate rounded-full border border-white/10 bg-gradient-to-r from-white/[0.06] to-white/[0.02] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/60 shadow-sm shadow-black/20";

type WorkspacePillProps = {
  label: string;
  title?: string;
};

/** Static workspace label — always renders, never returns null. */
export function WorkspacePill({ label, title }: WorkspacePillProps) {
  return (
    <span className={pillClassName} title={title ?? label}>
      {label}
    </span>
  );
}

export const WORKSPACE_FALLBACK_LABEL = "Default workspace";

export function WorkspacePillFallback() {
  return (
    <WorkspacePill
      label={WORKSPACE_FALLBACK_LABEL}
      title="Workspace preference"
    />
  );
}
