"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ShieldCheck,
  FileText,
  Scale,
  AlertTriangle,
  Wrench,
  CreditCard,
  Ban,
  PhoneCall,
  Mail,
  ChevronLeft,
  Sparkles,
} from "lucide-react";

type SectionIcon = React.ComponentType<{ className?: string }>;

type NavItem = {
  id: string;
  label: string;
  icon: SectionIcon;
};

type RectState = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type ViewportState = {
  width: number;
  height: number;
  isDesktop: boolean;
};

// start earlier + longer morph = more visible + "liquid"
const START_OFFSET_DESKTOP = 72;
const START_OFFSET_MOBILE = 64;

const MORPH_PX_DESKTOP = 320;
const MORPH_PX_MOBILE = 240;

function clamp(n: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, n));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

function easeInOutCubic(t: number) {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

/**
 * IMPORTANT for your app:
 * body is the scroller (confirmed via devtools).
 * So scrollToId must use body.scrollTop, not window.scrollY.
 */
function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (!el) return;

  const scroller = document.body;
  const scrollerRect = scroller.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();

  const targetScrollTop =
    scroller.scrollTop + (elRect.top - scrollerRect.top) - 96;

  scroller.scrollTo({
    top: targetScrollTop,
    behavior: "smooth",
  });
}

const quickNav: readonly NavItem[] = [
  { id: "acceptance", label: "Acceptance", icon: FileText },
  { id: "services", label: "Services", icon: Wrench },
  { id: "booking", label: "Appointments", icon: Scale },
  { id: "payments", label: "Payments", icon: CreditCard },
  { id: "warranty", label: "Warranty", icon: ShieldCheck },
  { id: "liability", label: "Liability", icon: AlertTriangle },
  { id: "website", label: "Website Use", icon: Ban },
  { id: "communications", label: "Communication", icon: Mail },
  { id: "changes", label: "Changes", icon: FileText },
  { id: "governing-law", label: "Law", icon: Scale },
  { id: "contact", label: "Contact", icon: PhoneCall },
];

function GlassGuardianMark({ size = 28 }: { size?: number }) {
  return (
    <Image
      src="/branding/glass-guardian-gold.png"
      alt="Glass Guardian"
      width={size}
      height={size}
      className="h-auto w-auto object-contain"
      priority
    />
  );
}

function Section({
  id,
  title,
  icon: Icon,
  children,
}: {
  id: string;
  title: string;
  icon: SectionIcon;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-28 rounded-[1.75rem] border border-white/10 bg-white/[0.045] p-6 shadow-[0_20px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl md:p-8"
    >
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-400/10 text-amber-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_10px_25px_rgba(245,197,66,0.08)]">
          <Icon className="h-5 w-5" />
        </div>

        <h2 className="text-xl font-semibold tracking-tight text-white md:text-2xl">
          {title}
        </h2>
      </div>

      <div className="space-y-4 text-sm leading-7 text-white/78 md:text-[15px]">
        {children}
      </div>
    </section>
  );
}

function BulletList({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="space-y-3 pl-5 text-white/78">
      {items.map((item, i) => (
        <li key={i} className="list-disc marker:text-amber-300">
          {item}
        </li>
      ))}
    </ul>
  );
}

function QuickNavPill({
  id,
  label,
  active,
}: {
  id: string;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => scrollToId(id)}
      className={cn(
        "group inline-flex items-center rounded-full border px-3.5 py-2 text-sm transition duration-200",
        active
          ? "border-amber-300/40 bg-amber-400/12 text-white shadow-[0_0_0_1px_rgba(245,197,66,0.08)]"
          : "border-white/10 bg-black/20 text-white/75 hover:-translate-y-[1px] hover:border-amber-300/35 hover:bg-amber-400/10 hover:text-white"
      )}
    >
      <span className="whitespace-nowrap">{label}</span>
    </button>
  );
}

function RailButton({
  id,
  label,
  icon: Icon,
  active,
}: {
  id: string;
  label: string;
  icon: SectionIcon;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => scrollToId(id)}
      title={label}
      aria-label={label}
      className={cn(
        "group flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition duration-200",
        active
          ? "border-amber-300/35 bg-amber-400/12 text-white shadow-[0_0_0_1px_rgba(245,197,66,0.08)]"
          : "border-white/10 bg-white/[0.035] text-white/68 hover:-translate-y-[1px] hover:border-amber-300/30 hover:bg-amber-400/10 hover:text-white"
      )}
    >
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border bg-black/20",
          active
            ? "border-amber-300/30 text-amber-100"
            : "border-white/10 text-white/70 group-hover:text-amber-100"
        )}
      >
        <Icon className="h-4 w-4" />
      </div>

      <span className="min-w-0 text-[12px] font-medium leading-4">{label}</span>
    </button>
  );
}

function MobileQuickNavPill({
  id,
  label,
  icon: Icon,
  active,
}: {
  id: string;
  label: string;
  icon: SectionIcon;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => scrollToId(id)}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium transition",
        active
          ? "border-amber-300/30 bg-amber-400/12 text-white"
          : "border-white/10 bg-white/[0.05] text-white/75 hover:border-amber-300/25 hover:bg-amber-400/10 hover:text-white"
      )}
    >
      <Icon
        className={cn(
          "h-3.5 w-3.5",
          active ? "text-amber-100" : "text-white/70"
        )}
      />
      <span className="whitespace-nowrap">{label}</span>
    </button>
  );
}

function OriginalQuickNavCard({
  navItems,
  activeId,
  shellRef,
}: {
  navItems: readonly NavItem[];
  activeId: string;
  shellRef?: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div
      ref={shellRef}
      className="relative overflow-hidden rounded-[1.6rem] border border-white/10 bg-[linear-gradient(180deg,rgba(18,18,18,0.88),rgba(8,8,8,0.82))] shadow-[0_18px_50px_rgba(0,0,0,0.4),0_8px_24px_rgba(0,0,0,0.24)] backdrop-blur-2xl"
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-200/35 to-transparent" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,215,130,0.09),transparent_45%)]" />

      <div className="relative px-4 py-4 md:px-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/55">
            <Sparkles className="h-3.5 w-3.5 text-amber-300" />
            Quick Navigation
          </div>

          <div className="hidden rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] text-white/45 sm:block">
            Scroll and it morphs into a floating quick nav
          </div>
        </div>

        <div className="-mx-1 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex min-w-max gap-2 px-1">
            {navItems.map((item) => (
              <QuickNavPill
                key={item.id}
                id={item.id}
                label={item.label}
                active={activeId === item.id}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Floating layers use `position: absolute` and compute `top` in BODY scroll
 * coordinates so they still move correctly even if a transformed ancestor
 * breaks `position: fixed`.
 */
function FloatingDesktopNavMorph({
  navItems,
  activeId,
  progress,
  fromRect,
  viewport,
  scrollTop,
}: {
  navItems: readonly NavItem[];
  activeId: string;
  progress: number;
  fromRect: RectState;
  viewport: ViewportState;
  scrollTop: number;
}) {
  if (!viewport.isDesktop) return null;

  const eased = easeInOutCubic(progress);
  const docked = progress >= 0.999;

  const targetLeft = 18;
  const targetWidth = 208;
  const targetHeight = clamp(viewport.height - 56, 440, 720);

  const viewportCenterY = viewport.height / 2;
  const targetTopDockedAbs = scrollTop + viewportCenterY;
  const targetTopDuringMorphAbs =
    scrollTop + clamp(viewport.height * 0.21, 92, 168);

  const targetTopAbs = docked ? targetTopDockedAbs : targetTopDuringMorphAbs;
  const fromTopAbs = scrollTop + (fromRect.top + fromRect.height / 2);

  const left = lerp(fromRect.left, targetLeft, eased);
  const topAbs = lerp(fromTopAbs, targetTopAbs, eased);
  const width = lerp(fromRect.width || 740, targetWidth, eased);
  const height = lerp(fromRect.height || 106, targetHeight, eased);

  const radius = lerp(26, 34, eased);

  const originalLayerOpacity = clamp(1 - progress * 1.25, 0, 1);
  const originalLayerTranslateX = lerp(0, -28, eased);
  const originalLayerTranslateY = lerp(0, -10, eased);
  const originalLayerScale = lerp(1, 0.965, eased);

  const railLayerOpacity = clamp((progress - 0.16) / 0.84, 0, 1);
  const railLayerTranslateX = lerp(24, 0, easeOutCubic(railLayerOpacity));
  const railLayerScale = lerp(0.985, 1, easeOutCubic(railLayerOpacity));

  return (
    <aside
      aria-hidden={progress < 0.01}
      className="pointer-events-none absolute z-[60] hidden lg:block"
      style={{
        left,
        top: topAbs,
        width,
        height,
        opacity: progress,
        transform: "translate3d(0,0,0) translateY(-50%)",
        willChange: "left, top, width, height, opacity, transform",
      }}
    >
      <div className="absolute inset-y-0 left-0 w-full bg-gradient-to-r from-black/48 via-black/16 to-transparent" />
      <div className="absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-white/10 to-transparent" />

      <div
        className="pointer-events-auto relative h-full overflow-hidden border border-white/10 bg-[linear-gradient(180deg,rgba(18,18,18,0.90),rgba(10,10,10,0.82))] shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-2xl"
        style={{ borderRadius: radius }}
      >
        <div className="absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-amber-200/30 to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,215,130,0.08),transparent_36%)]" />

        <div
          className="absolute inset-0"
          style={{
            opacity: originalLayerOpacity,
            transform: `translate3d(${originalLayerTranslateX}px, ${originalLayerTranslateY}px, 0) scale(${originalLayerScale})`,
            transformOrigin: "top left",
          }}
        >
          <div className="h-full px-4 py-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/55">
                <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                Quick Navigation
              </div>
            </div>

            <div className="-mx-1 overflow-hidden pb-1">
              <div className="flex min-w-max gap-2 px-1">
                {navItems.map((item) => (
                  <QuickNavPill
                    key={item.id}
                    id={item.id}
                    label={item.label}
                    active={activeId === item.id}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div
          className="absolute inset-0"
          style={{
            opacity: railLayerOpacity,
            transform: `translate3d(${railLayerTranslateX}px, 0, 0) scale(${railLayerScale})`,
            transformOrigin: "left center",
          }}
        >
          <div className="flex h-full flex-col p-3">
            <div className="mb-3 flex items-center gap-3">
              <Link
                href="/"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-amber-300/15 bg-white/[0.045] shadow-[0_10px_24px_rgba(0,0,0,0.24)] transition hover:border-amber-300/30 hover:bg-white/[0.06]"
                aria-label="Glass Guardian home"
              >
                <GlassGuardianMark size={28} />
              </Link>

              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/40">
                  Quick Nav
                </div>
                <div className="text-xs text-white/58">Ready to jump</div>
              </div>
            </div>

            <div className="mb-3 h-px w-full bg-gradient-to-r from-transparent via-white/12 to-transparent" />

            <div className="flex-1 overflow-y-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex flex-col gap-2">
                {navItems.map((item) => (
                  <RailButton
                    key={item.id}
                    id={item.id}
                    label={item.label}
                    icon={item.icon}
                    active={activeId === item.id}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function FloatingMobileNavMorph({
  navItems,
  activeId,
  progress,
  fromRect,
  viewport,
  scrollTop,
}: {
  navItems: readonly NavItem[];
  activeId: string;
  progress: number;
  fromRect: RectState;
  viewport: ViewportState;
  scrollTop: number;
}) {
  if (viewport.isDesktop) return null;

  const eased = easeInOutCubic(progress);

  const targetLeft = 12;
  const targetWidth = Math.max(320, viewport.width - 24);

  const targetTopAbs = scrollTop + (viewport.height - 96);
  const fromTopAbs = scrollTop + (fromRect.top || viewport.height - 120);

  const left = lerp(fromRect.left || 12, targetLeft, eased);
  const topAbs = lerp(fromTopAbs, targetTopAbs, eased);
  const width = lerp(fromRect.width || viewport.width - 24, targetWidth, eased);

  return (
    <div
      aria-hidden={progress < 0.01}
      className="pointer-events-none absolute z-[60] lg:hidden"
      style={{
        left,
        top: topAbs,
        width,
        opacity: progress,
        transform: `translate3d(0, ${lerp(22, 0, eased)}px, 0) scale(${lerp(
          0.98,
          1,
          eased
        )})`,
        transformOrigin: "bottom center",
        willChange: "left, top, width, opacity, transform",
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
      <div className="pointer-events-auto mx-auto w-full">
        <div className="overflow-hidden rounded-[1.45rem] border border-white/10 bg-[linear-gradient(180deg,rgba(18,18,18,0.94),rgba(8,8,8,0.90))] shadow-[0_18px_50px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-200/20 to-transparent" />
          <div className="px-3 pb-3 pt-3">
            <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45">
              <Sparkles className="h-3.5 w-3.5 text-amber-300" />
              Quick Navigation
            </div>

            <div className="-mx-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex min-w-max gap-2 px-1">
                {navItems.map((item) => (
                  <MobileQuickNavPill
                    key={item.id}
                    id={item.id}
                    label={item.label}
                    icon={item.icon}
                    active={activeId === item.id}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TermsPage() {
  const lastUpdated = "March 23, 2026";

  const quickNavSectionRef = React.useRef<HTMLElement | null>(null);
  const quickNavCardRef = React.useRef<HTMLDivElement | null>(null);

  const [viewport, setViewport] = React.useState<ViewportState>({
    width: 0,
    height: 0,
    isDesktop: true,
  });

  const [progress, setProgress] = React.useState(0);
  const [fromRect, setFromRect] = React.useState<RectState>({
    left: 24,
    top: 280,
    width: 720,
    height: 110,
  });
  const [activeId, setActiveId] = React.useState<string>("acceptance");
  const [scrollTop, setScrollTop] = React.useState(0);

  React.useEffect(() => {
    const updateViewport = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      setViewport({
        width,
        height,
        isDesktop: width >= 1024,
      });
    };

    updateViewport();
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  React.useEffect(() => {
    const scroller = document.body;
    let raf = 0;

    const update = () => {
      const card = quickNavCardRef.current;
      if (!card) return;

      const cardRectWin = card.getBoundingClientRect();
      const scrollerRectWin = scroller.getBoundingClientRect();

      const cardTopInScroller = cardRectWin.top - scrollerRectWin.top;

      const isDesktop = window.innerWidth >= 1024;
      const startOffset = isDesktop ? START_OFFSET_DESKTOP : START_OFFSET_MOBILE;
      const distance = isDesktop ? MORPH_PX_DESKTOP : MORPH_PX_MOBILE;

      const raw = (startOffset - cardTopInScroller) / distance;
      const p = clamp(raw, 0, 1);

      setProgress(p);
      setScrollTop(scroller.scrollTop);

      setFromRect({
        left: cardRectWin.left,
        top: cardRectWin.top,
        width: cardRectWin.width,
        height: cardRectWin.height,
      });
    };

    const onScrollOrResize = () => {
      cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(update);
    };

    update();
    scroller.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize);

    return () => {
      cancelAnimationFrame(raf);
      scroller.removeEventListener("scroll", onScrollOrResize as any);
      window.removeEventListener("resize", onScrollOrResize as any);
    };
  }, []);

  React.useEffect(() => {
    const sections = quickNav
      .map((item) => document.getElementById(item.id))
      .filter(Boolean) as HTMLElement[];

    if (!sections.length) return;

    let current = activeId;

    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (a, b) =>
              Math.abs(a.boundingClientRect.top) -
              Math.abs(b.boundingClientRect.top)
          );

        if (visible[0]?.target?.id && visible[0].target.id !== current) {
          current = visible[0].target.id;
          setActiveId(current);
        }
      },
      {
        rootMargin: "-18% 0px -60% 0px",
        threshold: [0.05, 0.2, 0.4, 0.6],
      }
    );

    sections.forEach((section) => io.observe(section));
    return () => io.disconnect();
  }, [activeId]);

  const originalOpacity = lerp(1, 0.14, progress);
  const originalTranslateX = viewport.isDesktop ? lerp(0, -96, progress) : 0;
  const originalTranslateY = lerp(0, -18, progress);
  const originalScale = lerp(1, 0.952, progress);

  return (
    <main className="relative min-h-screen bg-[#050505] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(245,197,66,0.14),transparent_30%),radial-gradient(circle_at_80%_20%,rgba(255,215,130,0.10),transparent_24%),linear-gradient(180deg,#080808_0%,#050505_38%,#030303_100%)]" />
        <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.07)_1px,transparent_1px)] [background-size:32px_32px]" />
        <div className="absolute left-1/2 top-0 h-[480px] w-[480px] -translate-x-1/2 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-amber-200/[0.03] to-transparent" />
      </div>

      <FloatingDesktopNavMorph
        navItems={quickNav}
        activeId={activeId}
        progress={progress}
        fromRect={fromRect}
        viewport={viewport}
        scrollTop={scrollTop}
      />

      <FloatingMobileNavMorph
        navItems={quickNav}
        activeId={activeId}
        progress={progress}
        fromRect={fromRect}
        viewport={viewport}
        scrollTop={scrollTop}
      />

      <div className="relative mx-auto w-full max-w-6xl px-4 pb-28 pt-8 sm:px-6 lg:px-8 lg:pb-16 lg:pl-[220px] lg:pt-10">
        <div className="flex min-w-0 flex-col gap-8">
          <div className="flex items-center justify-between gap-4">
            <Link
              href="/user/login"
              className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/80 transition hover:border-amber-300/30 hover:bg-white/[0.07] hover:text-white"
            >
              <ChevronLeft className="h-4 w-4" />
              Back to Login
            </Link>

            <Link
              href="/legal/privacy"
              className="inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-400/10 px-4 py-2 text-sm text-amber-200 transition hover:bg-amber-400/15"
            >
              View Privacy Policy
            </Link>
          </div>

          <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.05] p-6 shadow-[0_30px_100px_rgba(0,0,0,0.45)] backdrop-blur-2xl md:p-10">
            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,215,130,0.08),transparent_40%,transparent_60%,rgba(255,215,130,0.05))]" />
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-200/30 to-transparent" />

            <div className="relative z-10 max-w-3xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-amber-200">
                <ShieldCheck className="h-3.5 w-3.5" />
                Glass Guardian Legal
              </div>

              <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl md:text-5xl">
                Terms of Service
              </h1>

              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/72 sm:text-[15px]">
                These Terms of Service govern your access to and use of Glass
                Guardian’s website, booking tools, communication channels, and
                windshield chip and crack repair services.
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-white/65">
                <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5">
                  Last updated: {lastUpdated}
                </span>
                <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5">
                  Applies to website, booking, mobile service, and customer communication
                </span>
              </div>
            </div>
          </section>

          <section
            ref={quickNavSectionRef}
            className="relative z-[90]"
            style={{
              opacity: originalOpacity,
              transform: `translate3d(${originalTranslateX}px, ${originalTranslateY}px, 0) scale(${originalScale})`,
              transformOrigin: "top left",
              willChange: "opacity, transform",
            }}
          >
            <OriginalQuickNavCard
              navItems={quickNav}
              activeId={activeId}
              shellRef={quickNavCardRef}
            />
          </section>

          <div className="grid gap-6">
            <Section id="acceptance" title="Acceptance of Terms" icon={FileText}>
              <p>
                By accessing this website, submitting a booking request, messaging
                Glass Guardian, requesting a quote, scheduling service, or using
                our services, you agree to be bound by these Terms of Service and
                our Privacy Policy.
              </p>
              <p>
                If you do not agree to these terms, please do not use our website,
                booking tools, communication channels, or services.
              </p>
            </Section>

            <Section id="services" title="Services We Provide" icon={Wrench}>
              <p>
                Glass Guardian provides windshield chip repair, crack repair,
                related mobile auto glass services, scheduling support, customer
                communication, and related business operations.
              </p>

              <BulletList
                items={[
                  <>Service availability may vary by location, distance, traffic, weather, safety conditions, technician capacity, and operating hours.</>,
                  <>Not all damage is repairable. Some chips, cracks, or glass conditions may require full replacement rather than repair.</>,
                  <>A booking request or quote request does not guarantee service until it is reviewed, accepted, and scheduled by Glass Guardian.</>,
                  <>We reserve the right to refuse, limit, or discontinue service where repair is unsafe, impractical, unavailable, outside our service area, or outside our operating scope.</>,
                ]}
              />
            </Section>

            <Section id="booking" title="Appointments and Scheduling" icon={Scale}>
              <p>
                When you request an appointment, you agree to provide accurate
                contact, vehicle, location, insurance, and service information.
              </p>

              <BulletList
                items={[
                  <>Appointment windows are estimates and may be adjusted due to traffic, weather, prior jobs, technician availability, safety conditions, parts delays, or other service factors.</>,
                  <>You are responsible for ensuring that the vehicle is accessible and that the service location is safe, lawful, and appropriate for mobile work.</>,
                  <>If we cannot safely perform the service at the requested location, we may reschedule, relocate, or cancel the appointment.</>,
                  <>Same-day service and requested time slots are subject to availability and are not guaranteed until confirmed by Glass Guardian.</>,
                  <>We may cancel or reschedule appointments when circumstances outside our control prevent safe, lawful, or proper service.</>,
                ]}
              />
            </Section>

            <Section
              id="payments"
              title="Pricing, Estimates, and Payment"
              icon={CreditCard}
            >
              <p>
                Pricing displayed on the website, in messages, in advertisements,
                or in verbal or written estimates may change based on final
                inspection, vehicle condition, damage severity, service location,
                materials, labor, taxes, fees, or other job-specific factors.
              </p>

              <BulletList
                items={[
                  <>Quotes and estimates are informational until the job is confirmed and inspected.</>,
                  <>Additional charges may apply if the actual condition of the glass, vehicle, or service requirements differ from the original request.</>,
                  <>Payment is due at the time of service unless another arrangement is expressly approved by Glass Guardian.</>,
                  <>If online payments are used, third-party processors may apply their own terms, fees, security checks, and processing rules.</>,
                  <>You agree not to initiate unfair, false, or fraudulent chargebacks for valid completed services.</>,
                ]}
              />
            </Section>

            <Section
              id="warranty"
              title="Warranty and Repair Limitations"
              icon={ShieldCheck}
            >
              <p>
                Glass Guardian may offer a limited warranty on eligible repairs.
                Any warranty offered is subject to the specific terms provided at
                the time of service, on your invoice, receipt, or warranty
                documentation.
              </p>

              <BulletList
                items={[
                  <>A repair may improve structural integrity and appearance, but repaired damage may still remain partially visible.</>,
                  <>Not every repair will restore the glass to pre-damage optical condition.</>,
                  <>A warranty may be limited or unavailable if the damage was previously repaired, if the glass is compromised beyond repair standards, or if additional cracking or impact occurs after service.</>,
                  <>Warranty coverage does not apply to unrelated breakage, misuse, post-service impact, vandalism, collisions, replacement needs outside the repairable area, or conditions outside the original repair scope.</>,
                ]}
              />

              <p>
                Any warranty, if provided, is limited to the scope expressly
                offered by Glass Guardian and does not create broader guarantees
                beyond what is clearly stated.
              </p>
            </Section>

            <Section
              id="liability"
              title="Disclaimers and Limitation of Liability"
              icon={AlertTriangle}
            >
              <p>
                Glass Guardian provides services on an as-available and
                as-permitted basis. To the fullest extent permitted by law, our
                services, website, scheduling tools, and communications are
                provided without warranties of any kind except where an express
                written warranty is specifically given.
              </p>

              <BulletList
                items={[
                  <>We do not guarantee that every chip or crack can be successfully repaired.</>,
                  <>We do not guarantee uninterrupted website availability, error-free booking tools, or continuous access to digital features.</>,
                  <>To the fullest extent permitted by law, Glass Guardian is not liable for indirect, incidental, special, consequential, exemplary, or punitive damages arising from use of the website or services.</>,
                  <>Our maximum liability for any claim relating to a service, appointment, estimate, or transaction will not exceed the amount actually paid by you to Glass Guardian for the specific service giving rise to the claim, unless applicable law requires otherwise.</>,
                ]}
              />
            </Section>

            <Section id="website" title="Website Use and Prohibited Conduct" icon={Ban}>
              <p>
                You agree to use this website lawfully and not to misuse,
                disrupt, damage, or interfere with our services, systems, brand,
                forms, staff, or users.
              </p>

              <BulletList
                items={[
                  <>Do not submit false bookings, false claims, inaccurate service requests, or misleading information.</>,
                  <>Do not attempt to gain unauthorized access to any part of the website, forms, accounts, systems, storage, or connected services.</>,
                  <>Do not upload malicious code, spam, abusive content, or unlawful material.</>,
                  <>Do not use our website, name, content, logo, or brand in a way that infringes our rights or harms our reputation.</>,
                ]}
              />
            </Section>

            <Section id="communications" title="Communications and Consent" icon={Mail}>
              <p>
                By contacting Glass Guardian or submitting your information
                through the website, you consent to receive service-related
                communications from us, including appointment confirmations,
                reminders, updates, invoices, receipts, warranty information, and
                customer support messages.
              </p>
              <p>
                Message and data rates may apply depending on your carrier and
                device plan if SMS, MMS, or similar messaging is used.
              </p>
            </Section>

            <Section id="changes" title="Changes to These Terms" icon={FileText}>
              <p>
                We may update these Terms of Service from time to time. When we
                do, we will revise the “Last updated” date on this page.
              </p>
              <p>
                Continued use of our website, communication channels, booking
                tools, or services after updated terms are posted means you
                accept the updated terms.
              </p>
            </Section>

            <Section id="governing-law" title="Governing Law" icon={Scale}>
              <p>
                These Terms of Service shall be governed by and interpreted
                under the laws applicable in the jurisdiction where Glass
                Guardian operates, without regard to conflict of law principles,
                except as otherwise required by applicable law.
              </p>
            </Section>

            <Section id="contact" title="Contact Us" icon={PhoneCall}>
              <p>
                If you have questions about these Terms of Service, please
                contact Glass Guardian using the contact information made
                available on our website.
              </p>

              <div className="grid gap-3 pt-2 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                  <div className="mb-1 text-xs uppercase tracking-[0.18em] text-white/45">
                    Legal / Support
                  </div>
                  <div className="text-sm text-white/80">
                    info@glassguardianchipandcrackrepair.com
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                  <div className="mb-1 text-xs uppercase tracking-[0.18em] text-white/45">
                    Website
                  </div>
                  <div className="text-sm text-white/80 break-all">
                    glassguardianchipandcrackrepair.com
                  </div>
                </div>
              </div>
            </Section>
          </div>
        </div>
      </div>
    </main>
  );
}