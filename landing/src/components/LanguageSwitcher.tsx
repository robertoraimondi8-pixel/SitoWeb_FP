import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/cn";

const LANGS = [
  { code: "it", label: "Italiano", flag: "🇮🇹" },
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "es", label: "Español", flag: "🇪🇸" },
];

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = LANGS.find((l) => l.code === i18n.language.slice(0, 2)) ?? LANGS[0];

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return (
    <div ref={ref} className="relative" data-testid="language-switcher">
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-2 text-sm font-semibold text-ink2 hover:bg-bg-soft hover:border-brand-blue/30 transition-colors",
          compact && "px-2.5 py-1.5 text-xs",
        )}
        data-testid="language-switcher-toggle"
        aria-label="Change language"
      >
        <Globe size={compact ? 14 : 16} className="text-brand-blue" />
        <span className="hidden sm:inline">{current.flag}</span>
        <span className="uppercase tracking-wider">{current.code}</span>
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-2 min-w-[170px] rounded-2xl border border-line bg-white p-2 shadow-card z-50"
          data-testid="language-switcher-menu"
        >
          {LANGS.map((l) => (
            <button
              key={l.code}
              onClick={() => {
                i18n.changeLanguage(l.code);
                document.documentElement.lang = l.code;
                setOpen(false);
              }}
              data-testid={`lang-option-${l.code}`}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors text-left",
                current.code === l.code
                  ? "bg-brand-blue-50 text-brand-blue"
                  : "text-ink2 hover:bg-bg-soft",
              )}
            >
              <span className="text-base">{l.flag}</span>
              <span className="font-medium">{l.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
