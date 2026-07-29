import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { track } from "@vercel/analytics";
import { trackDownload } from "@/lib/trackDownload";
import {
  ArrowLeft,
  ArrowRight,
  Users,
  Target,
  Gift,
  Plane,
  ChevronDown,
  Star,
  ShieldCheck,
  Trophy,
  CalendarDays,
} from "lucide-react";
import {
  COMMUNITY_LEAGUE,
  CAPTAINS,
  COMMUNITY_SCORING,
  COMMUNITY_REGOLAMENTO,
} from "@/data/communityLeague";

const ANDROID_URL = "https://play.google.com/store/apps/details?id=com.fantapronostic.app";

const reveal = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.55 },
};

function initials(name: string) {
  return name
    .split(" ")
    .filter((w) => !/^(il|la|i|del|da|di|the)$/i.test(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function CaptainAvatar({ name, image }: { name: string; image: string }) {
  const [failed, setFailed] = useState(false);
  if (image && !failed) {
    return (
      <img
        src={image}
        alt={name}
        onError={() => setFailed(true)}
        className="h-24 w-24 rounded-full object-cover ring-4 ring-white/10"
      />
    );
  }
  return (
    <div className="h-24 w-24 rounded-full grid place-items-center bg-white/10 ring-4 ring-white/10 font-display font-bold text-2xl text-white">
      {initials(name)}
    </div>
  );
}

export default function CommunityLeaguePage() {
  const [openArticle, setOpenArticle] = useState<number | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
    track("community_view");
  }, []);

  const DownloadCta = (
    <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
      <a
        href="https://apps.apple.com/it/app/fantapronostic/id6760613936"
        rel="noopener noreferrer"
        onClick={() => {
          trackDownload("click_appstore");
          track("community_ios_click");
        }}
        className="btn-blue"
      >
        Scarica su App Store
      </a>
      <a
        href={ANDROID_URL}
        rel="noopener noreferrer"
        onClick={() => {
          trackDownload("click_googleplay");
          track("community_android_click");
        }}
        className="btn-primary"
      >
        Scarica su Google Play
      </a>
    </div>
  );

  return (
    <div className="min-h-screen bg-bg-base">
      <main>
        {/* ══ HERO (verde) ═══════════════════════════════════════════════ */}
        <section
          className="relative overflow-hidden"
          style={{
            background:
              "radial-gradient(120% 90% at 50% 0%, #12692f 0%, #0a3d1f 45%, #062814 100%)",
          }}
        >
          <div
            className="absolute inset-0 opacity-[0.08] pointer-events-none"
            style={{
              backgroundImage:
                "repeating-linear-gradient(180deg, rgba(255,255,255,0.6) 0px, rgba(255,255,255,0.6) 2px, transparent 2px, transparent 44px)",
            }}
          />
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[360px] rounded-full bg-brand-orange/15 blur-[130px]" />

          {/* Top bar */}
          <div className="absolute top-0 inset-x-0 z-20">
            <div className="container-x py-5 flex items-center justify-between">
              <Link to="/" className="flex items-center gap-2.5">
                <img src="/brand-icon.png" alt="FantaPronostic" className="h-9 w-9 rounded-xl" />
                <span className="font-display font-bold text-[17px] tracking-tight text-white">
                  Fanta<span className="text-brand-orange">Pronostic</span>
                </span>
              </Link>
              <Link
                to="/"
                className="inline-flex items-center gap-2 text-sm font-semibold text-white/80 hover:text-white transition-colors"
              >
                <ArrowLeft size={16} />
                Home
              </Link>
            </div>
          </div>

          <div className="relative z-10 container-x py-28 md:py-32 text-center">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-1.5 text-[12px] font-bold uppercase tracking-[0.15em] text-green-800"
            >
              <Star size={12} className="text-green-700" />
              Iscrizione gratuita
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.08 }}
              className="mt-7 font-display font-black text-[clamp(2.4rem,10vw,6rem)] leading-[0.9] tracking-tightest uppercase"
            >
              <span className="text-brand-orange">Community</span>
              <br />
              <span className="text-white">League</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.22 }}
              className="mt-6 text-white/80 text-base md:text-lg max-w-xl mx-auto leading-relaxed"
            >
              La lega gratuita di FantaPronostic. Scegli la community del tuo capitano preferito,
              pronostica ogni giornata e vinci premi settimanali e finali.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.28 }}
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/15 px-4 py-2 backdrop-blur-md text-sm font-semibold text-white"
            >
              <CalendarDays size={15} className="text-brand-orange" />
              Start: {COMMUNITY_LEAGUE.startLabel}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.34 }}
              className="mt-9"
            >
              {DownloadCta}
            </motion.div>
          </div>
        </section>

        {/* ══ COME FUNZIONA ══════════════════════════════════════════════ */}
        <section className="section-pad">
          <div className="container-x">
            <motion.div {...reveal} className="text-center max-w-xl mx-auto">
              <p className="overline justify-center">Come funziona</p>
              <h2 className="mt-4 font-display font-bold text-3xl md:text-5xl tracking-tightest text-ink">
                In 3 passi
              </h2>
            </motion.div>
            <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
              {[
                {
                  icon: <ShieldCheck size={22} />,
                  title: "Iscriviti gratis",
                  desc: "Scarica FantaPronostic e iscriviti alla Community League: è completamente gratuito.",
                },
                {
                  icon: <Users size={22} />,
                  title: "Scegli il capitano",
                  desc: "Seleziona la community del creator che preferisci: i tuoi punti fanno classifica anche per lei.",
                },
                {
                  icon: <Target size={22} />,
                  title: "Pronostica e vinci",
                  desc: "Ogni giornata inserisci i pronostici sulle partite di Serie A e prova a vincere i premi.",
                },
              ].map((s, i) => (
                <motion.div
                  key={i}
                  {...reveal}
                  transition={{ duration: 0.55, delay: i * 0.08 }}
                  className="card p-7 relative"
                >
                  <span className="absolute top-6 right-7 font-display font-bold text-4xl text-line2/80 tabular-nums">
                    {i + 1}
                  </span>
                  <div className="h-12 w-12 rounded-2xl bg-green-600/10 grid place-items-center text-green-700">
                    {s.icon}
                  </div>
                  <h3 className="mt-5 font-display font-bold text-lg text-ink">{s.title}</h3>
                  <p className="mt-2 text-sm text-muted leading-relaxed">{s.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ══ CAPITANI (scuro verde) ═════════════════════════════════════ */}
        <section
          className="relative overflow-hidden section-pad"
          style={{
            background:
              "radial-gradient(120% 100% at 50% 0%, #12692f 0%, #0a3d1f 55%, #062814 100%)",
          }}
        >
          <div className="container-x relative">
            <motion.div {...reveal} className="text-center max-w-lg mx-auto">
              <p className="text-brand-orange text-[11px] font-bold uppercase tracking-[0.22em]">
                Le community
              </p>
              <h2 className="mt-3 font-display font-bold text-3xl md:text-5xl tracking-tightest text-white">
                Scegli il tuo capitano
              </h2>
              <p className="mt-4 text-white/60 leading-relaxed">
                Sei capitani creator, sei community. Scegli la tua e scala la classifica insieme.
              </p>
            </motion.div>

            <div className="mt-12 grid grid-cols-2 md:grid-cols-3 gap-5 max-w-4xl mx-auto">
              {CAPTAINS.map((c, i) => (
                <motion.div
                  key={c.name}
                  {...reveal}
                  transition={{ duration: 0.5, delay: i * 0.06 }}
                  className="flex flex-col items-center text-center gap-3 rounded-3xl bg-white/[0.05] border border-white/12 p-5 backdrop-blur-sm"
                >
                  <CaptainAvatar name={c.name} image={c.image} />
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-orange">
                    Capitano
                  </span>
                  <span className="font-display font-bold text-white leading-tight">{c.name}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ══ PREMI ══════════════════════════════════════════════════════ */}
        <section className="section-pad bg-bg-soft">
          <div className="container-x">
            <motion.div {...reveal} className="text-center max-w-lg mx-auto">
              <p className="overline justify-center">Premi</p>
              <h2 className="mt-4 font-display font-bold text-3xl md:text-5xl tracking-tightest text-ink">
                Cosa puoi vincere
              </h2>
            </motion.div>

            <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
              <motion.div {...reveal} className="card p-8 text-center flex flex-col items-center gap-4">
                <div className="h-14 w-14 rounded-2xl bg-brand-orange/10 grid place-items-center text-brand-orange">
                  <Gift size={26} />
                </div>
                <span className="text-xs font-bold uppercase tracking-widest text-muted">
                  Ogni settimana
                </span>
                <h3 className="font-display font-bold text-2xl text-ink">{COMMUNITY_LEAGUE.weeklyPrize}</h3>
                <p className="text-sm text-muted">Per il miglior punteggio settimanale.</p>
              </motion.div>

              <motion.div
                {...reveal}
                transition={{ duration: 0.55, delay: 0.08 }}
                className="card p-8 text-center flex flex-col items-center gap-4 border-brand-orange ring-2 ring-brand-orange/20 shadow-cta"
              >
                <div className="h-14 w-14 rounded-2xl bg-brand-orange/10 grid place-items-center text-brand-orange">
                  <Plane size={26} />
                </div>
                <span className="text-xs font-bold uppercase tracking-widest text-muted">
                  Per il 1° classificato
                </span>
                <h3 className="font-display font-bold text-2xl text-ink">{COMMUNITY_LEAGUE.finalPrize}</h3>
                <p className="text-sm text-muted">Al termine della stagione della Community League.</p>
              </motion.div>
            </div>

            {/* Punteggi */}
            <div className="mt-8 max-w-md mx-auto card p-6">
              <h3 className="font-display font-bold text-lg text-ink mb-4">Punti per pronostico</h3>
              <ul className="flex flex-col divide-y divide-line">
                {COMMUNITY_SCORING.map((s) => (
                  <li key={s.label} className="flex items-center justify-between py-3">
                    <span className="text-sm text-ink2">{s.label}</span>
                    <span className="chip-orange">
                      {s.points} {s.points === 1 ? "punto" : "punti"}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-muted">
                Multipronostico: nella stessa partita puoi ottenere punti per più pronostici corretti
                (max 9 punti a partita).
              </p>
              <div className="mt-4 rounded-2xl bg-brand-orange/10 p-4 flex items-start gap-3">
                <div className="h-9 w-9 rounded-lg bg-brand-orange/20 grid place-items-center text-brand-orange shrink-0 font-display font-bold text-sm">
                  x3
                </div>
                <p className="text-sm text-ink2 leading-relaxed">
                  <strong>Ogni settimana</strong> una partita è designata <strong>X3</strong>: i suoi
                  punti valgono il triplo (fino a 27 punti).
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ══ REGOLAMENTO ════════════════════════════════════════════════ */}
        <section className="section-pad">
          <div className="container-x">
            <motion.div {...reveal} className="max-w-2xl mx-auto text-center">
              <p className="overline justify-center">Regolamento</p>
              <h2 className="mt-4 font-display font-bold text-3xl md:text-4xl tracking-tightest text-ink">
                Regolamento completo
              </h2>
              <p className="mt-3 text-muted">
                Community League · {COMMUNITY_REGOLAMENTO.length} articoli
              </p>
            </motion.div>

            <div className="mt-10 max-w-2xl mx-auto flex flex-col gap-2.5">
              {COMMUNITY_REGOLAMENTO.map((art) => {
                const open = openArticle === art.n;
                return (
                  <div key={art.n} className="card overflow-hidden">
                    <button
                      onClick={() => setOpenArticle(open ? null : art.n)}
                      className="w-full flex items-center justify-between gap-3 p-5 text-left hover:bg-bg-soft transition-colors"
                    >
                      <span className="text-sm font-semibold text-ink">
                        <span className="text-brand-orange">Art. {art.n}</span> · {art.title}
                      </span>
                      <ChevronDown
                        size={18}
                        className={`text-muted shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
                      />
                    </button>
                    {open && (
                      <div className="px-5 pb-5 -mt-1">
                        <p className="text-sm text-ink2 leading-relaxed whitespace-pre-line">
                          {art.body}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ══ CTA FINALE ═════════════════════════════════════════════════ */}
        <section className="section-pad bg-bg-soft">
          <div className="container-x text-center">
            <motion.div {...reveal} className="max-w-xl mx-auto">
              <div className="inline-flex items-center gap-2 rounded-full bg-green-600/10 border border-green-600/25 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-green-700">
                <Trophy size={13} />
                Iscrizione gratuita
              </div>
              <h2 className="mt-5 font-display font-bold text-3xl md:text-4xl tracking-tightest text-ink">
                Entra nella Community League
              </h2>
              <p className="mt-3 text-muted">
                Scarica l'app, iscriviti gratis e scegli il tuo capitano.
              </p>
              <div className="mt-8">{DownloadCta}</div>
            </motion.div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-white">
        <div className="container-x py-8 text-center text-xs text-muted">
          © {new Date().getFullYear()} FantaPronostic. Tutti i diritti riservati.
        </div>
      </footer>
    </div>
  );
}
