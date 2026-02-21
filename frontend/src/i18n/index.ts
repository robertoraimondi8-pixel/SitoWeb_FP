import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { Platform } from 'react-native';

import it from './locales/it/common.json';
import en from './locales/en/common.json';
import es from './locales/es/common.json';

const STORAGE_KEY = 'APP_LANGUAGE';
const SUPPORTED_LANGS = ['it', 'en', 'es'] as const;
export type SupportedLang = (typeof SUPPORTED_LANGS)[number];

function getDeviceLanguage(): SupportedLang {
  try {
    const { getLocales } = require('expo-localization');
    const locale = getLocales()[0]?.languageCode ?? 'en';
    if ((SUPPORTED_LANGS as readonly string[]).includes(locale)) return locale as SupportedLang;
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

// Restore saved language on startup (deferred to avoid SSR crash)
async function restoreLanguage() {
  try {
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    if (saved && (SUPPORTED_LANGS as readonly string[]).includes(saved)) {
      await i18n.changeLanguage(saved);
    } else {
      await i18n.changeLanguage(getDeviceLanguage());
    }
  } catch {
    i18n.changeLanguage(getDeviceLanguage());
  }
}

if (Platform.OS !== 'web' || typeof window !== 'undefined') {
  restoreLanguage();
}

export async function setAppLanguage(lang: SupportedLang): Promise<void> {
  try {
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    await AsyncStorage.setItem(STORAGE_KEY, lang);
  } catch { /* SSR */ }
  await i18n.changeLanguage(lang);
}

export { SUPPORTED_LANGS };
export default i18n;
