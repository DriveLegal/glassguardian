// components/visual/HeroBackground3D.tsx
"use client";

import * as React from "react";

export default function HeroBackground3D() {
  const hostRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    let mounted = true;

    let renderer: any = null;
    let scene: any = null;
    let camera: any = null;
    let pmrem: any = null;
    let currentEnv: any = null;

    let canvas: HTMLCanvasElement | null = null;
    let ro: ResizeObserver | null = null;

    let raf: number | null = null;
    let pausedByVisibility = false;
    let restarting = false;

    // ── Config ────────────────────────────────────────────────────────
    const SHOW_BACKGROUND = false;
    const USE_WEBGPU = false;

    const ENABLE_MOUSE_PARALLAX = true;
    const PARALLAX_X = 0.12;
    const PARALLAX_Y = 0.08;
    const BREATHING_Z = 0.045;
    const BREATHING_SPEED = 0.00038;
    const MOUSE_LERP = 0.075;

    const DPR_CAP = 1.6;
    const ENVIRONMENT_INTENSITY = 0.98;

    // ── State ─────────────────────────────────────────────────────────
    let mouseMoveHandler: ((e: MouseEvent) => void) | null = null;
    let touchMoveHandler: ((e: TouchEvent) => void) | null = null;
    let onContextLost: ((e: Event) => void) | null = null;
    let onContextRestored: (() => void) | null = null;

    let targetX = 0;
    let targetY = 0;
    let mouseX = 0;
    let mouseY = 0;

    const clamp = (v: number, min: number, max: number) =>
      Math.max(min, Math.min(max, v));

    const cancelRAF = () => {
      if (raf !== null) cancelAnimationFrame(raf);
      raf = null;
    };

    const safeDispose = (x: any) => {
      try {
        x?.dispose?.();
      } catch {}
    };

    const abs = (p: string) =>
      p.startsWith("http")
        ? p
        : `${window.location.origin}${p.startsWith("/") ? "" : "/"}${p}`;

    const getSafeSize = (root: HTMLElement) => {
      const r = root.getBoundingClientRect();
      return {
        w: Math.floor(r.width || root.clientWidth || 0),
        h: Math.floor(r.height || root.clientHeight || 0),
      };
    };

    const cleanup = (opts?: { loseContext?: boolean }) => {
      cancelRAF();

      try {
        ro?.disconnect();
      } catch {}
      ro = null;

      try {
        if (mouseMoveHandler) window.removeEventListener("mousemove", mouseMoveHandler);
      } catch {}
      try {
        if (touchMoveHandler) window.removeEventListener("touchmove", touchMoveHandler);
      } catch {}
      mouseMoveHandler = touchMoveHandler = null;

      try {
        if (canvas) {
          if (onContextLost)
            canvas.removeEventListener("webglcontextlost", onContextLost as any);
          if (onContextRestored)
            canvas.removeEventListener("webglcontextrestored", onContextRestored as any);
        }
      } catch {}
      onContextLost = onContextRestored = null;

      try {
        if (scene) {
          scene.environment = null;
          scene.background = null;
        }
      } catch {}

      safeDispose(currentEnv);
      currentEnv = null;

      try {
        pmrem?.dispose?.();
        pmrem?.releaseMaterial?.();
      } catch {}
      pmrem = null;

      // IMPORTANT: losing context on iOS can cause weird “precision null” crashes later.
      // Default is FALSE unless explicitly requested.
      if (opts?.loseContext) {
        try {
          const gl = renderer?.getContext?.();
          gl?.getExtension?.("WEBGL_lose_context")?.loseContext?.();
        } catch {}
      }

      safeDispose(renderer);
      renderer = null;

      try {
        if (canvas && hostRef.current?.contains(canvas)) {
          hostRef.current.removeChild(canvas);
        }
      } catch {}
      canvas = null;

      scene = null;
      camera = null;
    };

    const onVisibility = () => {
      pausedByVisibility = document.visibilityState === "hidden";
      if (!pausedByVisibility && raf === null && mounted) {
        raf = requestAnimationFrame(loop);
      } else if (pausedByVisibility) {
        cancelRAF();
      }
    };

    const loop = () => {
      if (!mounted || pausedByVisibility || !renderer || !scene || !camera) {
        cancelRAF();
        return;
      }

      raf = requestAnimationFrame(loop);

      mouseX += (targetX - mouseX) * MOUSE_LERP;
      mouseY += (targetY - mouseY) * MOUSE_LERP;

      const t = Date.now();
      camera.position.x = mouseX * PARALLAX_X;
      camera.position.y = mouseY * PARALLAX_Y;
      camera.position.z = 1 + Math.sin(t * BREATHING_SPEED) * BREATHING_Z;
      camera.lookAt(0, 0, 0);

      try {
        renderer.render(scene, camera);
      } catch {}
    };

    const init = async () => {
      if (!mounted || restarting) return;
      restarting = true;

      // If init is called again (context restore), hard cleanup first (no loseContext)
      cleanup({ loseContext: false });

      try {
        if ("requestIdleCallback" in window) {
          await new Promise<void>((resolve) => {
            (window as any).requestIdleCallback(resolve, { timeout: 1000 });
          });
        }

        if (!mounted) return;

        const root = hostRef.current;
        if (!root) return;

        await new Promise<void>((r) => requestAnimationFrame(() => r()));
        if (!mounted) return;

        const { w, h } = getSafeSize(root);
        if (w < 2 || h < 2) return;

        // Probe WebGL support safely (separate canvas)
        const testCanvas = document.createElement("canvas");
        const testGL =
          testCanvas.getContext("webgl", {
            alpha: true,
            antialias: true,
            premultipliedAlpha: false,
            failIfMajorPerformanceCaveat: true,
          }) ||
          testCanvas.getContext("experimental-webgl", {
            alpha: true,
            antialias: true,
            premultipliedAlpha: false,
            failIfMajorPerformanceCaveat: true,
          });

        if (!testGL) return;

        canvas = document.createElement("canvas");
        canvas.width = Math.max(2, w);
        canvas.height = Math.max(2, h);
        canvas.style.cssText = `
          position: absolute; inset: 0; width: 100%; height: 100%;
          z-index: -1; pointer-events: none;
          opacity: 0.55; filter: saturate(1.13) contrast(1.06) blur(0.2px);
          mix-blend-mode: screen;
        `;
        root.appendChild(canvas);

        // Stable WebGL1 context (this is the “precision null” fix)
        const gl =
          canvas.getContext("webgl", {
            alpha: true,
            antialias: true,
            premultipliedAlpha: false,
            depth: true,
            stencil: false,
            preserveDrawingBuffer: false,
            powerPreference: "high-performance",
            failIfMajorPerformanceCaveat: true,
          }) ||
          canvas.getContext("experimental-webgl", {
            alpha: true,
            antialias: true,
            premultipliedAlpha: false,
            depth: true,
            stencil: false,
            preserveDrawingBuffer: false,
            powerPreference: "high-performance",
            failIfMajorPerformanceCaveat: true,
          });

        if (!gl) return;

        onContextLost = (e: Event) => {
          try {
            (e as any).preventDefault?.();
          } catch {}
          pausedByVisibility = true;
          cancelRAF();
        };

        onContextRestored = () => {
          if (!mounted) return;
          pausedByVisibility = false;
          init().catch(() => {});
        };

        canvas.addEventListener("webglcontextlost", onContextLost as any, false);
        canvas.addEventListener("webglcontextrestored", onContextRestored as any, false);

        const THREE = await import("three");

        let RendererClass: any = THREE.WebGLRenderer;
        let usingWebGPU = false;

        if (USE_WEBGPU && "gpu" in navigator) {
          try {
            const { WebGPURenderer } = await import("three/webgpu");
            RendererClass = WebGPURenderer;
            usingWebGPU = true;
          } catch (err) {
            console.warn("[Hero3D] WebGPU unavailable → WebGL", err);
          }
        }

        try {
          renderer = new RendererClass({
            canvas,
            context: usingWebGPU ? undefined : gl,
            antialias: true,
            alpha: true,
            powerPreference: "high-performance",
            ...(usingWebGPU ? {} : { precision: "mediump" }),
          });

          renderer.shadowMap.enabled = false;
          // Keep default autoClear=true (prevents “ghosting” on some iOS GPUs)
        } catch (err) {
          console.error("[Hero3D] Renderer failed", err);
          return;
        }

        const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
        renderer.setPixelRatio(dpr);
        renderer.setSize(w, h, false);

        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 0.9;
        (renderer as any).outputColorSpace = THREE.SRGBColorSpace;

        scene = new THREE.Scene();
        try {
          if ("environmentIntensity" in scene) {
            (scene as any).environmentIntensity = ENVIRONMENT_INTENSITY;
          }
        } catch {}

        camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 100);
        camera.position.set(0, 0, 1);

        if (!usingWebGPU) {
          try {
            pmrem = new THREE.PMREMGenerator(renderer);
            pmrem.compileEquirectangularShader();
          } catch (err) {
            console.warn("[Hero3D] PMREM unavailable", err);
            pmrem = null;
          }
        }

        const candidatesHDR = [
          process.env.NEXT_PUBLIC_ENV_MAP_URL || "",
          "/envs/hero_env_4k.hdr",
          "/envs/hero_env_1k.hdr",
        ].filter(Boolean);

        const candidatesLDR = [
          "/envs/hero_env_4k.jpg",
          "/envs/hero_env_1k.jpg",
          "/envs/hero_env_4k.png",
          "/envs/hero_env_1k.png",
        ];

        let loaded = false;

        // Import HDR loader once
        let RGBELoaderMod: any = null;
        if (!usingWebGPU) {
          try {
            RGBELoaderMod = await import("three/examples/jsm/loaders/RGBELoader.js");
          } catch {}
        }

        if (!usingWebGPU && RGBELoaderMod?.RGBELoader) {
          for (const rel of candidatesHDR) {
            if (!mounted || loaded) break;
            try {
              const loader = new RGBELoaderMod.RGBELoader().setDataType(THREE.HalfFloatType);
              const tex = await loader.loadAsync(abs(rel));
              tex.mapping = THREE.EquirectangularReflectionMapping;
              if (!mounted) {
                tex.dispose();
                continue;
              }
              setEnv(tex);
              loaded = true;
            } catch {}
          }
        }

        if (!loaded) {
          const { TextureLoader } = THREE;
          for (const rel of candidatesLDR) {
            if (!mounted || loaded) break;
            try {
              const tex = await new TextureLoader().loadAsync(abs(rel));
              tex.mapping = THREE.EquirectangularReflectionMapping;
              tex.colorSpace = THREE.SRGBColorSpace;
              if (!mounted) {
                tex.dispose();
                continue;
              }
              setEnv(tex);
              loaded = true;
            } catch {}
          }
        }

        function setEnv(tex: any) {
          if (!scene || !mounted) {
            tex?.dispose?.();
            return;
          }

          if (pmrem && !usingWebGPU) {
            try {
              const rt = pmrem.fromEquirectangular(tex);
              tex.dispose?.();
              safeDispose(currentEnv);
              currentEnv = rt.texture;
            } catch {
              safeDispose(currentEnv);
              currentEnv = tex;
            }
          } else {
            safeDispose(currentEnv);
            currentEnv = tex;
          }

          scene.environment = currentEnv;
          scene.background = SHOW_BACKGROUND ? currentEnv : null;
        }

        if (ENABLE_MOUSE_PARALLAX) {
          mouseMoveHandler = (e: MouseEvent) => {
            const iw = Math.max(1, window.innerWidth);
            const ih = Math.max(1, window.innerHeight);
            targetX = clamp((e.clientX / iw) * 2 - 1, -1, 1);
            targetY = clamp(-((e.clientY / ih) * 2 - 1), -1, 1);
          };
          window.addEventListener("mousemove", mouseMoveHandler, { passive: true });

          touchMoveHandler = (e: TouchEvent) => {
            const t = e.touches?.[0];
            if (!t) return;
            const iw = Math.max(1, window.innerWidth);
            const ih = Math.max(1, window.innerHeight);
            targetX = clamp((t.clientX / iw) * 2 - 1, -1, 1);
            targetY = clamp(-((t.clientY / ih) * 2 - 1), -1, 1);
          };
          window.addEventListener("touchmove", touchMoveHandler, { passive: true });
        }

        const onResize = () => {
          if (!mounted || !renderer || !camera) return;
          const rootNow = hostRef.current;
          if (!rootNow) return;

          const { w: nw, h: nh } = getSafeSize(rootNow);
          if (nw < 2 || nh < 2) return;

          if (canvas) {
            canvas.width = Math.max(2, nw);
            canvas.height = Math.max(2, nh);
          }

          try {
            const nextDpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
            renderer.setPixelRatio(nextDpr);
            renderer.setSize(nw, nh, false);
            camera.aspect = nw / nh;
            camera.updateProjectionMatrix();
          } catch {}
        };

        ro = new ResizeObserver(onResize);
        ro.observe(root);

        document.addEventListener("visibilitychange", onVisibility, { passive: true });

        if (!pausedByVisibility) {
          if (raf === null) raf = requestAnimationFrame(loop);
        }
      } finally {
        restarting = false;
      }
    };

    init().catch(() => {});

    return () => {
      mounted = false;
      document.removeEventListener("visibilitychange", onVisibility);
      // SAFER default: do NOT loseContext on unmount (iOS/WebView can get weird)
      cleanup({ loseContext: false });
    };
  }, []);

  // Soft dark fallback in case WebGL/env totally fails
  return (
    <div
      ref={hostRef}
      className="absolute inset-0 -z-20"
      style={{
        background: "radial-gradient(circle at center, #0a0a1a 0%, #000000 100%)",
      }}
    />
  );
}