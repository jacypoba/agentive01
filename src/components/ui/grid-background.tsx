export function GridBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_80%_60%_at_50%_0%,#000_40%,transparent_100%)]" />
      <div className="absolute -top-40 left-1/2 h-[520px] w-[720px] -translate-x-1/2 rounded-full bg-[#0066FF]/20 blur-[120px] animate-pulse-glow" />
      <div className="absolute top-1/3 -right-32 h-80 w-80 rounded-full bg-[#00D4FF]/10 blur-[100px]" />
      <div className="absolute bottom-0 -left-32 h-72 w-72 rounded-full bg-[#0066FF]/10 blur-[100px]" />
    </div>
  );
}
