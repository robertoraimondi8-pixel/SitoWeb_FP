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
        { label: t("footer.privacy"), href: "/privacy" },
        { label: t("footer.terms"), href: "/privacy" },
        { label: t("footer.cookies"), href: "/privacy" },
      ],
    },
  ];

  return (
    <footer
      className="relative pt-16 pb-10 text-white overflow-hidden"
      style={{ background: "linear-gradient(180deg, #0A2570 0%, #050F35 100%)" }}
      data-testid="footer-section"
    >
      {/* Italian tricolore strip at top */}
      <div className="absolute top-0 inset-x-0 h-1 tricolore opacity-60" />

      <div className="container-x relative">
        <div className="grid grid-cols-2 md:grid-cols-12 gap-10 md:gap-8">
          <div className="col-span-2 md:col-span-5">
            <a href="#top" className="inline-flex items-center gap-2.5 mb-4">
              <img src="/brand-icon.png" alt="FantaPronostic" className="h-10 w-10 rounded-xl" />
              <span className="font-display font-bold text-xl tracking-tight">
                <span className="text-brand-orange">Fanta</span>
                <span className="text-white">Pronostic</span>
              </span>
            </a>
            <p className="text-sm text-white/70 leading-relaxed max-w-sm">
              {t("footer.tagline")}
            </p>

            <div className="mt-8">
              <p className="text-xs uppercase tracking-widest text-white/50 font-bold mb-4">
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
                    className="h-10 w-10 rounded-full border border-white/15 bg-white/5 grid place-items-center text-white/70 hover:text-white hover:border-brand-orange hover:bg-brand-orange/20 transition-colors"
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
              <p className="font-display text-sm font-bold text-white uppercase tracking-wider mb-4">
                {col.title}
              </p>
              <ul className="space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <a
                      href={l.href}
                      className="text-sm text-white/70 hover:text-brand-orange transition-colors"
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

        <div className="mt-14 pt-8 border-t border-white/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <p className="text-xs text-white/60">
            © {year} FantaPronostic. {t("footer.rights")}
          </p>
          <p className="text-xs text-white/50">fantapronostic.com · 🇮🇹 Made in Italy</p>
        </div>
      </div>
    </footer>
  );
}
