import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
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
        scrolled ? "py-2" : "py-3",
      )}
      data-testid="site-header"
    >
      <div className="container-x">
        <div
          className={cn(
            "flex items-center justify-between rounded-full px-4 sm:px-5 py-2.5 transition-all duration-300",
            scrolled
              ? "bg-white/95 backdrop-blur-xl border border-line shadow-soft"
              : "bg-white/70 backdrop-blur-md border border-white/60",
          )}
        >
          <a
            href="#top"
            className="flex items-center gap-2"
            data-testid="header-logo-link"
          >
            <img
              src="/brand-icon.png"
              alt="FantaPronostic"
              className="h-9 w-9 rounded-xl"
            />
            <span className="font-display font-bold text-[17px] tracking-tight leading-none hidden sm:inline">
              <span className="text-brand-orange">Fanta</span>
              <span className="text-brand-blue">Pronostic</span>
            </span>
          </a>

          <nav className="hidden lg:flex items-center gap-7">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-sm font-semibold text-ink2 hover:text-brand-blue transition-colors"
                data-testid={`nav-link-${l.href.slice(1)}`}
              >
                {l.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <LanguageSwitcher compact />
            <Link
              to="/register"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-ink2 hover:text-brand-blue hover:border-brand-blue transition-colors"
              data-testid="header-register-cta"
            >
              Registrati
            </Link>
            <a
              href="#download"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-brand-orange px-4 py-2 text-sm font-semibold text-white hover:bg-brand-orange-600 transition-colors shadow-cta"
              data-testid="header-download-cta"
            >
              {t("nav.download")}
              <ArrowRight size={14} />
            </a>
            <button
              onClick={() => setOpen((o) => !o)}
              className="lg:hidden grid place-items-center h-9 w-9 rounded-full border border-line bg-white text-ink hover:bg-bg-soft"
              aria-label="Menu"
              data-testid="mobile-menu-toggle"
            >
              {open ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {open && (
          <div
            className="lg:hidden mt-2 bg-white border border-line rounded-3xl p-3 shadow-card flex flex-col gap-1"
            data-testid="mobile-menu"
          >
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-xl px-4 py-3 text-sm font-semibold text-ink2 hover:bg-bg-soft hover:text-brand-blue"
                data-testid={`mobile-nav-${l.href.slice(1)}`}
              >
                {l.label}
              </a>
            ))}
            <Link
              to="/register"
              onClick={() => setOpen(false)}
              className="rounded-xl px-4 py-3 text-sm font-semibold text-ink2 hover:bg-bg-soft hover:text-brand-blue"
              data-testid="mobile-nav-register"
            >
              Registrati
            </Link>
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
