"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Mood = "idle" | "pet" | "happy" | "cheer" | "typing" | "melon" | "bonk" | "fire" | "sleep";

const GIF_MAP: Record<Mood, string> = {
  idle: "/mascot/idle.gif",
  pet: "/mascot/pet.gif",
  happy: "/mascot/happy.gif",
  cheer: "/mascot/cheer.gif",
  typing: "/mascot/typing.gif",
  melon: "/mascot/melon.gif",
  bonk: "/mascot/bonk.gif",
  fire: "/mascot/fire.gif",
  sleep: "/mascot/sleep.gif",
};

/**
 * 语音槽位（以后把剪好的 mp3 丢进 public/mascot/voice/ 即可自动发声）
 */
const VOICE_MAP: Partial<Record<Mood, string[]>> = {
  pet: ["/mascot/voice/pet.mp3"],
  happy: ["/mascot/voice/happy.mp3"],
  cheer: ["/mascot/voice/cheer.mp3"],
  bonk: ["/mascot/voice/bonk.mp3"],
  fire: ["/mascot/voice/fire.mp3"],
  sleep: ["/mascot/voice/sleep.mp3"],
};

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function clampPos(x: number, y: number, w: number, h: number) {
  const maxX = Math.max(8, window.innerWidth - w - 8);
  const maxY = Math.max(8, window.innerHeight - h - 8);
  return {
    x: Math.min(maxX, Math.max(8, x)),
    y: Math.min(maxY, Math.max(8, y)),
  };
}

export default function Live2DMascot() {
  const [visible, setVisible] = useState(false);
  const [muted, setMuted] = useState(false);
  const [mood, setMood] = useState<Mood>("cheer");
  const [popKey, setPopKey] = useState(0);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const clickTimesRef = useRef<number[]>([]);
  const resetTimerRef = useRef<number>(0);
  const sleepTimerRef = useRef<number>(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mascotBoxRef = useRef<HTMLDivElement | null>(null);
  const mascotTrackRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef({
    active: false,
    moved: false,
    startX: 0,
    startY: 0,
    origX: 0,
    origY: 0,
    w: 160,
    h: 160,
  });

  // 初始化显示状态、记忆位置 & 静默预加载全部 9 张 GIF
  useEffect(() => {
    try {
      const saved = localStorage.getItem("milky-mascot");
      if (saved === "off") setVisible(false);
      else if (saved === "on") setVisible(true);
      else setVisible(window.innerWidth >= 768);
      setMuted(localStorage.getItem("milky-mascot-muted") === "1");

      const rawPos = localStorage.getItem("milky-mascot-pos");
      if (rawPos) {
        const parsed = JSON.parse(rawPos) as { x?: number; y?: number };
        if (typeof parsed.x === "number" && typeof parsed.y === "number") {
          setPos(clampPos(parsed.x, parsed.y, 160, 160));
        }
      }
    } catch {
      setVisible(false);
    }

    const preload = () => {
      Object.values(GIF_MAP).forEach((src) => {
        const img = new Image();
        img.src = src;
      });
    };
    const win = window as Window & { requestIdleCallback?: (cb: () => void) => number };
    if (typeof win.requestIdleCallback === "function") {
      win.requestIdleCallback(preload);
    } else {
      window.setTimeout(preload, 1200);
    }
  }, []);

  // 窗口缩放时防止橘猫跑到屏幕外
  useEffect(() => {
    const onResize = () => {
      setPos((cur) => {
        if (!cur) return cur;
        const rect = mascotBoxRef.current?.getBoundingClientRect();
        return clampPos(cur.x, cur.y, rect?.width || 160, rect?.height || 160);
      });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const playVoice = useCallback(
    (targetMood: Mood) => {
      if (muted) return;
      const fallback = "/mascot/voice/pet.mp3";
      const clips = VOICE_MAP[targetMood];
      const primary = clips && clips.length > 0 ? pick(clips) : fallback;

      const tryPlay = (src: string, canFallback: boolean) => {
        try {
          if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
          }
          const audio = new Audio(src);
          audio.volume = 0.8;
          audioRef.current = audio;
          if (canFallback && src !== fallback) {
            audio.onerror = () => tryPlay(fallback, false);
          }
          audio.play().catch(() => {
            if (canFallback && src !== fallback) tryPlay(fallback, false);
          });
        } catch {}
      };

      tryPlay(primary, true);
    },
    [muted]
  );

  const triggerMood = useCallback(
    (nextMood: Mood, opts?: { durationMs?: number; withVoice?: boolean }) => {
      setMood(nextMood);
      setPopKey((k) => k + 1);
      if (opts?.withVoice) {
        playVoice(nextMood);
      }
      window.clearTimeout(resetTimerRef.current);
      if (nextMood !== "idle" && nextMood !== "sleep") {
        resetTimerRef.current = window.setTimeout(() => {
          setMood("idle");
        }, opts?.durationMs ?? 4200);
      }
    },
    [playVoice]
  );

  // 45 秒无交互进入睡觉状态 + 每 18 秒随机待机小动作
  useEffect(() => {
    if (!visible) return;
    const armSleep = () => {
      window.clearTimeout(sleepTimerRef.current);
      sleepTimerRef.current = window.setTimeout(() => {
        triggerMood("sleep");
      }, 45000);
    };
    armSleep();

    const idleLoop = window.setInterval(() => {
      setMood((cur) => {
        if (cur !== "idle") return cur;
        const randMood = pick<Mood>(["happy", "cheer", "typing", "melon", "idle"]);
        if (randMood !== "idle") {
          window.setTimeout(() => triggerMood(randMood, { durationMs: 4500 }), 0);
        }
        return cur;
      });
    }, 18000);

    const onActivity = () => armSleep();
    window.addEventListener("pointerdown", onActivity, { passive: true });
    window.addEventListener("keydown", onActivity, { passive: true });
    return () => {
      window.clearTimeout(sleepTimerRef.current);
      window.clearInterval(idleLoop);
      window.removeEventListener("pointerdown", onActivity);
      window.removeEventListener("keydown", onActivity);
    };
  }, [visible, triggerMood]);

  // 鼠标跟随：朝指针微微歪头探身（拖动或睡觉时暂停）
  useEffect(() => {
    if (!visible) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    const reset = () => {
      if (mascotTrackRef.current) {
        mascotTrackRef.current.style.transform = "translate3d(0px, 0px, 0px) rotate(0deg)";
      }
    };

    if (mood === "sleep" || dragging) {
      reset();
      return;
    }

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || raf || dragStateRef.current.active) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const el = mascotTrackRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const nx = Math.max(-1, Math.min(1, (e.clientX - cx) / 360));
        const ny = Math.max(-1, Math.min(1, (e.clientY - cy) / 360));
        const tx = (nx * 8).toFixed(1);
        const ty = (ny * 6).toFixed(1);
        const tilt = (nx * 9).toFixed(1);
        el.style.transform = `translate3d(${tx}px, ${ty}px, 0px) rotate(${tilt}deg)`;
      });
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("mouseleave", reset);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("mouseleave", reset);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [visible, mood, dragging]);

  const handleTap = () => {
    const now = Date.now();
    clickTimesRef.current = [...clickTimesRef.current.filter((t) => now - t < 2500), now];

    // 2.5 秒内连戳 5 下触发小锤锤 / 着火彩蛋
    if (clickTimesRef.current.length >= 5) {
      clickTimesRef.current = [];
      const chaos = Math.random() < 0.5 ? "bonk" : "fire";
      triggerMood(chaos, { durationMs: 4500, withVoice: true });
      return;
    }

    if (mood === "sleep") {
      triggerMood("happy", { durationMs: 3600, withVoice: true });
      return;
    }

    const next = pick<Mood>(["pet", "happy", "cheer", "melon", "typing"]);
    triggerMood(next, { durationMs: 3600, withVoice: true });
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    const rect = mascotBoxRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragStateRef.current = {
      active: true,
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
      origX: rect.left,
      origY: rect.top,
      w: rect.width,
      h: rect.height,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const st = dragStateRef.current;
    if (!st.active) return;
    const dx = e.clientX - st.startX;
    const dy = e.clientY - st.startY;
    if (!st.moved && Math.hypot(dx, dy) > 6) {
      st.moved = true;
      setDragging(true);
    }
    if (st.moved) {
      setPos(clampPos(st.origX + dx, st.origY + dy, st.w, st.h));
    }
  };

  const finishDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const st = dragStateRef.current;
    if (!st.active) return;
    st.active = false;
    setDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    if (st.moved) {
      const dx = e.clientX - st.startX;
      const dy = e.clientY - st.startY;
      const finalPos = clampPos(st.origX + dx, st.origY + dy, st.w, st.h);
      setPos(finalPos);
      try {
        localStorage.setItem("milky-mascot-pos", JSON.stringify(finalPos));
      } catch {}
    } else {
      handleTap();
    }
  };

  const toggleVisible = () => {
    const next = !visible;
    setVisible(next);
    try {
      localStorage.setItem("milky-mascot", next ? "on" : "off");
    } catch {}
    if (next) triggerMood("cheer", { durationMs: 3600 });
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    if (next && audioRef.current) {
      audioRef.current.pause();
    }
    try {
      localStorage.setItem("milky-mascot-muted", next ? "1" : "0");
    } catch {}
  };

  return (
    <>
      {/* 左下角极简纯图标开关（无文字） */}
      <div className="fixed bottom-4 left-4 z-40 flex items-center gap-1.5">
        <button
          type="button"
          onClick={toggleVisible}
          aria-label="Toggle Milky mascot"
          className={`cursor-pointer rounded-full border border-orange-300/60 bg-white/85 px-2.5 py-1.5 text-sm shadow-md backdrop-blur-md transition hover:-translate-y-0.5 active:scale-95 dark:bg-slate-900/85 ${visible ? "opacity-100" : "opacity-55"}`}
        >
          🐱
        </button>
        {visible && (
          <button
            type="button"
            onClick={toggleMute}
            aria-label="Toggle mascot voice"
            className="cursor-pointer rounded-full border border-orange-300/60 bg-white/85 px-2.5 py-1.5 text-sm shadow-md backdrop-blur-md transition hover:-translate-y-0.5 active:scale-95 dark:bg-slate-900/85"
          >
            {muted ? "🔇" : "🔊"}
          </button>
        )}
      </div>

      {/* 可自由拖动的 Milky 像素看板娘 */}
      {visible && (
        <div
          ref={mascotBoxRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={finishDrag}
          onPointerCancel={finishDrag}
          onMouseEnter={() => {
            if (!dragStateRef.current.active && mood === "idle") {
              triggerMood("pet", { durationMs: 2600 });
            }
          }}
          role="button"
          tabIndex={0}
          aria-label="Milky mascot"
          style={pos ? { left: pos.x, top: pos.y } : undefined}
          className={`fixed z-40 touch-none select-none p-1 ${pos ? "" : "right-3 bottom-3 sm:right-5 sm:bottom-5"} ${dragging ? "cursor-grabbing scale-105" : "cursor-grab"}`}
        >
          <div
            ref={mascotTrackRef}
            className="transition-transform duration-150 ease-out will-change-transform"
          >
            <img
              key={popKey}
              src={GIF_MAP[mood]}
              alt="Milky pixel mascot"
              draggable={false}
              className="milky-mascot-pop pointer-events-none h-32 w-32 object-contain drop-shadow-[0_8px_16px_rgba(251,146,60,0.35)] sm:h-40 sm:w-40"
            />
          </div>
        </div>
      )}
    </>
  );
}
