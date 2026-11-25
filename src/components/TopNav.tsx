"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Globe } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";

export default function TopNav() {
  const pathname = usePathname();
  const { locale, t, toggleLocale } = useLocale();

  const links = [
    { href: "/", label: t.navHome },
    { href: "/schedule", label: t.navSchedule },
    { href: "/feed", label: locale === "ja" ? "タイムライン" : "动态墙" },
    { href: "/about", label: t.navAbout },
  ];

  return (
    <header className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-orange-100">
      <Link href="/" className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-milky-500 text-xl text-white">
          🐱
        </span>
        <div>
          <p className="text-lg font-bold text-stone-900">{t.brand}</p>
          <p className="text-xs text-stone-500">{t.subtitle}</p>
        </div>
      </Link>

      <div className="flex flex-wrap items-center gap-2">
        <nav className="flex items-center gap-1 rounded-xl bg-stone-100 p-1 text-xs font-semibold">
          {links.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={
                  "rounded-lg px-3 py-1.5 transition " +
                  (active
                    ? "bg-white text-milky-600 shadow-sm"
                    : "text-stone-600 hover:text-stone-900")
                }
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <button
          type="button"
          data-testid="lang-toggle"
          onClick={toggleLocale}
          className="inline-flex items-center gap-1.5 rounded-xl border border-orange-200 bg-milky-50 px-3 py-1.5 text-xs font-semibold text-milky-600 hover:bg-milky-100"
        >
          <Globe className="h-3.5 w-3.5" />
          {t.langBtn}
        </button>
      </div>
    </header>
  );
}
