// Link agli store + gestione apertura App Store su iOS.
//
// Problema: dentro il browser interno di Instagram (e altre WebView iOS) un link
// normale https://apps.apple.com/... NON lancia l'app App Store — resta nella
// WebView. Lo schema itms-apps:// forza iOS ad aprire direttamente l'App Store.
// Android con play.google.com funziona già, quindi non serve trattamento speciale.

export const IOS_URL =
  "https://apps.apple.com/it/app/fantapronostic/id6760613936";
export const IOS_URL_SCHEME =
  "itms-apps://apps.apple.com/it/app/fantapronostic/id6760613936";
export const ANDROID_URL =
  "https://play.google.com/store/apps/details?id=com.fantapronostic.app";

// NB: dentro il browser interno di Instagram su iPhone, Apple impedisce di
// aprire l'App Store via codice (itms-apps://, redirect, ecc.). Ogni tentativo
// JS non fa che creare "tocchi morti". Perciò NON intercettiamo il click: il
// link https nativo è la soluzione più compatibile. Questa funzione resta come
// no-op per non rompere le pagine che la richiamano.
export function openAppStore(_e?: { preventDefault: () => void }) {
  // Nessuna intercettazione: lasciamo agire il link https nativo.
}
