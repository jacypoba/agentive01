const pillClassName =
  "inline-flex min-w-0 max-w-[5.5rem] shrink truncate rounded-full px-1.5 py-0.5 text-[10px] font-medium normal-case tracking-normal text-white/40 sm:max-w-[6.5rem] lg:max-w-[7.5rem]";

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
