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

    // ✅ SHOW_BACKGROUND = true will show the HDR/JPG as actual background.
    // Keeping false lets your CSS aurora/vignette dominate (recommended).
    const SHOW_BACKGROUND = false;

    const cancelRAF = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = null;
    };

    const safeDispose = (x: any) => {
      try {
        x?.dispose?.();
      } catch {}
    };

    const renderOnce = () => {
      if (!renderer || !scene || !camera) return;
      cancelRAF();
      raf = requestAnimationFrame(() => {
        if (!renderer || !scene || !camera) return;
        try {
          renderer.render(scene, camera);
        } catch {
          // If WebGL context lost or something odd, just stop rendering.
        }
      });
    };

    const abs = (p: string) =>
      p.startsWith("http")
        ? p
        : `${window.location.origin}${p.startsWith("/") ? "" : "/"}${p}`;

    const getSafeSize = (root: HTMLElement) => {
      // Prefer bounding rect; fallback to client sizes
      const r = root.getBoundingClientRect();
      const w = Math.floor(r.width || root.clientWidth || 0);
      const h = Math.floor(r.height || root.clientHeight || 0);
      return { w, h };
    };

    const cleanup = () => {
      cancelRAF();

      try {
        ro?.disconnect();
      } catch {}
      ro = null;

      try {
        if (scene) {
          scene.environment = null;
          scene.background = null;
        }
      } catch {}

      safeDispose(currentEnv);
      currentEnv = null;

      safeDispose(pmrem);
      pmrem = null;

      try {
        // extra safety: force context loss on mobile to avoid GPU leaks
        const gl = renderer?.getContext?.();
        const lose = gl?.getExtension?.("WEBGL_lose_context");
        lose?.loseContext?.();
      } catch {}

      safeDispose(renderer);
      renderer = null;

      try {
        const root = hostRef.current;
        if (canvas && root && root.contains(canvas)) root.removeChild(canvas);
      } catch {}
      canvas = null;

      scene = null;
      camera = null;
    };

    const onVisibility = () => {
      const hidden = document.visibilityState === "hidden";
      pausedByVisibility = hidden;
      if (!hidden) renderOnce();
    };

    (async () => {
      const root = hostRef.current;
      if (!root) return;

      // If layout isn't ready yet, wait a frame so size isn't 0x0 (common in iOS)
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      if (!mounted) return;

      const { w, h } = getSafeSize(root);
      if (!w || !h) {
        // Layout still not ready; bail gracefully (CSS layers will show)
        return;
      }

      // Create canvas first with explicit size to avoid "null width" crashes
      canvas = document.createElement("canvas");
      canvas.width = Math.max(2, w);
      canvas.height = Math.max(2, h);

      // Quick WebGL support test (do NOT reuse this context for renderer)
      const testGL =
        canvas.getContext("webgl2", { alpha: true, antialias: true }) ||
        canvas.getContext("webgl", { alpha: true, antialias: true });

      if (!testGL) {
        // No WebGL — gradients behind carry the look.
        return;
      }

      // Release the test context reference (renderer will make its own)
      // @ts-ignore
      testGL.getExtension?.("WEBGL_lose_context")?.loseContext?.();

      const THREE = await import("three");
      const {
        PMREMGenerator,
        EquirectangularReflectionMapping,
        SRGBColorSpace,
        FloatType,
        Texture,
      } = THREE;

      // Canvas styling so it blends into your existing layers
      canvas.style.position = "absolute";
      canvas.style.inset = "0";
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      canvas.style.zIndex = "-1";
      canvas.style.pointerEvents = "none";
      canvas.style.opacity = "0.55";
      canvas.style.filter = "saturate(1.12) contrast(1.05) blur(0.2px)";
      canvas.style.mixBlendMode = "screen";

      root.appendChild(canvas);

      // ✅ IMPORTANT: Let THREE create the context.
      // Passing a manually-created context can trigger iOS oddities.
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });

      // Pixel ratio cap helps iOS + battery
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      renderer.setPixelRatio(dpr);
      renderer.setSize(w, h, false);

      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.92;
      (renderer as any).outputColorSpace = SRGBColorSpace;

      scene = new THREE.Scene();

      camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 100);
      camera.position.set(0, 0, 1);

      pmrem = new PMREMGenerator(renderer);
      pmrem.compileEquirectangularShader();

      // ---------- Robust loaders (manual parse) ----------
      const loadHDRViaParse = async (url: string) => {
        const { RGBELoader } = await import(
          "three/examples/jsm/loaders/RGBELoader.js"
        );
        const res = await fetch(url, { mode: "cors", cache: "force-cache" });
        if (!res.ok) throw new Error(`HDR fetch failed ${res.status}`);
        const buf = await res.arrayBuffer();

        const loader = new RGBELoader();
        loader.setDataType(FloatType);

        const tex: any = await new Promise((resolve, reject) => {
          try {
            const t = loader.parse(buf);
            resolve(t);
          } catch (e) {
            reject(e);
          }
        });

        const ok =
          tex &&
          tex.isDataTexture &&
          tex.image &&
          tex.image.data &&
          tex.image.width &&
          tex.image.height;

        if (!ok) {
          tex?.dispose?.();
          throw new Error("HDR parsed but invalid image payload");
        }
        return tex;
      };

      const loadLDRViaBitmap = async (url: string) => {
        const res = await fetch(url, { mode: "cors", cache: "force-cache" });
        if (!res.ok) throw new Error(`LDR fetch failed ${res.status}`);
        const blob = await res.blob();

        // createImageBitmap can fail on some iOS builds for certain formats
        const bitmap = await createImageBitmap(blob).catch(() => null);
        if (!bitmap || !bitmap.width || !bitmap.height) {
          throw new Error("Bitmap decode failed");
        }

        const tex = new Texture(bitmap);
        tex.needsUpdate = true;
        tex.mapping = EquirectangularReflectionMapping;
        tex.colorSpace = SRGBColorSpace;
        return tex as any;
      };

      const setEnv = (tex: any) => {
        if (!pmrem || !scene) {
          tex?.dispose?.();
          return;
        }

        let rt: any = null;
        try {
          rt = pmrem.fromEquirectangular(tex);
        } catch {
          tex?.dispose?.();
          return;
        }

        tex.dispose?.();
        safeDispose(currentEnv);
        currentEnv = rt.texture;

        // Lighting always
        scene.environment = currentEnv;

        // Background optional
        scene.background = SHOW_BACKGROUND ? currentEnv : null;

        if (!pausedByVisibility) renderOnce();
      };

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

      // Try HDR first
      for (const rel of candidatesHDR) {
        if (!mounted) break;
        try {
          const tex = await loadHDRViaParse(abs(rel));
          if (!mounted) {
            tex.dispose?.();
            break;
          }
          setEnv(tex);
          loaded = true;
          break;
        } catch {
          // next
        }
      }

      // Then LDR
      if (!loaded) {
        for (const rel of candidatesLDR) {
          if (!mounted) break;
          try {
            const tex = await loadLDRViaBitmap(abs(rel));
            if (!mounted) {
              tex.dispose?.();
              break;
            }
            setEnv(tex);
            loaded = true;
            break;
          } catch {
            // next
          }
        }
      }

      // Resize handling (also handles iOS orientation changes)
      const onResize = () => {
        if (!mounted || !renderer || !camera) return;

        const rootNow = hostRef.current;
        if (!rootNow) return;

        const { w: w2, h: h2 } = getSafeSize(rootNow);
        if (!w2 || !h2) return;

        // keep canvas internal size aligned before setSize
        if (canvas) {
          canvas.width = Math.max(2, w2);
          canvas.height = Math.max(2, h2);
        }

        try {
          renderer.setSize(w2, h2, false);
          camera.aspect = w2 / h2;
          camera.updateProjectionMatrix();
        } catch {
          return;
        }

        if (!pausedByVisibility) renderOnce();
      };

      ro = new ResizeObserver(onResize);
      ro.observe(root);

      document.addEventListener("visibilitychange", onVisibility, { passive: true });

      if (!pausedByVisibility) renderOnce();
    })();

    return () => {
      mounted = false;
      document.removeEventListener("visibilitychange", onVisibility);
      cleanup();
    };
  }, []);

  return <div ref={hostRef} className="absolute inset-0 -z-20" />;
}