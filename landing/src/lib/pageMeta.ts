import meta from "@/data/pageMeta.json";

/**
 * Titolo e descrizione per rotta, applicati da un punto solo.
 *
 * Prima ogni pagina si salvava i meta trovati all'ingresso e li rimetteva
 * uscendo. Non funzionava: chi atterra direttamente su /fp-champions-league
 * riceve dal server un HTML che contiene gia' i meta della Champions, quindi
 * quel "valore precedente" era la Champions stessa e restava sulla home.
 *
 * Qui il valore giusto non si deduce da cio' che c'era prima: si legge dalla
 * tabella, e per le rotte senza voce si torna ai valori generici del sito.
 * La stessa tabella alimenta scripts/social-meta.mjs, cosi' quello che vede il
 * visitatore e quello che vede un crawler non possono divergere.
 */
export type PageMeta = { title: string; description: string };

const DEFAULT: PageMeta = {
  title: meta.default.title,
  description: meta.default.description,
};

/** Confronto senza slash finale: /community e /community/ sono la stessa rotta. */
function normalise(pathname: string): string {
  const clean = pathname.replace(/\/+$/, "");
  return clean === "" ? "/" : clean.toLowerCase();
}

export function metaForPath(pathname: string): PageMeta {
  const path = normalise(pathname);
  for (const page of meta.pages) {
    if (page.paths.some((p) => normalise(p) === path)) {
      return { title: page.title, description: page.description };
    }
  }
  return DEFAULT;
}

/** Scrive titolo e descrizione nel documento. */
export function applyPageMeta(pathname: string): void {
  const { title, description } = metaForPath(pathname);
  document.title = title;
  document.querySelector('meta[name="description"]')?.setAttribute("content", description);
}
