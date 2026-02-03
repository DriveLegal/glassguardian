"use client";

import * as React from "react";

export default function SpookyAudio({
  src = "/audio/michael-myers-theme.mp3",
  quickRiseMs = 500,
  initialVolume = 0.25,
  softVolume = 0.10,
  fadeOutMs = 600,
  fadeSoftMs = 6000,
  softAfterMs = 8000,
  loop = true,
  zIndex = 120,
  btnLabels = { play: "🎵 Theme On", stop: "🔇 Theme Off" },
}: {
  src?: string;
  quickRiseMs?: number;
  initialVolume?: number;
  softVolume?: number;
  fadeOutMs?: number;
  fadeSoftMs?: number;
  softAfterMs?: number;
  loop?: boolean;
  zIndex?: number;
  btnLabels?: { play: string; stop: string };
}) {
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = React.useState(false);
  const fadeStopRef = React.useRef<() => void>(() => {});
  const softTimerRef = React.useRef<number | null>(null);

  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  const ease = (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t);

  const cancelFade = React.useCallback(() => {
    fadeStopRef.current();
    fadeStopRef.current = () => {};
  }, []);

  const fadeTo = React.useCallback(
    (to: number, ms: number) => {
      const el = audioRef.current;
      if (!el) return Promise.resolve();
      cancelFade();

      const startVol = el.volume;
      const target = clamp(to);
      let stop = false;
      fadeStopRef.current = () => (stop = true);

      return new Promise<void>((resolve) => {
        const start = performance.now();
        const loop = (now: number) => {
          if (stop) return resolve();
          const t = Math.min(1, (now - start) / ms);
          el.volume = startVol + (target - startVol) * ease(t);
          if (t < 1) requestAnimationFrame(loop);
          else resolve();
        };
        requestAnimationFrame(loop);
      });
    },
    [cancelFade]
  );

  const scheduleSoftFade = React.useCallback(() => {
    if (softTimerRef.current) clearTimeout(softTimerRef.current);
    softTimerRef.current = window.setTimeout(
      async () => await fadeTo(softVolume, fadeSoftMs),
      softAfterMs
    );
  }, [fadeTo, softVolume, fadeSoftMs, softAfterMs]);

  const startPlayback = React.useCallback(async () => {
    const el = audioRef.current;
    if (!el) return;

    cancelFade();
    if (softTimerRef.current) clearTimeout(softTimerRef.current);

    el.volume = 0;
    el.muted = false;

    try {
      await el.play();
      setPlaying(true);
      await fadeTo(initialVolume, quickRiseMs);
      scheduleSoftFade();
    } catch (e) {
      console.warn("[SpookyAudio] Play failed:", e);
    }
  }, [cancelFade, fadeTo, initialVolume, quickRiseMs, scheduleSoftFade]);

  const stopPlayback = React.useCallback(async () => {
    const el = audioRef.current;
    if (!el) return;
    cancelFade();
    if (softTimerRef.current) clearTimeout(softTimerRef.current);
    await fadeTo(0, fadeOutMs);
    el.pause();
    setPlaying(false);
  }, [cancelFade, fadeTo, fadeOutMs]);

  const toggle = async () => (playing ? stopPlayback() : startPlayback());

  return (
    <>
      <audio ref={audioRef} src={src} loop={loop} preload="auto" crossOrigin="anonymous" />

      <button
        onClick={toggle}
        aria-pressed={playing}
        aria-label={playing ? btnLabels.stop : btnLabels.play}
        title={playing ? btnLabels.stop : btnLabels.play}
        className={`spooky-btn ${playing ? "active" : ""}`}
        style={{
          position: "fixed",
          top: "calc(var(--header-h, 72px) + 8px)",
          right: 16,
          zIndex,
        }}
      >
        {playing ? btnLabels.stop : btnLabels.play}
        <style jsx>{`
          .spooky-btn {
            background: rgba(0, 0, 0, 0.7);
            color: #fff;
            border: 1px solid rgba(255, 255, 255, 0.25);
            border-radius: 12px;
            padding: 8px 14px;
            font-weight: 600;
            cursor: pointer;
            font-size: 14px;
            backdrop-filter: blur(6px);
            -webkit-backdrop-filter: blur(6px);
            transition: all 0.4s ease;
            box-shadow: 0 0 0 rgba(255, 122, 24, 0);
          }

          .spooky-btn:hover {
            background: rgba(255, 122, 24, 0.2);
            border-color: rgba(255, 122, 24, 0.5);
          }

          .spooky-btn.active {
            background: rgba(255, 122, 24, 0.2);
            border-color: rgba(255, 122, 24, 0.6);
            box-shadow: 0 0 12px 2px rgba(255, 122, 24, 0.55),
              0 0 30px rgba(255, 122, 24, 0.35);
            animation: pulseGlow 1.8s ease-in-out infinite;
          }

          @keyframes pulseGlow {
            0% {
              box-shadow: 0 0 8px 2px rgba(255, 122, 24, 0.5),
                0 0 24px rgba(255, 122, 24, 0.3);
            }
            50% {
              box-shadow: 0 0 18px 4px rgba(255, 122, 24, 0.7),
                0 0 36px rgba(255, 122, 24, 0.5);
            }
            100% {
              box-shadow: 0 0 8px 2px rgba(255, 122, 24, 0.5),
                0 0 24px rgba(255, 122, 24, 0.3);
            }
          }
        `}</style>
      </button>
    </>
  );
}