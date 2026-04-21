import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Menu, X, ArrowRight } from "lucide-react";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { cn } from "@/lib/cn";

export function Header() {
  const { t } = useTranslation();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = [
    { href: "#how", label: t("nav.how") },
    { href: "#modes", label: t("nav.modes") },
    { href: "#leagues", label: t("nav.leagues") },
    { href: "#rules", label: t("nav.rules") },
    { href: "#faq", label: t("nav.faq") },
  ];

  return (
    <header
      className={cn(
        "fixed top-0 inset-x-0 z-50 transition-all duration-300",
        scrolled ? "py-2" : "py-4",
      )}
      data-testid="site-header"
    >
      <div className="container-x">
        <div
          className={cn(
            "flex items-center justify-between rounded-full px-4 sm:px-5 py-2.5 transition-all duration-300",
            scrolled
              ? "glass shadow-card"
              : "bg-transparent border border-transparent",
          )}
        >
          <a
            href="#top"
            className="flex items-center gap-2.5"
            data-testid="header-logo-link"
          >
            <img src="/logo-icon.png" alt="FantaPronostic" className="h-8 w-8 rounded-lg" />
            <span className="font-display font-bold text-lg tracking-tight">
              Fanta<span className="text-brand">Pronostic</span>
            </span>
          </a>

          <nav className="hidden lg:flex items-center gap-8">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-sm font-medium text-muted hover:text-ink transition-colors"
                data-testid={`nav-link-${l.href.slice(1)}`}
              >
                {l.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <LanguageSwitcher compact />
            <a
              href="#download"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-bg-base hover:bg-brand-hover transition-colors"
              data-testid="header-download-cta"
            >
              {t("nav.download")}
              <ArrowRight size={14} />
            </a>
            <button
              onClick={() => setOpen((o) => !o)}
              className="lg:hidden grid place-items-center h-9 w-9 rounded-full border border-white/10 text-ink hover:bg-white/5"
              aria-label="Menu"
              data-testid="mobile-menu-toggle"
            >
              {open ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {open && (
          <div
            className="lg:hidden mt-2 glass rounded-3xl p-4 flex flex-col gap-1"
            data-testid="mobile-menu"
          >
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-xl px-4 py-3 text-sm font-medium text-ink hover:bg-white/5"
                data-testid={`mobile-nav-${l.href.slice(1)}`}
              >
                {l.label}
              </a>
            ))}
            <a
              href="#download"
              onClick={() => setOpen(false)}
              className="mt-2 btn-primary justify-center"
              data-testid="mobile-download-cta"
            >
              {t("nav.download")}
            </a>
          </div>
        )}
      </div>
    </header>
  );
}
