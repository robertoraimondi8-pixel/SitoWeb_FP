import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function PrivacyPage() {
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = "Privacy Policy — FantaPronostic";
  }, []);

  return (
    <div className="min-h-screen bg-bg-soft" data-testid="privacy-page">
      {/* Header */}
      <header className="bg-white border-b border-line">
        <div className="container-x py-5 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5" data-testid="privacy-header-logo">
            <img src="/brand-icon.png" alt="FantaPronostic" className="h-9 w-9 rounded-xl" />
            <span className="font-display font-bold text-[17px] tracking-tight">
              <span className="text-brand-orange">Fanta</span>
              <span className="text-brand-blue">Pronostic</span>
            </span>
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-ink2 hover:text-brand-blue transition-colors"
            data-testid="privacy-back-home"
          >
            <ArrowLeft size={16} />
            Torna alla home
          </Link>
        </div>
      </header>

      <main className="container-x py-16 md:py-20">
        <div className="max-w-3xl mx-auto">
          <p className="overline">Documento Legale</p>
          <h1 className="font-display font-bold text-4xl md:text-5xl lg:text-6xl mt-4 tracking-tightest text-ink">
            Privacy Policy
          </h1>
          <p className="mt-4 text-sm text-muted">
            Ultimo aggiornamento: Febbraio 2026
          </p>

          <div className="mt-10 space-y-5">
            <Section title="1. Introduzione">
              <p>
                La presente Privacy Policy descrive come FantaPronostic raccoglie,
                utilizza e protegge i dati personali degli utenti.
              </p>
              <p>
                Utilizzando l'app o il sito l'utente accetta le pratiche descritte in
                questa informativa.
              </p>
            </Section>

            <Section title="2. Dati raccolti">
              <p>FantaPronostic può raccogliere i seguenti dati:</p>
              <SubTitle>Dati forniti dall'utente</SubTitle>
              <Bullets items={["indirizzo email", "username", "informazioni di profilo"]} />
              <SubTitle>Dati di utilizzo</SubTitle>
              <Bullets
                items={[
                  "pronostici inseriti",
                  "attività nell'app",
                  "interazioni con leghe e classifiche",
                ]}
              />
              <SubTitle>Dati tecnici</SubTitle>
              <Bullets
                items={[
                  "dispositivo utilizzato",
                  "sistema operativo",
                  "identificatori tecnici necessari al funzionamento dell'app",
                ]}
              />
            </Section>

            <Section title="3. Finalità del trattamento">
              <p>I dati vengono utilizzati per:</p>
              <Bullets
                items={[
                  "creare e gestire l'account utente",
                  "consentire la partecipazione ai giochi di pronostici",
                  "calcolare classifiche e risultati",
                  "migliorare l'esperienza dell'app",
                  "comunicare aggiornamenti o informazioni relative al servizio",
                ]}
              />
            </Section>

            <Section title="4. Condivisione dei dati">
              <p>FantaPronostic non vende i dati personali degli utenti.</p>
              <p>I dati possono essere condivisi solo con:</p>
              <Bullets
                items={[
                  "fornitori di servizi tecnici necessari al funzionamento dell'app",
                  "provider di dati sportivi",
                  "servizi di hosting e infrastruttura",
                ]}
              />
            </Section>

            <Section title="5. Sicurezza dei dati">
              <p>
                FantaPronostic adotta misure tecniche e organizzative per proteggere i
                dati personali degli utenti.
              </p>
              <p>Tuttavia nessun sistema online può garantire sicurezza assoluta.</p>
            </Section>

            <Section title="6. Conservazione dei dati">
              <p>
                I dati personali sono conservati per il tempo necessario al
                funzionamento del servizio o fino alla richiesta di cancellazione
                dell'account da parte dell'utente.
              </p>
            </Section>

            <Section title="7. Diritti degli utenti">
              <p>Gli utenti possono richiedere:</p>
              <Bullets
                items={[
                  "accesso ai propri dati",
                  "modifica dei dati",
                  "cancellazione dell'account",
                ]}
              />
              <p>
                Per esercitare questi diritti è possibile contattare il supporto
                scrivendo a{" "}
                <a
                  href="mailto:support@fantapronostic.com"
                  className="text-brand-blue font-semibold hover:underline"
                >
                  support@fantapronostic.com
                </a>
                .
              </p>
            </Section>

            <Section title="8. Modifiche alla privacy policy">
              <p>La presente privacy policy può essere aggiornata nel tempo.</p>
              <p>Le modifiche verranno pubblicate sul sito o nell'app.</p>
            </Section>

            <Section title="9. Contatti">
              <p>
                Per richieste relative alla privacy è possibile contattare il supporto
                tramite l'indirizzo email{" "}
                <a
                  href="mailto:support@fantapronostic.com"
                  className="text-brand-blue font-semibold hover:underline"
                >
                  support@fantapronostic.com
                </a>
                .
              </p>
            </Section>
          </div>

          <div className="mt-12 pt-8 border-t border-line text-center">
            <Link to="/" className="btn-blue" data-testid="privacy-back-cta">
              <ArrowLeft size={16} />
              Torna a FantaPronostic
            </Link>
          </div>
        </div>
      </main>

      <footer className="border-t border-line bg-white">
        <div className="container-x py-8 text-center text-xs text-muted">
          © {new Date().getFullYear()} FantaPronostic. Tutti i diritti riservati.
        </div>
      </footer>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card p-6 md:p-8" data-testid={`privacy-section-${title.split(".")[0]}`}>
      <h2 className="font-display text-lg md:text-xl font-bold text-brand-blue mb-4">
        {title}
      </h2>
      <div className="space-y-3 text-ink2 leading-relaxed text-[15px]">{children}</div>
    </section>
  );
}

function SubTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="font-semibold text-ink mt-4 mb-1">{children}</h3>;
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5 pl-1">
      {items.map((it, i) => (
        <li key={i} className="flex gap-2.5 text-ink2">
          <span className="text-brand-orange font-bold mt-0.5">•</span>
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}
