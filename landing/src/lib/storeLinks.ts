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

function isIOS(): boolean {
  const ua = navigator.userAgent || "";
  return /iPhone|iPad|iPod/i.test(ua);
}

// Da usare come onClick del pulsante App Store. Su iOS prova ad aprire l'app
// App Store con lo schema itms-apps://; se viene bloccato (es. WebView di
// Instagram) dopo un attimo carica comunque la pagina https dell'App Store,
// così il tocco non resta mai "morto". Su desktop/Android lascia il link nativo.
export function openAppStore(e?: { preventDefault: () => void }) {
  try {
    if (!isIOS()) return;
    e?.preventDefault();
    // Tentativo 1: apri direttamente l'app App Store.
    window.location.href = IOS_URL_SCHEME;
    // Tentativo 2 (fallback): se dopo ~1.2s siamo ancora qui, lo schema è stato
    // bloccato → carica la pagina App Store, da cui si può comunque installare.
    window.setTimeout(() => {
      window.location.href = IOS_URL;
    }, 1200);
  } catch {
    // In caso di errore lasciamo il comportamento nativo del link https.
  }
}
