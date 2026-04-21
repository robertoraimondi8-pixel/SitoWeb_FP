import { useTranslation } from "react-i18next";
import { Instagram, Twitter, Youtube } from "lucide-react";

export function Footer() {
  const { t } = useTranslation();
  const year = new Date().getFullYear();

  const cols = [
    {
      title: t("footer.product"),
      links: [
        { label: t("nav.how"), href: "#how" },
        { label: t("nav.modes"), href: "#modes" },
        { label: t("nav.leagues"), href: "#leagues" },
        { label: t("nav.rules"), href: "#rules" },
      ],
    },
    {
      title: t("footer.company"),
      links: [
        { label: t("footer.about"), href: "#" },
        { label: t("footer.press"), href: "#" },
        { label: t("footer.careers"), href: "#" },
        { label: t("nav.faq"), href: "#faq" },
      ],
    },
    {
      title: t("footer.legal"),
      links: [
        { label: t("footer.privacy"), href: "#" },
        { label: t("footer.terms"), href: "#" },
        { label: t("footer.cookies"), href: "#" },
      ],
    },
  ];

  return (
    <footer
      className="relative border-t border-white/5 pt-16 pb-10 bg-bg-base"
      data-testid="footer-section"
    >
      <div className="container-x">
        <div className="grid grid-cols-2 md:grid-cols-12 gap-10 md:gap-8">
          <div className="col-span-2 md:col-span-5">
            <a href="#top" className="inline-flex items-center gap-2.5 mb-4">
              <img src="/logo-icon.png" alt="FantaPronostic" className="h-9 w-9 rounded-lg" />
              <span className="font-display font-bold text-xl tracking-tight">
                Fanta<span className="text-brand">Pronostic</span>
              </span>
            </a>
            <p className="text-sm text-muted leading-relaxed max-w-sm">{t("footer.tagline")}</p>

            <div className="mt-8">
              <p className="text-xs uppercase tracking-widest text-muted mb-4">
                {t("footer.follow")}
              </p>
              <div className="flex items-center gap-2">
                {[
                  { Icon: Instagram, href: "#", id: "instagram" },
                  { Icon: Twitter, href: "#", id: "twitter" },
                  { Icon: Youtube, href: "#", id: "youtube" },
                ].map(({ Icon, href, id }) => (
                  <a
                    key={id}
                    href={href}
                    className="h-10 w-10 rounded-full border border-white/10 bg-white/[0.02] grid place-items-center text-muted hover:text-ink hover:border-brand/40 hover:bg-brand/10 transition-colors"
                    data-testid={`social-${id}`}
                    aria-label={id}
                  >
                    <Icon size={16} />
                  </a>
                ))}
              </div>
            </div>
          </div>

          {cols.map((col) => (
            <div key={col.title} className="col-span-1 md:col-span-2">
              <p className="font-display text-sm font-semibold text-ink uppercase tracking-wider mb-4">
                {col.title}
              </p>
              <ul className="space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <a
                      href={l.href}
                      className="text-sm text-muted hover:text-ink transition-colors"
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div className="col-span-2 md:col-span-1" />
        </div>

        <div className="mt-14 pt-8 border-t border-white/5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <p className="text-xs text-muted">
            © {year} FantaPronostic. {t("footer.rights")}
          </p>
          <p className="text-xs text-muted/70">fantapronostic.com</p>
        </div>
      </div>
    </footer>
  );
}
