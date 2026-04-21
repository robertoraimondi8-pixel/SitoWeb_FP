import { useTranslation } from "react-i18next";

export function Marquee() {
  const { t } = useTranslation();
  const items = (t("marquee.items", { returnObjects: true }) as string[]) ?? [];
  const loop = [...items, ...items];

  return (
    <section
      className="relative border-y border-line bg-bg-soft py-5 overflow-hidden"
      data-testid="marquee-section"
    >
      <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-bg-soft to-transparent z-10" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-bg-soft to-transparent z-10" />
      <div className="flex gap-10 animate-marquee whitespace-nowrap">
        {loop.map((item, i) => (
          <span
            key={i}
            className="font-display text-xl md:text-2xl font-bold text-ink2/40 tracking-tight flex items-center gap-10"
          >
            {item}
            <span className="text-brand-orange text-base">●</span>
          </span>
        ))}
      </div>
    </section>
  );
}
