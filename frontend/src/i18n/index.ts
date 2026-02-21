import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';

import it from './locales/it/common.json';
import en from './locales/en/common.json';
import es from './locales/es/common.json';

const STORAGE_KEY = 'APP_LANGUAGE';
const SUPPORTED_LANGS = ['it', 'en', 'es'] as const;
export type SupportedLang = (typeof SUPPORTED_LANGS)[number];

function getDeviceLanguage(): SupportedLang {
  try {
    const locale = getLocales()[0]?.languageCode ?? 'en';
    if (SUPPORTED_LANGS.includes(locale as SupportedLang)) return locale as SupportedLang;
  } catch { /* ignore */ }
  return 'en';
}

i18n.use(initReactI18next).init({
  resources: {
    it: { translation: it },
    en: { translation: en },
    es: { translation: es },
  },
  lng: 'it',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

// Restore saved language on startup (safe for SSR)
if (typeof window !== 'undefined') {
  AsyncStorage.getItem(STORAGE_KEY)
    .then((saved) => {
      if (saved && SUPPORTED_LANGS.includes(saved as SupportedLang)) {
        i18n.changeLanguage(saved);
      } else {
        const deviceLang = getDeviceLanguage();
        i18n.changeLanguage(deviceLang);
      }
    })
    .catch(() => {
      i18n.changeLanguage(getDeviceLanguage());
    });
}

export async function setAppLanguage(lang: SupportedLang): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, lang);
  await i18n.changeLanguage(lang);
}

export { SUPPORTED_LANGS };
export default i18n;
