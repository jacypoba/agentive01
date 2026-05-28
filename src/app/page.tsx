import Link from "next/link";

const features = [
  {
    title: "WhatsApp automation",
    description:
      "Every inquiry routed, answered, and logged inside the channel your clients already use.",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
      </svg>
    ),
  },
  {
    title: "AI lead qualification",
    description:
      "Score intent, budget, and timeline automatically before your team picks up the phone.",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
      </svg>
    ),
  },
  {
    title: "Multilingual support",
    description:
      "Serve buyers and renters in their language — Portuguese, English, Spanish, and more.",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m10.5 21 5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 0 1 6-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-4.589 8.495a18.023 18.023 0 0 1-3.827-5.802" />
      </svg>
    ),
  },
  {
    title: "Automatic follow-ups",
    description:
      "Nurture cold leads with timed sequences that feel personal, not robotic.",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
      </svg>
    ),
  },
  {
    title: "Scheduling visits",
    description:
      "Book property tours directly in chat with calendar sync for your agents.",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
      </svg>
    ),
  },
  {
    title: "24/7 customer responses",
    description:
      "Nights, weekends, holidays — your AI employees never clock out.",
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    ),
  },
];

const benefits = [
  {
    stat: "0%",
    label: "leads lost overnight",
    title: "Never lose leads",
    description:
      "Capture every WhatsApp message the moment it arrives — even at 2 AM.",
  },
  {
    stat: "<30s",
    label: "average first reply",
    title: "Faster responses",
    description:
      "Beat competitors to the inbox with instant, context-aware replies.",
  },
  {
    stat: "3.2×",
    label: "more qualified meetings",
    title: "Increase conversions",
    description:
      "Turn more conversations into booked visits and signed contracts.",
  },
  {
    stat: "80%",
    label: "less manual work",
    title: "Automate repetitive work",
    description:
      "Free your agents from copy-paste follow-ups and FAQ loops.",
  },
];

const steps = [
  {
    step: "01",
    title: "Connect WhatsApp",
    description:
      "Link your business number in minutes. No new app for your clients to download.",
  },
  {
    step: "02",
    title: "Train AI",
    description:
      "Upload listings, FAQs, and tone guidelines. Your AI learns your agency voice.",
  },
  {
    step: "03",
    title: "Capture leads",
    description:
      "Qualify buyers automatically and push hot prospects to your CRM in real time.",
  },
  {
    step: "04",
    title: "Close deals",
    description:
      "Hand off warm leads to agents with full conversation history and next steps.",
  },
];

const plans = [
  {
    name: "Starter",
    price: "$299",
    period: "/month",
    description: "For boutique agencies getting started with AI automation.",
    features: [
      "1 WhatsApp number",
      "500 AI conversations/mo",
      "Lead qualification",
      "Email support",
    ],
    cta: "Start free trial",
    highlighted: false,
  },
  {
    name: "Growth",
    price: "$699",
    period: "/month",
    description: "For growing teams that need scale and multilingual support.",
    features: [
      "3 WhatsApp numbers",
      "Unlimited conversations",
      "Multilingual AI",
      "CRM integrations",
      "Priority support",
    ],
    cta: "Start free trial",
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "For franchise networks and high-volume brokerages.",
    features: [
      "Unlimited numbers",
      "Custom AI training",
      "Dedicated success manager",
      "SLA & SSO",
      "White-label options",
    ],
    cta: "Talk to sales",
    highlighted: false,
  },
];

const navLinks = [
  { href: "#features", label: "Features" },
  { href: "#benefits", label: "Benefits" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#pricing", label: "Pricing" },
];

function GridBackground() {
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

function Logo() {
  return (
    <Link href="/" className="group flex items-center gap-2.5">
      <span className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5">
        <span className="absolute inset-0 rounded-lg bg-gradient-to-br from-[#0066FF] to-[#00D4FF] opacity-60 blur-sm transition-opacity group-hover:opacity-100" />
        <span className="relative text-xs font-bold tracking-tighter text-white">
          A1
        </span>
      </span>
      <span className="text-sm font-semibold tracking-tight text-white">
        Agentive<span className="text-[#00D4FF]">01</span>
      </span>
    </Link>
  );
}

function HeroMockup() {
  return (
    <div className="animate-float relative mx-auto w-full max-w-md lg:max-w-none">
      <div className="absolute -inset-px rounded-2xl bg-gradient-to-b from-[#0066FF]/50 via-[#00D4FF]/20 to-transparent opacity-70" />
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0a]/90 shadow-2xl shadow-[#0066FF]/10 backdrop-blur-xl">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[#25D366]" />
            <span className="text-xs font-medium text-white/80">
              Agentive01 · Live
            </span>
          </div>
          <span className="rounded-full border border-[#00D4FF]/30 bg-[#00D4FF]/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[#00D4FF]">
            AI Active
          </span>
        </div>
        <div className="space-y-3 p-4">
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70">
              Hi! I saw the 3-bed listing on Ocean Drive. Is it still available?
            </div>
          </div>
          <div className="flex justify-end">
            <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-gradient-to-br from-[#0066FF] to-[#0088FF] px-3 py-2 text-xs text-white">
              Yes, it&apos;s available! 3 beds, 2 baths, $1.2M. Would you like to
              schedule a visit this week?
            </div>
          </div>
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70">
              Saturday morning works. Can we do 10 AM?
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-[#00D4FF]/20 bg-[#00D4FF]/5 px-3 py-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#00D4FF]/20 text-[#00D4FF]">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-7.5" />
              </svg>
            </span>
            <div>
              <p className="text-[10px] font-medium text-[#00D4FF]">
                Visit scheduled
              </p>
              <p className="text-[10px] text-white/50">
                Sat 10:00 AM · Lead score: 92
              </p>
            </div>
          </div>
        </div>
        <div className="border-t border-white/10 px-4 py-3">
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#00D4FF]" />
            <span className="text-[10px] text-white/40">
              AI drafting response…
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-black text-white">
      <GridBackground />

      {/* Navigation */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/5 bg-black/60 backdrop-blur-xl">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 lg:px-8">
          <Logo />
          <div className="hidden items-center gap-8 md:flex">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm text-white/60 transition-colors hover:text-white"
              >
                {link.label}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="hidden text-sm text-white/60 transition-colors hover:text-white sm:inline"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black transition-all hover:bg-white/90 hover:shadow-lg hover:shadow-white/10"
            >
              Get started
            </Link>
          </div>
        </nav>
      </header>

      <main>
        <div className="bg-amber-400 px-6 py-3 text-center text-sm font-bold tracking-wide text-black">
          DEPLOY CHECK CALENDAR ROUTES
        </div>
        {/* Hero */}
        <section className="relative px-6 pb-24 pt-32 lg:px-8 lg:pb-32 lg:pt-40">
          <div className="mx-auto grid max-w-6xl items-center gap-16 lg:grid-cols-2 lg:gap-12">
            <div className="animate-fade-up text-center lg:text-left">
              <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#0066FF]/30 bg-[#0066FF]/10 px-4 py-1.5 text-xs font-medium tracking-wide text-[#00D4FF]">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00D4FF] opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#00D4FF]" />
                </span>
                AI employees for real estate
              </p>
              <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
                Your Business{" "}
                <span className="bg-gradient-to-r from-white via-white to-white/60 bg-clip-text text-transparent">
                  Never
                </span>{" "}
                <span className="bg-gradient-to-r from-[#00D4FF] via-[#0066FF] to-[#00D4FF] bg-clip-text text-transparent animate-shimmer">
                  Sleeps.
                </span>
              </h1>
              <p className="mx-auto mt-6 max-w-lg text-lg leading-relaxed text-white/60 lg:mx-0">
                Agentive01 deploys AI employees for real estate agencies — qualifying
                leads, booking visits, and closing conversations on WhatsApp, 24/7.
              </p>
              <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center lg:justify-start">
                <Link
                  href="/signup"
                  className="group relative w-full overflow-hidden rounded-full bg-gradient-to-r from-[#0066FF] to-[#0088FF] px-8 py-3.5 text-center text-sm font-semibold text-white shadow-lg shadow-[#0066FF]/25 transition-all hover:shadow-[#0066FF]/40 sm:w-auto"
                >
                  <span className="relative z-10">Start free trial</span>
                  <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                </Link>
                <a
                  href="#how-it-works"
                  className="w-full rounded-full border border-white/15 bg-white/5 px-8 py-3.5 text-center text-sm font-semibold text-white backdrop-blur-sm transition-all hover:border-white/25 hover:bg-white/10 sm:w-auto"
                >
                  See how it works
                </a>
              </div>
              <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-xs text-white/40 lg:justify-start">
                <span className="flex items-center gap-2">
                  <svg className="h-4 w-4 text-[#00D4FF]" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                  </svg>
                  No credit card required
                </span>
                <span className="flex items-center gap-2">
                  <svg className="h-4 w-4 text-[#00D4FF]" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                  </svg>
                  Setup in under 15 minutes
                </span>
              </div>
            </div>
            <div className="animate-fade-up [animation-delay:200ms]">
              <HeroMockup />
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="relative border-t border-white/5 px-6 py-24 lg:px-8 lg:py-32">
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-medium uppercase tracking-widest text-[#00D4FF]">
                Features
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                Everything your agency needs on WhatsApp
              </h2>
              <p className="mt-4 text-white/50">
                One platform. Six superpowers. Built for real estate workflows.
              </p>
            </div>
            <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => (
                <div
                  key={feature.title}
                  className="group rounded-2xl border border-white/10 bg-white/[0.02] p-6 transition-all duration-300 hover:border-[#0066FF]/40 hover:bg-[#0066FF]/5 hover:shadow-lg hover:shadow-[#0066FF]/5"
                >
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-[#0066FF]/30 bg-[#0066FF]/10 text-[#00D4FF] transition-colors group-hover:bg-[#0066FF]/20">
                    {feature.icon}
                  </div>
                  <h3 className="text-base font-semibold text-white">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/50">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Benefits */}
        <section id="benefits" className="relative px-6 py-24 lg:px-8 lg:py-32">
          <div className="absolute inset-0 bg-gradient-to-b from-[#0066FF]/5 via-transparent to-transparent" />
          <div className="relative mx-auto max-w-6xl">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-medium uppercase tracking-widest text-[#00D4FF]">
                Benefits
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                Outcomes that compound
              </h2>
              <p className="mt-4 text-white/50">
                Real metrics from agencies running Agentive01 on WhatsApp.
              </p>
            </div>
            <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {benefits.map((benefit) => (
                <div
                  key={benefit.title}
                  className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-transparent p-6"
                >
                  <div className="mb-6">
                    <p className="text-3xl font-semibold tracking-tight text-white">
                      {benefit.stat}
                    </p>
                    <p className="mt-1 text-xs text-[#00D4FF]">{benefit.label}</p>
                  </div>
                  <h3 className="text-base font-semibold">{benefit.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/50">
                    {benefit.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="relative border-t border-white/5 px-6 py-24 lg:px-8 lg:py-32">
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-medium uppercase tracking-widest text-[#00D4FF]">
                How it works
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                Live in four steps
              </h2>
              <p className="mt-4 text-white/50">
                From connection to closed deal — without changing how clients reach you.
              </p>
            </div>
            <div className="relative mt-16">
              <div
                aria-hidden
                className="absolute left-8 top-8 hidden h-[calc(100%-4rem)] w-px bg-gradient-to-b from-[#0066FF] via-[#00D4FF]/50 to-transparent lg:left-1/2 lg:block lg:-translate-x-px"
              />
              <div className="grid gap-8 lg:grid-cols-2 lg:gap-x-16 lg:gap-y-12">
                {steps.map((item, index) => (
                  <div
                    key={item.step}
                    className={`relative flex gap-6 ${index % 2 === 1 ? "lg:flex-row-reverse lg:text-right" : ""}`}
                  >
                    <div className="flex shrink-0 flex-col items-center lg:items-center">
                      <span className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[#0066FF]/40 bg-[#0066FF]/10 text-lg font-semibold text-[#00D4FF]">
                        {item.step}
                      </span>
                    </div>
                    <div className={`pt-2 ${index % 2 === 1 ? "lg:pr-8" : "lg:pl-0"}`}>
                      <h3 className="text-xl font-semibold">{item.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-white/50">
                        {item.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="relative px-6 py-24 lg:px-8 lg:py-32">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_#0066FF15_0%,_transparent_70%)]" />
          <div className="relative mx-auto max-w-6xl">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-medium uppercase tracking-widest text-[#00D4FF]">
                Pricing
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                Plans that scale with your pipeline
              </h2>
              <p className="mt-4 text-white/50">
                14-day free trial on all plans. Cancel anytime.
              </p>
            </div>
            <div className="mt-16 grid gap-6 lg:grid-cols-3">
              {plans.map((plan) => (
                <div
                  key={plan.name}
                  className={`relative flex flex-col rounded-2xl border p-8 transition-all duration-300 ${
                    plan.highlighted
                      ? "border-[#0066FF]/50 bg-gradient-to-b from-[#0066FF]/15 to-[#0a0a0a] shadow-xl shadow-[#0066FF]/10 scale-[1.02] lg:scale-105"
                      : "border-white/10 bg-white/[0.02] hover:border-white/20"
                  }`}
                >
                  {plan.highlighted && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-[#0066FF] to-[#00D4FF] px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
                      Most popular
                    </span>
                  )}
                  <h3 className="text-lg font-semibold">{plan.name}</h3>
                  <p className="mt-2 text-sm text-white/50">{plan.description}</p>
                  <div className="mt-6 flex items-baseline gap-1">
                    <span className="text-4xl font-semibold tracking-tight">
                      {plan.price}
                    </span>
                    {plan.period && (
                      <span className="text-sm text-white/40">{plan.period}</span>
                    )}
                  </div>
                  <ul className="mt-8 flex-1 space-y-3">
                    {plan.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-start gap-2 text-sm text-white/70"
                      >
                        <svg
                          className="mt-0.5 h-4 w-4 shrink-0 text-[#00D4FF]"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
                            clipRule="evenodd"
                          />
                        </svg>
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <a
                    href="#"
                    className={`mt-8 block rounded-full py-3 text-center text-sm font-semibold transition-all ${
                      plan.highlighted
                        ? "bg-white text-black hover:bg-white/90"
                        : "border border-white/15 bg-white/5 text-white hover:border-white/25 hover:bg-white/10"
                    }`}
                  >
                    {plan.cta}
                  </a>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="relative px-6 pb-24 lg:px-8">
          <div className="relative mx-auto max-w-4xl overflow-hidden rounded-3xl border border-white/10">
            <div className="absolute inset-0 bg-gradient-to-br from-[#0066FF]/30 via-black to-black" />
            <div
              aria-hidden
              className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:32px_32px]"
            />
            <div className="relative px-8 py-16 text-center sm:px-16 sm:py-20">
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Ready to hire your first AI employee?
              </h2>
              <p className="mx-auto mt-4 max-w-lg text-white/60">
                Join forward-thinking real estate agencies using Agentive01 to win
                more deals on WhatsApp — while they sleep.
              </p>
              <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Link
                  href="/signup"
                  className="w-full rounded-full bg-white px-8 py-3.5 text-center text-sm font-semibold text-black transition-all hover:bg-white/90 sm:w-auto"
                >
                  Start free trial
                </Link>
                <Link
                  href="/login"
                  className="w-full rounded-full border border-white/20 px-8 py-3.5 text-center text-sm font-semibold text-white transition-all hover:bg-white/5 sm:w-auto"
                >
                  Sign in
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 px-6 py-12 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
            <div>
              <Logo />
              <p className="mt-4 max-w-xs text-sm text-white/40">
                AI employees for real estate agencies. Your Business Never Sleeps.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-white/60">
                  Product
                </p>
                <ul className="mt-4 space-y-2 text-sm text-white/40">
                  <li>
                    <a href="#features" className="transition-colors hover:text-white">
                      Features
                    </a>
                  </li>
                  <li>
                    <a href="#pricing" className="transition-colors hover:text-white">
                      Pricing
                    </a>
                  </li>
                  <li>
                    <a href="#" className="transition-colors hover:text-white">
                      Integrations
                    </a>
                  </li>
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-white/60">
                  Company
                </p>
                <ul className="mt-4 space-y-2 text-sm text-white/40">
                  <li>
                    <a href="#" className="transition-colors hover:text-white">
                      About
                    </a>
                  </li>
                  <li>
                    <a href="#" className="transition-colors hover:text-white">
                      Blog
                    </a>
                  </li>
                  <li>
                    <a href="#" className="transition-colors hover:text-white">
                      Careers
                    </a>
                  </li>
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-white/60">
                  Legal
                </p>
                <ul className="mt-4 space-y-2 text-sm text-white/40">
                  <li>
                    <a href="#" className="transition-colors hover:text-white">
                      Privacy
                    </a>
                  </li>
                  <li>
                    <a href="#" className="transition-colors hover:text-white">
                      Terms
                    </a>
                  </li>
                  <li>
                    <a href="#" className="transition-colors hover:text-white">
                      Security
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </div>
          <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/5 pt-8 sm:flex-row">
            <p className="text-xs text-white/30">
              © {new Date().getFullYear()} Agentive01. All rights reserved.
            </p>
            <div className="flex gap-6">
              <a
                href="#"
                aria-label="Twitter"
                className="text-white/30 transition-colors hover:text-[#00D4FF]"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <a
                href="#"
                aria-label="LinkedIn"
                className="text-white/30 transition-colors hover:text-[#00D4FF]"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
