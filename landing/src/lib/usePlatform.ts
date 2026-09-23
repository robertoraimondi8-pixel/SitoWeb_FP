import { useEffect, useState } from "react";
import { ANDROID_URL, IOS_URL } from "@/lib/storeLinks";

export type Platform = "ios" | "android" | "other";

/**
 * Sistema operativo del visitatore, per mandarlo allo store giusto.
 *
 * Su desktop resta "other": la piattaforma non e' deducibile, quindi la pagina
 * deve mostrare entrambi i link invece di indovinare e sbagliare per meta' del
 * pubblico.
 *
 * Parte da "other" anche al primo render perche' il calcolo avviene in effect:
 * cosi' il markup iniziale e' sempre quello completo.
 */
export function usePlatform(): Platform {
  const [platform, setPlatform] = useState<Platform>("other");

  useEffect(() => {
    const ua = navigator.userAgent || "";
    if (/iPhone|iPad|iPod/i.test(ua)) setPlatform("ios");
    else if (/Android/i.test(ua)) setPlatform("android");
  }, []);

  return platform;
}

/** Link allo store corrispondente. Su desktop torna quello iOS come ripiego. */
export function storeUrlFor(platform: Platform): string {
  return platform === "android" ? ANDROID_URL : IOS_URL;
}
