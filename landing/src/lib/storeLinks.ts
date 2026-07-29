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

// Da usare come onClick del pulsante App Store. Su iOS forza l'apertura dell'app
// store tramite itms-apps://, così funziona anche nella WebView di Instagram.
export function openAppStore(e?: { preventDefault: () => void }) {
  try {
    if (isIOS()) {
      e?.preventDefault();
      window.location.href = IOS_URL_SCHEME;
    }
  } catch {
    // Se qualcosa va storto lasciamo il comportamento nativo del link https.
  }
}
