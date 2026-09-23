/**
 * Anteprime social per le landing page.
 *
 * Il sito e' una SPA: Vercel serve sempre lo stesso index.html e i crawler di
 * WhatsApp, Instagram, Facebook e X leggono quell'HTML, non il DOM costruito da
 * React. Risultato: ogni link condiviso mostrava titolo, testo e immagine
 * generici del sito, qualunque pagina fosse.
 *
 * Qui, dopo il build, per ogni rotta si scrive dist/<rotta>/index.html: una
 * copia di index.html con i propri meta. E' lo stesso bundle, quindi l'app parte
 * identica; cambia solo cio' che leggono i crawler.
 *
 * Vercel controlla i file statici PRIMA delle rewrite di vercel.json, quindi
 * questi file vincono sul fallback della SPA senza toccare la configurazione.
 *
 * Per aggiungere una pagina basta una voce in PAGES.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, "dist");


// Stessa tabella usata a runtime da src/lib/pageMeta.ts: titolo e descrizione
// visti dal visitatore e quelli visti da un crawler non possono divergere.
const META = JSON.parse(await readFile(join(ROOT, "src/data/pageMeta.json"), "utf8"));
const PAGES = META.pages;

/** Sostituisce un tag se c'e', senza inventarne di nuovi. */
function replaceTag(html, pattern, replacement) {
  if (!pattern.test(html)) {
    throw new Error(`tag non trovato in index.html: ${pattern}`);
  }
  return html.replace(pattern, replacement);
}

function escapeAttr(value) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function buildHtml(base, page, path) {
  const SITE = META.site;
  const title = escapeAttr(page.title);
  const description = escapeAttr(page.description);
  const image = SITE + page.image;
  const url = SITE + path;

  let html = base;
  html = replaceTag(html, /<title>[\s\S]*?<\/title>/, `<title>${title}</title>`);
  html = replaceTag(html, /(<meta name="description" content=")[\s\S]*?(")/, `$1${description}$2`);
  html = replaceTag(html, /(<meta property="og:title" content=")[\s\S]*?(")/, `$1${title}$2`);
  html = replaceTag(html, /(<meta property="og:description" content=")[\s\S]*?(")/, `$1${description}$2`);
  html = replaceTag(html, /(<meta property="og:image" content=")[\s\S]*?(")/, `$1${image}$2`);
  html = replaceTag(html, /(<meta property="og:image:width" content=")[\s\S]*?(")/, `$1${page.imageWidth}$2`);
  html = replaceTag(html, /(<meta property="og:image:height" content=")[\s\S]*?(")/, `$1${page.imageHeight}$2`);
  html = replaceTag(html, /(<meta property="og:url" content=")[\s\S]*?(")/, `$1${url}$2`);
  html = replaceTag(html, /(<meta name="twitter:title" content=")[\s\S]*?(")/, `$1${title}$2`);
  html = replaceTag(html, /(<meta name="twitter:description" content=")[\s\S]*?(")/, `$1${description}$2`);
  html = replaceTag(html, /(<meta name="twitter:image" content=")[\s\S]*?(")/, `$1${image}$2`);
  return html;
}

const base = await readFile(join(DIST, "index.html"), "utf8");
let written = 0;

for (const page of PAGES) {
  for (const path of page.paths) {
    const html = buildHtml(base, page, path);
    const dir = join(DIST, path);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, "index.html"), html, "utf8");
    written += 1;
  }
}

console.log(`[social-meta] anteprime generate per ${written} rotte`);
