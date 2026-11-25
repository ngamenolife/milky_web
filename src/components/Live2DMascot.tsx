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
 * 🎙️ 语音槽位配置（留好位子啦！）
 * 以后只要把剪好的 mp3 放到 public/mascot/voice/ 对应文件名即可自动发声。
 * 没放文件时会自动静默跳过，不会报错。
 */
const VOICE_MAP: Partial<Record<Mood, string[]>> = {
  pet: ["/mascot/voice/pet.mp3"],
  happy: ["/mascot/voice/happy.mp3"],
  cheer: ["/mascot/voice/cheer.mp3"],
  bonk: ["/mascot/voice/bonk.mp3"],
  fire: ["/mascot/voice/fire.mp3"],
  sleep: ["/mascot/voice/sleep.mp3"],
};

/**
 * 💬 Milky 专属口头禅（随时可以在这里增删改！）
 */
const LINES: Record<Mood, { zh: string[]; ja: string[] }> = {
  idle: {
    zh: [
      "今天想在点歌台听哪一首呀？",
      "宇宙猫耳族 Milky 8 周年快乐！✨",
      "周二 FF14、周日看电影，记得看日历哦~",
    ],
    ja: [
      "今日はどの曲を聴くの？",
      "みるきぃ活動8周年おめでとう！✨",
      "配信スケジュールもチェックしてね～",
    ],
  },
  pet: {
    zh: ["诶嘿~ 摸头很舒服喵！", "再摸橘猫耳朵要炸毛啦~"],
    ja: ["えへへ～なでなで嬉しいにゃ！", "お耳さわるとくすぐったいよ～"],
  },
  happy: {
    zh: ["哇！谢谢大家陪伴 Milky 走过 8 周年！🎉", "星星眼启动！今天也要元气满满！"],
    ja: ["わぁ！8年間ずっと応援ありがとう！🎉", "キラキラ～！今日も元気いっぱい！"],
  },
  cheer: {
    zh: ["举牌打 Call！Milky 最棒！📣", "8 周年纪念配信一起冲呀！"],
    ja: ["全力応援！みるきぃ最高！📣", "8周年記念配信みんなで盛り上がろう！"],
  },
  typing: {
    zh: ["哒哒哒…正在准备下次直播和游戏清单！", "努力营业中的宇宙橘猫~"],
    ja: ["カタカタ…次の配信の準備中だよ！", "お仕事がんばる宇宙猫～"],
  },
  melon: {
    zh: ["嚼嚼嚼…摸鱼吃口西瓜🍉", "吃瓜看戏中，歌单随便点哦~"],
    ja: ["もぐもぐ…スイカおいしい🍉", "ちょっと休憩中～好きな曲リクエストしてね"],
  },
  bonk: {
    zh: ["别再戳啦！吃我一记橘猫小锤锤！🔨", "戳太多下啦，邦邦两拳警告！"],
    ja: ["つつきすぎ！ハンマーいくよ！🔨", "もうっ、怒るぞー！"],
  },
  fire: {
    zh: ["哇啊啊着火啦！！CPU 过载了！🔥", "别点了别点了，橘猫要冒烟了！🔥"],
    ja: ["わぁぁ燃えてる！！助けてー！🔥", "押しすぎでオーバーヒートした！🔥"],
  },
  sleep: {
    zh: ["呼噜呼噜…Zzz（点我叫醒）", "橘猫先盖被子眯一会儿…Zzz"],
    ja: ["すやすや…Zzz（クリックで起きるよ）", "ちょっとおやすみ…Zzz"],
  },
};

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export default function Live2DMascot() {
  const [visible, setVisible] = useState(false);
  const [muted, setMuted] = useState(false);
  const [mood, setMood] = useState<Mood>("cheer");
  const [popKey, setPopKey] = useState(0);
  const [bubble, setBubble] = useState("");
  const [isJa, setIsJa] = useState(false);

  const clickTimesRef = useRef<number[]>([]);
  const resetTimerRef = useRef<number>(0);
  const bubbleTimerRef = useRef<number>(0);
  const sleepTimerRef = useRef<number>(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mascotTrackRef = useRef<HTMLDivElement | null>(null);

  // 同步站内中日语言
  useEffect(() => {
    const syncLang = () => {
      try {
        const s = localStorage.getItem("milky-locale") || localStorage.getItem("locale") || "";
        const l = document.documentElement.lang || "";
        setIsJa(s.startsWith("ja") || l.startsWith("ja"));
      } catch {}
    };
    syncLang();
    const id = window.setInterval(syncLang, 1500);
    return () => window.clearInterval(id);
  }, []);

  // 初始化显示状态 & 静默预加载全部 9 张 GIF
  useEffect(() => {
    try {
      const saved = localStorage.getItem("milky-mascot");
      if (saved === "off") setVisible(false);
      else if (saved === "on") setVisible(true);
      else setVisible(window.innerWidth >= 768);
      setMuted(localStorage.getItem("milky-mascot-muted") === "1");
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

  const playVoice = useCallback(
    (targetMood: Mood) => {
      if (muted) return;
      const clips = VOICE_MAP[targetMood];
      if (!clips || clips.length === 0) return;
      const src = pick(clips);
      try {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        }
        const audio = new Audio(src);
        audio.volume = 0.75;
        audioRef.current = audio;
        audio.play().catch(() => {
          // 音频尚未上传或浏览器拦截自动播放时静默忽略
        });
      } catch {}
    },
    [muted]
  );

  const triggerMood = useCallback(
    (nextMood: Mood, opts?: { durationMs?: number; speak?: boolean; withVoice?: boolean }) => {
      setMood(nextMood);
      setPopKey((k) => k + 1);
      if (opts?.speak !== false) {
        const bank = LINES[nextMood];
        setBubble(pick(isJa ? bank.ja : bank.zh));
        window.clearTimeout(bubbleTimerRef.current);
        bubbleTimerRef.current = window.setTimeout(() => setBubble(""), 4800);
      }
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
    [isJa, playVoice]
  );

  // 45 秒无交互进入睡觉状态 + 每 18 秒随机待机小动作
  useEffect(() => {
    if (!visible) return;
    const armSleep = () => {
      window.clearTimeout(sleepTimerRef.current);
      sleepTimerRef.current = window.setTimeout(() => {
        triggerMood("sleep", { speak: true });
      }, 45000);
    };
    armSleep();

    const idleLoop = window.setInterval(() => {
      setMood((cur) => {
        if (cur !== "idle") return cur;
        const randMood = pick<Mood>(["happy", "cheer", "typing", "melon", "idle"]);
        if (randMood !== "idle") {
          window.setTimeout(() => triggerMood(randMood, { durationMs: 4500, speak: true }), 0);
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

  // 鼠标跟随：让像素橘猫朝指针微微歪头探身（零 React 重绘）
  useEffect(() => {
    if (!visible) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    const reset = () => {
      if (mascotTrackRef.current) {
        mascotTrackRef.current.style.transform = "translate3d(0px, 0px, 0px) rotate(0deg)";
      }
    };

    if (mood === "sleep") {
      reset();
      return;
    }

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || raf) return;
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
  }, [visible, mood]);

  const handleTap = () => {
    const now = Date.now();
    clickTimesRef.current = [...clickTimesRef.current.filter((t) => now - t < 2500), now];

    // 2.5 秒内连戳 5 下触发小锤锤 / 着火彩蛋！
    if (clickTimesRef.current.length >= 5) {
      clickTimesRef.current = [];
      const chaos = Math.random() < 0.5 ? "bonk" : "fire";
      triggerMood(chaos, { durationMs: 4500, speak: true, withVoice: true });
      return;
    }

    if (mood === "sleep") {
      triggerMood("happy", { durationMs: 3600, speak: true, withVoice: true });
      return;
    }

    const next = pick<Mood>(["pet", "happy", "cheer", "melon", "typing"]);
    triggerMood(next, { durationMs: 3600, speak: true, withVoice: true });
  };

  const toggleVisible = () => {
    const next = !visible;
    setVisible(next);
    try {
      localStorage.setItem("milky-mascot", next ? "on" : "off");
    } catch {}
    if (next) triggerMood("cheer", { durationMs: 3600, speak: true });
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
      {/* 左下角悬浮控制胶囊 */}
      <div className="fixed bottom-4 left-4 z-40 flex items-center gap-1.5">
        <button
          type="button"
          onClick={toggleVisible}
          className="cursor-pointer rounded-full border border-orange-300/60 bg-white/85 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-md backdrop-blur-md transition hover:-translate-y-0.5 hover:bg-white active:scale-95 dark:bg-slate-900/85 dark:text-slate-100"
        >
          {visible ? "🐱 隐藏橘猫" : "🐱 召唤橘猫"}
        </button>
        {visible && (
          <button
            type="button"
            onClick={toggleMute}
            title={muted ? "开启看板娘语音" : "静音看板娘语音"}
            className="cursor-pointer rounded-full border border-orange-300/60 bg-white/85 px-2.5 py-1.5 text-xs shadow-md backdrop-blur-md transition hover:-translate-y-0.5 active:scale-95 dark:bg-slate-900/85"
          >
            {muted ? "🔇" : "🔊"}
          </button>
        )}
      </div>

      {/* 右下角 Milky 专属像素看板娘 */}
      {visible && (
        <div className="fixed right-3 bottom-3 z-40 flex flex-col items-end select-none sm:right-5 sm:bottom-5">
          {bubble && (
            <div className="milky-bubble mb-2 max-w-[220px] rounded-2xl rounded-br-sm border border-orange-300/70 bg-white/92 px-3 py-2 text-xs font-medium text-slate-800 shadow-lg backdrop-blur-md dark:border-orange-400/40 dark:bg-slate-900/92 dark:text-slate-100">
              {bubble}
            </div>
          )}
          <button
            type="button"
            onClick={handleTap}
            onMouseEnter={() => {
              if (mood === "idle") triggerMood("pet", { durationMs: 2600, speak: false });
            }}
            aria-label="Interact with Milky mascot"
            className="group relative cursor-pointer rounded-2xl bg-transparent p-1 transition hover:-translate-y-1 active:scale-95"
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
                className="milky-pixel milky-mascot-pop h-24 w-24 object-contain drop-shadow-[0_6px_12px_rgba(251,146,60,0.35)] sm:h-28 sm:w-28"
              />
            </div>
          </button>
        </div>
      )}
    </>
  );
}
