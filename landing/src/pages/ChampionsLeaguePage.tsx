import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Swords } from "lucide-react";
import { openAppStore } from "@/lib/storeLinks";
import { usePlatform, storeUrlFor } from "@/lib/usePlatform";
import { trackStoreClick } from "@/lib/tracking";

// Numeri e testi della lega in un posto solo.
const LEAGUE = {
  name: "F.P Champions League",
  prizePool: "500€",
  bonus: "+10",
  malus: "−10",
  hero: "/og-fp-champions.jpg",        // ritaglio 1200x630: basso, entra nel primo schermo
  heroTall: "/fp-champions-arena.webp", // originale verticale, usato da md in su
  stadium: "/stadium-hero.png",
};

/**
 * Pulsante di download: su mobile porta allo store giusto, su desktop si sdoppia
 * perche' la piattaforma non e' deducibile. `placement` distingue nel
 * tracciamento quale CTA ha convertito.
 */
function DownloadCta({
  placement,
  size = "lg",
  className = "",
}: {
  placement: string;
  size?: "lg" | "md";
  className?: string;
}) {
  const platform = usePlatform();

  const shape =
    size === "lg"
      ? "min-h-[64px] px-8 text-[18px]"
      : "min-h-[54px] px-7 text-[16px]";
  const base =
    `group relative flex items-center justify-center gap-2.5 rounded-full ` +
    `bg-gradient-to-r from-brand-orange to-[#FFA640] font-display font-bold text-white ` +
    `shadow-[0_10px_34px_-8px_rgba(245,130,32,0.85)] transition-all duration-200 ` +
    `hover:-translate-y-0.5 hover:shadow-[0_16px_42px_-8px_rgba(245,130,32,1)] ` +
    `focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ` +
    `focus-visible:outline-brand-yellow ${shape}`;

  if (platform === "other") {
    return (
      <div className={`flex w-full flex-col gap-3 sm:flex-row sm:justify-center ${className}`}>
        <a
          href={storeUrlFor("ios")}
          rel="noopener noreferrer"
          onClick={() => {
            openAppStore();
            trackStoreClick("apple", placement);
          }}
          className={base}
        >
          Scarica su App Store
          <ArrowRight size={19} aria-hidden="true" />
        </a>
        <a
          href={storeUrlFor("android")}
          rel="noopener noreferrer"
          onClick={() => trackStoreClick("google", placement)}
          className={`${base} from-brand-blue to-[#3C6BF0] shadow-[0_10px_34px_-8px_rgba(30,79,216,0.85)] hover:shadow-[0_16px_42px_-8px_rgba(30,79,216,1)]`}
        >
          Scarica su Google Play
          <ArrowRight size={19} aria-hidden="true" />
        </a>
      </div>
    );
  }

  return (
    <a
      href={storeUrlFor(platform)}
      rel="noopener noreferrer"
      onClick={() => {
        if (platform === "ios") openAppStore();
        trackStoreClick(platform === "android" ? "google" : "apple", placement);
      }}
      className={`${base} w-full ${className}`}
    >
      Scarica l'app gratis
      <ArrowRight size={19} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" />
    </a>
  );
}

/** Riga "Disponibile su", con i marchi degli store gia' presenti nel progetto. */
function StoreNote({ tone = "dark" }: { tone?: "dark" | "light" }) {
  const color = tone === "dark" ? "text-white/60" : "text-muted";
  return (
    <p className={`flex items-center justify-center gap-2 text-xs font-medium ${color}`}>
      <img src="/apple-logo.svg" alt="" width={13} height={13} className={tone === "dark" ? "invert opacity-70" : "opacity-60"} />
      <img src="/googleplay-logo.svg" alt="" width={13} height={13} className="opacity-80" />
      Disponibile su App Store e Google Play
    </p>
  );
}

/**
 * Badge dell'hero. `strong` e' riservato a "Gratis": e' l'informazione che
 * decide il click e deve leggersi per prima, quindi ha corpo maggiore e fondo
 * pieno invece del vetro traslucido degli altri.
 */
function Badge({
  children,
  delay = 0,
  strong = false,
}: {
  children: ReactNode;
  delay?: number;
  strong?: boolean;
}) {
  const style = strong
    ? "border-transparent bg-gradient-to-r from-[#FFD24A] to-brand-orange px-4 py-1.5 text-[15px] uppercase tracking-wide text-[#3A1D00] shadow-[0_6px_20px_-6px_rgba(255,176,31,0.9)] sm:px-5 sm:py-2 sm:text-[17px]"
    : "border-white/20 bg-white/[0.08] px-2.5 py-1 text-[11px] text-white backdrop-blur-md sm:px-3.5 sm:py-1.5 sm:text-[12px]";

  return (
    <motion.span
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay }}
      className={`inline-flex items-center gap-1 rounded-full border font-display font-bold ${style}`}
    >
      {children}
    </motion.span>
  );
}

const reveal = {
  initial: { opacity: 0, y: 22 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.5 },
};

/**
 * Campo di stelle dell'hero. Sono stelle sparse originali — un motivo grafico
 * generico, NON il pallone di stelle UEFA ne' la sua scritta, che sono marchi
 * registrati e non vanno riprodotti su un funnel a premi. Danno l'idea della
 * grande notte europea restando cosa nostra.
 * [x, y] in percentuale, r = raggio, o = opacita', p = true per far pulsare.
 */
const STARS: [number, number, number, boolean][] = [
  [6, 8, 1.5, true], [14, 18, 0.9, false], [22, 6, 1.1, false], [30, 14, 2.1, true],
  [9, 30, 1.0, false], [18, 40, 1.4, true], [4, 52, 0.8, false], [12, 63, 1.7, true],
  [26, 55, 0.9, false], [33, 34, 1.2, false], [40, 10, 1.6, true], [48, 22, 0.9, false],
  [44, 46, 1.3, false], [52, 8, 1.1, true], [58, 34, 2.0, true], [50, 58, 1.0, false],
  [64, 14, 1.4, false], [70, 26, 0.9, false], [76, 9, 1.7, true], [68, 48, 1.2, true],
  [82, 20, 1.0, false], [88, 12, 1.5, true], [94, 26, 0.9, false], [90, 40, 1.3, false],
  [96, 54, 1.1, true], [84, 58, 0.9, false], [78, 42, 1.6, true], [60, 62, 0.9, false],
  [36, 66, 1.2, true], [20, 72, 1.0, false], [46, 74, 0.8, false], [72, 68, 1.4, true],
];

/**
 * Pallone di stelle: sfondo grande e centrato dietro l'hero. Corona di stelle
 * a cinque punte con le punte verso l'esterno attorno a una sfera accennata.
 * Costruito qui in SVG su richiesta esplicita del titolare.
 */
function StarBall() {
  const cx = 50;
  const cy = 50;
  const ring = Array.from({ length: 9 }, (_, i) => {
    const a = i * 40; // gradi, in senso orario dall'alto
    const rad = (a * Math.PI) / 180;
    const R = 30;
    const x = cx + R * Math.sin(rad);
    const y = cy - R * Math.cos(rad);
    return { x, y, a };
  });
  return (
    <svg
      className="pointer-events-none absolute left-1/2 top-1/2 aspect-square w-[130%] max-w-[720px] -translate-x-1/2 -translate-y-1/2"
      viewBox="0 0 100 100"
      aria-hidden="true"
    >
      <defs>
        <path
          id="fp-star5"
          d="M0-1 .2245-.309 .9511-.309 .3633.118 .5878.809 0 .382 -.5878.809 -.3633.118 -.9511-.309 -.2245-.309Z"
          fill="#e6efff"
        />
        <radialGradient id="fp-ballglow" cx="50%" cy="42%" r="60%">
          <stop offset="0%" stopColor="#9cc2ff" stopOpacity="0.28" />
          <stop offset="65%" stopColor="#3b64c8" stopOpacity="0.10" />
          <stop offset="100%" stopColor="#0a1c45" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Bagliore sferico e curvatura del pallone */}
      <circle cx={cx} cy={cy} r="40" fill="url(#fp-ballglow)" />
      <circle cx={cx} cy={cy} r="30" fill="none" stroke="#bcd2ff" strokeOpacity="0.14" strokeWidth="0.6" />
      <ellipse cx={cx} cy={cy} rx="13" ry="30" fill="none" stroke="#bcd2ff" strokeOpacity="0.10" strokeWidth="0.5" />
      <ellipse cx={cx} cy={cy} rx="30" ry="13" fill="none" stroke="#bcd2ff" strokeOpacity="0.10" strokeWidth="0.5" />
      {/* Corona di stelle con le punte verso l'esterno */}
      {ring.map((s, i) => (
        <use
          key={i}
          href="#fp-star5"
          transform={`translate(${s.x} ${s.y}) rotate(${s.a}) scale(6.2)`}
        />
      ))}
      {/* Stella centrale, piu' piccola, a chiudere la sfera */}
      <use href="#fp-star5" transform={`translate(${cx} ${cy}) scale(4)`} opacity="0.85" />
    </svg>
  );
}

/** Stella a quattro punte, sfondo grande dell'hero. */
function Starfield() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 100 70"
      preserveAspectRatio="xMidYMin slice"
      aria-hidden="true"
    >
      <defs>
        {/* Sagoma della singola stella, riusata scalata per ogni posizione. */}
        <path
          id="fp-star"
          d="M0-1C.12-.28.28-.12 1 0 .28.12.12.28 0 1-.12.28-.28.12-1 0-.28-.12-.12-.28 0-1Z"
          fill="#dbe7ff"
        />
      </defs>
      {STARS.map(([x, y, r, p], i) => (
        <use
          key={i}
          href="#fp-star"
          transform={`translate(${x} ${y}) scale(${r})`}
          opacity={0.35 + r * 0.28}
          className={p ? "fp-twinkle" : undefined}
          style={p ? { animationDelay: `${(i % 5) * 0.6}s` } : undefined}
        />
      ))}
    </svg>
  );
}

const STEPS = [
  { n: "01", title: "Entra gratis", text: "Scarica l'app e iscriviti alla lega." },
  { n: "02", title: "Pronostica", text: "Scegli i tuoi pronostici sulle partite Champions." },
  { n: "03", title: "Sfida 1vs1", text: "Ogni giornata affronti un avversario casuale." },
];

const OUTCOMES = [
  { label: "Vinci", value: "+10", note: "punti bonus", ring: "border-emerald-400/45 bg-emerald-400/10 text-emerald-300" },
  { label: "Pareggi", value: "0", note: "punti", ring: "border-white/20 bg-white/[0.05] text-white/80" },
  { label: "Perdi", value: "−10", note: "punti malus", ring: "border-red-400/45 bg-red-400/10 text-red-300" },
];

export default function ChampionsLeaguePage() {
  const [showSticky, setShowSticky] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
    // La barra compare dopo il primo schermo: prima il CTA grande e' gia' li'.
    const onScroll = () => setShowSticky(window.scrollY > window.innerHeight * 0.7);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#050f24] text-white">
      {/* Animazioni locali alla pagina: restano qui per non toccare il tema
          globale usato dalle altre landing. */}
      <style>{`
        @keyframes fpFloat { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-9px) } }
        @keyframes fpPulse { 0%,100% { opacity: .55 } 50% { opacity: 1 } }
        @keyframes fpTwinkle { 0%,100% { opacity: .25 } 50% { opacity: 1 } }
        .fp-float { animation: fpFloat 5s ease-in-out infinite }
        .fp-pulse { animation: fpPulse 3.2s ease-in-out infinite }
        .fp-twinkle { animation: fpTwinkle 3.4s ease-in-out infinite }
        @media (prefers-reduced-motion: reduce) {
          .fp-float, .fp-pulse, .fp-twinkle { animation: none }
        }
      `}</style>

      <main>
        {/* ══ HERO ═══════════════════════════════════════════════════════ */}
        <section className="relative flex min-h-[100svh] flex-col overflow-hidden">
          {/* Stadio + velatura: l'immagine esiste gia' nel progetto */}
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${LEAGUE.stadium})` }}
            aria-hidden="true"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgba(5,15,36,0.90) 0%, rgba(5,15,36,0.62) 30%, rgba(5,15,36,0.88) 70%, #050f24 100%)",
            }}
            aria-hidden="true"
          />
          {/* Sfondo grande a stelle sparse. */}
          <div className="pointer-events-none absolute inset-0 opacity-70" aria-hidden="true">
            <Starfield />
          </div>
          {/* Pallone di stelle, filigrana centrale grande. */}
          <div className="pointer-events-none absolute inset-0 opacity-[0.5]" aria-hidden="true">
            <StarBall />
          </div>

          {/* Fasci dei riflettori: notte di coppa, solo CSS */}
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-[60%] opacity-30"
            style={{
              background:
                "conic-gradient(from 200deg at 22% -10%, transparent 0deg, rgba(120,180,255,0.28) 12deg, transparent 26deg), " +
                "conic-gradient(from 110deg at 80% -10%, transparent 0deg, rgba(255,170,90,0.26) 12deg, transparent 26deg)",
            }}
            aria-hidden="true"
          />

          {/* Bagliori: danno l'atmosfera notturna senza immagini extra */}
          <div className="fp-pulse pointer-events-none absolute -top-24 left-1/2 h-[320px] w-[560px] -translate-x-1/2 rounded-full bg-brand-orange/25 blur-[120px]" aria-hidden="true" />
          <div className="pointer-events-none absolute bottom-0 left-0 h-[260px] w-[360px] rounded-full bg-brand-blue/30 blur-[120px]" aria-hidden="true" />

          {/* Barra superiore */}
          <div className="relative z-20">
            <div className="container-x flex items-center justify-between py-5">
              <Link to="/" className="flex items-center gap-2.5">
                <img src="/brand-icon.png" alt="" className="h-9 w-9 rounded-xl" />
                <span className="font-display text-[17px] font-bold tracking-tight">
                  Fanta<span className="text-brand-orange">Pronostic</span>
                </span>
              </Link>
              <Link
                to="/"
                className="inline-flex items-center gap-2 text-sm font-semibold text-white/75 transition-colors hover:text-white"
              >
                <ArrowLeft size={16} aria-hidden="true" />
                Home
              </Link>
            </div>
          </div>

          <div className="container-x relative z-10 flex flex-1 flex-col items-center justify-center gap-4 py-4 text-center [@media(max-height:660px)]:gap-2.5 sm:gap-6 sm:py-8">
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Badge delay={0.05} strong>🎟️ Gratis</Badge>
              <Badge delay={0.12}>🏆 {LEAGUE.prizePool} premi</Badge>
              <Badge delay={0.19}>⚔️ Arena 1vs1</Badge>
            </div>

            {/* Dice subito su cosa si pronostica: e' la domanda che si fa chi
                arriva da un social e non conosce la lega. */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.16 }}
              className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-yellow sm:text-[13px]"
            >
              Pronostici sulle partite di Champions League
            </motion.p>

            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="font-display text-[clamp(2rem,9vw,4.6rem)] font-bold uppercase leading-[0.88] tracking-tightest"
            >
              <span className="block text-white">F.P</span>
              <span
                className="block bg-gradient-to-r from-[#FFD24A] via-brand-orange to-[#FF7A18] bg-clip-text text-transparent"
                style={{ paddingBottom: "0.06em" }}
              >
                Champions League
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.24 }}
              className="max-w-[20rem] text-[15px] font-semibold leading-snug text-white/90 sm:max-w-md sm:text-xl"
            >
              Ogni giornata sfidi un avversario in una{" "}
              <span className="text-brand-yellow">sfida 1vs1</span>. Gratis.
            </motion.p>

            <motion.img
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              src={LEAGUE.hero}
              srcSet={`${LEAGUE.hero} 1200w, ${LEAGUE.heroTall} 928w`}
              sizes="(min-width: 768px) 320px, 100vw"
              alt="Pronox, la mascotte di FantaPronostic, sfida un avversario nell'Arena 1vs1"
              width={1200}
              height={630}
              loading="eager"
              fetchPriority="high"
              decoding="async"
              className="fp-float w-full max-w-sm rounded-2xl [@media(max-height:660px)]:hidden md:max-w-[17rem]"
            />

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.3 }}
              className="flex w-full flex-col items-center gap-3"
            >
              <DownloadCta placement="hero" className="max-w-sm" />
              <StoreNote />
            </motion.div>
          </div>
        </section>

        {/* ══ COME FUNZIONA ══════════════════════════════════════════════ */}
        <section className="relative py-14 md:py-20">
          <div className="container-x">
            <motion.h2
              {...reveal}
              className="text-center font-display text-[clamp(1.7rem,7vw,2.6rem)] font-bold tracking-tightest"
            >
              Come funziona?
            </motion.h2>

            <ol className="mx-auto mt-8 grid max-w-4xl gap-3 sm:grid-cols-3">
              {STEPS.map((s, i) => (
                <motion.li
                  key={s.n}
                  {...reveal}
                  transition={{ duration: 0.45, delay: i * 0.07 }}
                  className="relative overflow-hidden rounded-2xl border border-white/12 bg-white/[0.04] p-5 backdrop-blur-sm"
                >
                  {/* bordo luminoso in alto */}
                  <span
                    className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-orange/70 to-transparent"
                    aria-hidden="true"
                  />
                  <span className="block font-display text-4xl font-bold leading-none text-brand-orange/35 tabular-nums">
                    {s.n}
                  </span>
                  <h3 className="mt-3 font-display text-lg font-bold">{s.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-white/65">{s.text}</p>
                </motion.li>
              ))}
            </ol>
          </div>
        </section>

        {/* ══ ARENA 1vs1 ═════════════════════════════════════════════════ */}
        <section
          className="relative overflow-hidden py-14 md:py-20"
          style={{
            background: "radial-gradient(120% 100% at 50% 0%, #17347a 0%, #0a1c45 55%, #050f24 100%)",
          }}
        >
          <div className="container-x relative">
            <motion.div {...reveal} className="mx-auto max-w-xl text-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-brand-orange/40 bg-brand-orange/10 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-brand-orange">
                <Swords size={13} aria-hidden="true" />
                Arena
              </span>
              <h2 className="mt-4 font-display text-[clamp(1.7rem,7vw,2.6rem)] font-bold leading-tight tracking-tightest">
                Ogni giornata è una sfida 1vs1
              </h2>
              <p className="mt-4 leading-relaxed text-white/70">
                Nell'Arena non giochi solo contro la classifica: ogni giornata sfidi un avversario
                a colpi di pronostici.
              </p>
            </motion.div>

            {/* Tabellone: solo CSS, nessuna immagine da caricare */}
            <motion.div
              {...reveal}
              transition={{ duration: 0.55, delay: 0.08 }}
              className="mx-auto mt-9 max-w-md overflow-hidden rounded-3xl border border-white/15 bg-[#081533]/85 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.9)] backdrop-blur-sm"
            >
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.2em] text-white/45">
                <span>Giornata 1</span>
                <span className="flex items-center gap-1.5 text-brand-orange">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-orange" aria-hidden="true" />
                  Finale
                </span>
              </div>

              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-5 py-6">
                <div className="flex flex-col items-center gap-2 text-center">
                  <span className="grid h-14 w-14 place-items-center rounded-full bg-brand-orange/15 text-2xl ring-2 ring-brand-orange/40">
                    🦊
                  </span>
                  <span className="font-display text-sm font-bold">Pronox</span>
                </div>

                <div className="flex flex-col items-center">
                  <span className="font-display text-4xl font-bold tabular-nums">
                    4<span className="mx-1.5 text-white/30">–</span>2
                  </span>
                  <span className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white/40">
                    punti
                  </span>
                </div>

                <div className="flex flex-col items-center gap-2 text-center">
                  <span className="grid h-14 w-14 place-items-center rounded-full bg-white/[0.06] text-2xl ring-2 ring-white/15">
                    👤
                  </span>
                  <span className="font-display text-sm font-bold text-white/70">Avversario</span>
                </div>
              </div>

              <div className="flex items-center justify-center gap-2 border-t border-emerald-400/25 bg-emerald-400/10 px-5 py-3">
                <span className="font-display text-sm font-bold text-emerald-300">Pronox vince</span>
                <span className="rounded-full bg-emerald-400/20 px-2.5 py-0.5 font-display text-sm font-bold text-emerald-300 tabular-nums">
                  {LEAGUE.bonus}
                </span>
              </div>
            </motion.div>

            <div className="mx-auto mt-6 grid max-w-md grid-cols-3 gap-2.5">
              {OUTCOMES.map((o, i) => (
                <motion.div
                  key={o.label}
                  {...reveal}
                  transition={{ duration: 0.4, delay: 0.12 + i * 0.06 }}
                  className={`rounded-2xl border px-2 py-4 text-center ${o.ring}`}
                >
                  <span className="block text-[10px] font-bold uppercase tracking-[0.14em] opacity-75">
                    {o.label}
                  </span>
                  <span className="mt-1.5 block font-display text-2xl font-bold tabular-nums">{o.value}</span>
                  <span className="mt-0.5 block text-[10px] opacity-65">{o.note}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ══ PREMI ══════════════════════════════════════════════════════ */}
        <section className="relative overflow-hidden py-14 md:py-20">
          <div
            className="fp-pulse pointer-events-none absolute left-1/2 top-4 h-[220px] w-[420px] -translate-x-1/2 rounded-full bg-[#FFD24A]/20 blur-[110px]"
            aria-hidden="true"
          />
          <div className="container-x relative">
            <motion.div {...reveal} className="mx-auto flex max-w-lg flex-col items-center gap-4 text-center">
              <span className="text-5xl" aria-hidden="true">🏆</span>
              <h2 className="font-display text-[clamp(1.9rem,8vw,3rem)] font-bold tracking-tightest">
                <span className="bg-gradient-to-r from-[#FFE07A] to-[#FFB01F] bg-clip-text text-transparent">
                  {LEAGUE.prizePool}
                </span>{" "}
                di montepremi
              </h2>
              <p className="leading-relaxed text-white/70">
                In palio buoni Amazon per un valore totale di {LEAGUE.prizePool}.
              </p>
              <DownloadCta placement="prizes" size="md" className="mt-2 max-w-xs" />
            </motion.div>
          </div>
        </section>

        {/* ══ CTA FINALE ═════════════════════════════════════════════════ */}
        <section className="relative overflow-hidden py-16 md:py-24">
          <div
            className="absolute inset-0"
            style={{
              background: "radial-gradient(110% 100% at 50% 100%, #17347a 0%, #0a1c45 55%, #050f24 100%)",
            }}
            aria-hidden="true"
          />
          <div className="container-x relative">
            <motion.div {...reveal} className="mx-auto flex max-w-md flex-col items-center gap-4 text-center">
              <h2 className="font-display text-[clamp(1.9rem,8vw,3rem)] font-bold tracking-tightest">
                Che aspetti?
              </h2>
              <p className="leading-relaxed text-white/75">
                Entra gratis nella F.P Champions League.
              </p>
              <DownloadCta placement="final" className="mt-2 max-w-sm" />
              <StoreNote />
            </motion.div>
          </div>
        </section>
      </main>

      {/* Barra fissa su mobile, con spazio per la tacca degli iPhone. */}
      {showSticky && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#050f24]/95 backdrop-blur-md md:hidden">
          <div className="container-x flex items-center justify-between gap-3 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]">
            <div className="min-w-0">
              <p className="truncate font-display text-sm font-bold">F.P Champions League</p>
              <p className="text-[11px] text-white/55">Gratis · {LEAGUE.prizePool} in premi</p>
            </div>
            <StickyCta />
          </div>
        </div>
      )}

      <footer className="border-t border-white/10">
        <div className="container-x py-8 pb-28 text-center text-xs text-white/45 md:pb-8">
          © {new Date().getFullYear()} FantaPronostic. Tutti i diritti riservati.
        </div>
      </footer>
    </div>
  );
}

/** CTA compatto della barra fissa. */
function StickyCta() {
  const platform = usePlatform();
  return (
    <a
      href={storeUrlFor(platform)}
      rel="noopener noreferrer"
      onClick={() => {
        if (platform === "ios") openAppStore();
        trackStoreClick(platform === "android" ? "google" : "apple", "sticky_bar");
      }}
      className="inline-flex min-h-[50px] shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-brand-orange to-[#FFA640] px-6 font-display text-[15px] font-bold text-white shadow-[0_8px_26px_-8px_rgba(245,130,32,0.95)]"
    >
      Scarica gratis
    </a>
  );
}
