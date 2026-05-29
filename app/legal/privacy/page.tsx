"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Shield,
  Lock,
  Database,
  Mail,
  Phone,
  MapPin,
  FileText,
  ChevronLeft,
  ChevronRight,
  Eye,
  UserCheck,
  RefreshCw,
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
      className="scroll-mt-28 rounded-[1.75rem] border border-white/10 bg-white/[0.042] p-6 shadow-[0_20px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl md:p-8"
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

const quickNav: readonly NavItem[] = [
  { id: "collect", label: "Collect", icon: Database },
  { id: "use", label: "Use", icon: UserCheck },
  { id: "share", label: "Sharing", icon: Eye },
  { id: "cookies", label: "Cookies", icon: RefreshCw },
  { id: "security", label: "Security", icon: Lock },
  { id: "retention", label: "Retention", icon: FileText },
  { id: "rights", label: "Choices", icon: Shield },
  { id: "children", label: "Children", icon: Shield },
  { id: "third-party", label: "Third Party", icon: MapPin },
  { id: "changes", label: "Changes", icon: RefreshCw },
  { id: "contact", label: "Contact", icon: Mail },
];

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
      aria-label={`Jump to ${label}`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        scrollToId(id);
      }}
      className={cn(
        // z-20 ensures pills sit above any gradient fade overlays
        "group relative z-20 inline-flex shrink-0 items-center rounded-full border px-3.5 py-2 text-sm transition duration-200",
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
      aria-label={label}
      onClick={() => scrollToId(id)}
      className={cn(
        "inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium transition",
        active
          ? "border-amber-300/30 bg-amber-400/12 text-white"
          : "border-white/10 bg-white/[0.05] text-white/75 hover:border-amber-300/25 hover:bg-amber-400/10 hover:text-white"
      )}
    >
      <Icon
        className={cn("h-3.5 w-3.5", active ? "text-amber-100" : "text-white/70")}
      />
      <span className="whitespace-nowrap">{label}</span>
    </button>
  );
}

/**
 * FIX (top quick nav only):
 * The pills weren't clickable because the LEFT/RIGHT gradient fade overlays were
 * sitting above the pills in stacking order (z-10), even though they were
 * pointer-events-none. In some browser/layout combos, this still prevents
 * click targeting correctly, especially with transforms/backdrop blur.
 *
 * Fix:
 * - move fades to z-0
 * - ensure scroller content/pills are z-10+
 * - keep arrows on top (z-30)
 *
 * Also:
 * - keep wheel-to-horizontal behavior, but only preventDefault when it will move.
 */
function OriginalQuickNavCard({
  navItems,
  activeId,
  shellRef,
}: {
  navItems: readonly NavItem[];
  activeId: string;
  shellRef?: React.RefObject<HTMLDivElement | null>;
}) {
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = React.useState(false);
  const [canScrollRight, setCanScrollRight] = React.useState(false);
  const [isHovering, setIsHovering] = React.useState(false);

  const updateArrows = React.useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    const max = el.scrollWidth - el.clientWidth;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(max - el.scrollLeft > 2);
  }, []);

  const scrollByAmount = React.useCallback((dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;

    const amount = Math.max(220, Math.round(el.clientWidth * 0.55));
    el.scrollBy({
      left: dir === "left" ? -amount : amount,
      behavior: "smooth",
    });
  }, []);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    let raf = 0;

    const runUpdate = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(updateArrows);
    };

    const onScroll = () => runUpdate();
    const onResize = () => runUpdate();

    const onWheel = (event: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth) return;

      const mostlyVertical = Math.abs(event.deltaY) > Math.abs(event.deltaX);
      if (!mostlyVertical) return;

      const max = el.scrollWidth - el.clientWidth;

      const wouldMove =
        (event.deltaY < 0 && el.scrollLeft > 0) ||
        (event.deltaY > 0 && el.scrollLeft < max);

      if (!wouldMove) return;

      event.preventDefault();
      el.scrollLeft = Math.max(0, Math.min(max, el.scrollLeft + event.deltaY));
      runUpdate();
    };

    runUpdate();

    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("resize", onResize);

    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => runUpdate())
        : null;

    if (ro) {
      ro.observe(el);
      if (el.firstElementChild instanceof HTMLElement) {
        ro.observe(el.firstElementChild);
      }
    }

    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("wheel", onWheel);
      window.removeEventListener("resize", onResize);
      ro?.disconnect();
    };
  }, [updateArrows]);

  const showLeftArrow = canScrollLeft;
  const showRightArrow = canScrollRight;

  return (
    <div
      ref={shellRef}
      className="relative overflow-hidden rounded-[1.7rem] border border-white/10 bg-[linear-gradient(180deg,rgba(18,18,18,0.88),rgba(8,8,8,0.82))] shadow-[0_18px_50px_rgba(0,0,0,0.4),0_8px_24px_rgba(0,0,0,0.24)] backdrop-blur-2xl"
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-200/35 to-transparent" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,215,130,0.09),transparent_45%)]" />

      <div className="relative px-5 py-5 md:px-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/55">
            <Sparkles className="h-3.5 w-3.5 text-amber-300" />
            Quick Navigation
          </div>

          <div className="hidden rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] text-white/45 sm:block">
            Scroll and it morphs into a floating quick nav
          </div>
        </div>

        <div
          className="relative"
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
        >
          {/* edge fades (BEHIND content now) */}
          <div
            className={cn(
              "pointer-events-none absolute inset-y-0 left-0 z-0 w-10 bg-gradient-to-r from-[#0b0b0b] to-transparent transition-opacity duration-250",
              showLeftArrow ? "opacity-100" : "opacity-0"
            )}
          />
          <div
            className={cn(
              "pointer-events-none absolute inset-y-0 right-0 z-0 w-12 bg-gradient-to-l from-[#0b0b0b] to-transparent transition-opacity duration-250",
              showRightArrow ? "opacity-100" : "opacity-0"
            )}
          />

          {/* arrows (on top) */}
          <button
            type="button"
            aria-label="Scroll quick navigation left"
            onClick={() => scrollByAmount("left")}
            className={cn(
              "absolute left-1.5 top-1/2 z-30 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/55 text-white/85 shadow-[0_12px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl transition-all duration-250 md:flex",
              showLeftArrow && isHovering
                ? "pointer-events-auto translate-x-0 opacity-100"
                : "pointer-events-none -translate-x-2 opacity-0"
            )}
          >
            <ChevronLeft className="h-4.5 w-4.5" />
          </button>

          <button
            type="button"
            aria-label="Scroll quick navigation right"
            onClick={() => scrollByAmount("right")}
            className={cn(
              "absolute right-1.5 top-1/2 z-30 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/55 text-white/85 shadow-[0_12px_30px_rgba(0,0,0,0.35)] backdrop-blur-xl transition-all duration-250 md:flex",
              showRightArrow && isHovering
                ? "pointer-events-auto translate-x-0 opacity-100"
                : "pointer-events-none translate-x-2 opacity-0"
            )}
          >
            <ChevronRight className="h-4.5 w-4.5" />
          </button>

          {/* pills scroller (content above fades) */}
          <div
            ref={scrollRef}
            tabIndex={0}
            className={cn(
              "relative z-10 -mx-1 overflow-x-auto overflow-y-hidden pb-1",
              "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
              "touch-pan-x overscroll-x-contain",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/35 focus-visible:ring-offset-0"
            )}
          >
            <div className="inline-flex min-w-max gap-2 px-1 pr-36">
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
    </div>
  );
}

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
  const targetWidth = 196;
  const targetHeight = clamp(viewport.height - 64, 430, 700);

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
              <div className="inline-flex min-w-max gap-2 px-1">
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
                <Image
                  src="/branding/glass-guardian-gold.png"
                  alt="Glass Guardian"
                  width={28}
                  height={28}
                  className="h-auto w-auto max-h-[28px] max-w-[28px] object-contain"
                  priority
                />
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

            <div
              className={cn(
                "-mx-1 overflow-x-auto overflow-y-hidden",
                "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
                "touch-pan-x overscroll-x-contain"
              )}
            >
              <div className="inline-flex min-w-max gap-2 px-1 pr-28">
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

export default function PrivacyPage() {
  const lastUpdated = "March 23, 2026";

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

  const [activeId, setActiveId] = React.useState<string>("collect");
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
        <div className="absolute right-10 top-12 h-[360px] w-[360px] rounded-full bg-amber-400/10 blur-3xl" />
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

      <div className="relative mx-auto w-full max-w-[1000px] px-4 pb-16 pt-8 sm:px-6 lg:px-8 lg:pb-16 lg:pl-[196px] lg:pt-10 xl:px-8">
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
              href="/legal/terms"
              className="inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-400/10 px-4 py-2 text-sm text-amber-200 transition hover:bg-amber-400/15"
            >
              View Terms
            </Link>
          </div>

          <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.05] p-6 shadow-[0_30px_100px_rgba(0,0,0,0.45)] backdrop-blur-2xl md:p-10">
            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,215,130,0.08),transparent_40%,transparent_60%,rgba(255,215,130,0.05))]" />
            <div className="relative z-10 max-w-4xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-amber-200">
                <Shield className="h-3.5 w-3.5" />
                Glass Guardian Legal
              </div>

              <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl md:text-5xl">
                Privacy Policy
              </h1>

              <p className="mt-4 max-w-3xl text-sm leading-7 text-white/72 sm:text-[15px]">
                This Privacy Policy explains how Glass Guardian collects, uses,
                stores, and protects information when you use our website, book
                an appointment, request service, or communicate with us.
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-white/65">
                <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5">
                  Last updated: {lastUpdated}
                </span>
                <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5">
                  Applies to visitors, leads, and customers
                </span>
              </div>
            </div>
          </section>

          <section
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

          <div className="grid gap-6 xl:gap-7">
            <Section id="collect" title="Information We Collect" icon={Database}>
              <p>
                We may collect information that you voluntarily provide when you
                interact with Glass Guardian, including when you fill out forms,
                request quotes, book appointments, message us, or pay for
                services.
              </p>

              <BulletList
                items={[
                  <>Contact details such as your name, phone number, email address, and service address or ZIP code.</>,
                  <>Vehicle and service details such as make, model, year, damage information, scheduling preferences, and uploaded photos.</>,
                  <>Transaction details such as invoices, receipts, payment status, and service history.</>,
                  <>Communications you send to us, including support requests, booking notes, and messages.</>,
                  <>Basic technical data that may be collected automatically, such as browser type, device type, pages visited, referring pages, IP address (often in a limited form), and general usage analytics.</>,
                ]}
              />
            </Section>

            <Section id="use" title="How We Use Your Information" icon={UserCheck}>
              <p>
                We use collected information to operate, improve, and protect
                our business and customer experience.
              </p>

              <BulletList
                items={[
                  <>To schedule, confirm, provide, and support requested services.</>,
                  <>To communicate with you about appointments, updates, invoices, receipts, and customer care.</>,
                  <>To process payments and maintain business records.</>,
                  <>To improve our website, forms, service operations, and internal workflows.</>,
                  <>To detect fraud, abuse, unauthorized activity, or legal violations.</>,
                  <>To comply with legal obligations and resolve disputes when necessary.</>,
                ]}
              />
            </Section>

            <Section id="share" title="How We May Share Information" icon={Eye}>
              <p>
                We do not sell your personal information. We may share
                information only as reasonably necessary to run our services and
                business.
              </p>

              <BulletList
                items={[
                  <>With service providers or technology vendors that help us operate our website, scheduling systems, messaging, payment processing, storage, analytics, or customer support.</>,
                  <>With insurers, administrators, or other parties when needed to support an insurance-related service or claim that you request or authorize.</>,
                  <>When disclosure is required by law, subpoena, court order, regulation, or similar legal process.</>,
                  <>When reasonably necessary to protect rights, safety, property, customers, staff, or the public.</>,
                  <>In connection with a business transfer, merger, sale, financing, or acquisition, subject to appropriate handling of data.</>,
                ]}
              />
            </Section>

            <Section id="cookies" title="Cookies and Analytics" icon={RefreshCw}>
              <p>
                Our website may use cookies, local storage, analytics tools, and
                similar technologies to remember preferences, improve
                performance, measure traffic, and support functionality.
              </p>

              <p>
                These technologies may help us understand how visitors interact
                with pages, booking flows, and service content so we can improve
                the experience.
              </p>
            </Section>

            <Section id="security" title="Data Security" icon={Lock}>
              <p>
                Glass Guardian takes reasonable administrative, technical, and
                organizational steps to protect information from unauthorized
                access, misuse, alteration, disclosure, or destruction.
              </p>
              <p>
                However, no website, network, device, or transmission method is
                completely secure. Because of this, we cannot guarantee absolute
                security.
              </p>
            </Section>

            <Section id="retention" title="Data Retention" icon={FileText}>
              <p>
                We retain information for as long as reasonably necessary for
                the purposes described in this Privacy Policy, including for
                service records, customer support, accounting, fraud prevention,
                legal compliance, dispute resolution, and enforcement of
                agreements.
              </p>
            </Section>

            <Section id="rights" title="Your Privacy Choices" icon={Shield}>
              <p>
                Depending on your location and applicable law, you may have
                rights regarding personal information we hold about you.
              </p>

              <BulletList
                items={[
                  <>You may request access to certain personal information we have about you.</>,
                  <>You may request correction of inaccurate information.</>,
                  <>You may request deletion of certain information, subject to legal, operational, and recordkeeping requirements.</>,
                  <>You may opt out of certain non-essential communications by following the instructions in those messages or contacting us directly.</>,
                ]}
              />

              <p>
                We may need to verify your identity before processing certain
                requests.
              </p>
            </Section>

            <Section id="children" title="Children’s Privacy" icon={Shield}>
              <p>
                Our website and services are not directed to children under 13,
                and we do not knowingly collect personal information from
                children under 13 through the website.
              </p>
            </Section>

            <Section
              id="third-party"
              title="Third-Party Links and Services"
              icon={MapPin}
            >
              <p>
                Our website may contain links to third-party services, maps,
                payment tools, or external websites. We are not responsible for
                the privacy practices, content, or policies of third parties.
              </p>
            </Section>

            <Section id="changes" title="Changes to This Policy" icon={RefreshCw}>
              <p>
                We may update this Privacy Policy from time to time. When we do,
                we will update the “Last updated” date on this page. Continued
                use of our website or services after changes are posted means
                you accept the updated policy.
              </p>
            </Section>

            <Section id="contact" title="Contact Us" icon={Mail}>
              <p>
                If you have questions about this Privacy Policy or want to make
                a privacy-related request, please contact Glass Guardian using
                the contact information available on our website.
              </p>

              <div className="grid gap-3 pt-2 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="mb-1 text-xs uppercase tracking-[0.18em] text-white/45">
                    Business
                  </div>
                  <div className="text-sm text-white/80">Glass Guardian</div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-white/45">
                    <Phone className="h-3.5 w-3.5" />
                    Service Contact
                  </div>
                  <div className="text-sm text-white/80">
                    Use website contact or booking form
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="mb-1 text-xs uppercase tracking-[0.18em] text-white/45">
                    Website
                  </div>
                  <div className="break-all text-sm text-white/80">
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