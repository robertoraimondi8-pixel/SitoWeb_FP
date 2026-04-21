import { useTranslation } from "react-i18next";

export function Marquee() {
  const { t } = useTranslation();
  const items = (t("marquee.items", { returnObjects: true }) as string[]) ?? [];
  const loop = [...items, ...items];

  return (
    <section
      className="relative border-y border-white/5 bg-bg-surface/40 py-6 overflow-hidden"
      data-testid="marquee-section"
    >
      <div className="pointer-events-none absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-bg-base to-transparent z-10" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-bg-base to-transparent z-10" />
      <div className="flex gap-12 animate-marquee whitespace-nowrap">
        {loop.map((item, i) => (
          <span
            key={i}
            className="font-display text-2xl md:text-3xl font-semibold text-ink/40 tracking-tight flex items-center gap-12"
          >
            {item}
            <span className="text-brand text-lg">●</span>
          </span>
        ))}
      </div>
    </section>
  );
}
