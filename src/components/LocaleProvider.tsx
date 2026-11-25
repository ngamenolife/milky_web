"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { getText, type Dict } from "@/lib/i18n";
import type { Locale } from "@/lib/types";

interface LocaleContextValue {
  locale: Locale;
  t: Dict;
  toggleLocale: () => void;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: "zh",
  t: getText("zh"),
  toggleLocale: () => {},
});

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>("zh");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("milky_locale");
      if (saved === "zh" || saved === "ja") setLocale(saved);
    } catch {}
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale === "ja" ? "ja" : "zh-CN";
  }, [locale]);

  const toggleLocale = () => {
    setLocale((prev) => {
      const next: Locale = prev === "zh" ? "ja" : "zh";
      try {
        localStorage.setItem("milky_locale", next);
      } catch {}
      return next;
    });
  };

  return (
    <LocaleContext.Provider value={{ locale, t: getText(locale), toggleLocale }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  return useContext(LocaleContext);
}
