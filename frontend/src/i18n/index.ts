import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import it from './locales/it/common.json';
import en from './locales/en/common.json';
import es from './locales/es/common.json';

const STORAGE_KEY = 'APP_LANGUAGE';
const SUPPORTED_LANGS = ['it', 'en', 'es'] as const;
export type SupportedLang = (typeof SUPPORTED_LANGS)[number];

function isSupportedLang(lang: string): lang is SupportedLang {
  return (SUPPORTED_LANGS as readonly string[]).includes(lang);
}

function getDeviceLanguage(): SupportedLang {
  try {
    // Try browser language first (web)
    if (typeof navigator !== 'undefined' && navigator.language) {
      const browserLang = navigator.language.split('-')[0];
      if (isSupportedLang(browserLang)) return browserLang;
    }
    // Then expo-localization (native)
    const { getLocales } = require('expo-localization');
    const locale = getLocales()[0]?.languageCode ?? 'it';
    if (isSupportedLang(locale)) return locale;
  } catch { /* SSR or unavailable */ }
  return 'it';
}

// Platform-safe storage: localStorage on web, AsyncStorage on native (lazy loaded)
function getSavedLang(): string | null {
  try {
    if (typeof localStorage !== 'undefined') return localStorage.getItem(STORAGE_KEY);
  } catch { /* SSR */ }
  return null;
}

function saveLang(lang: string): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, lang);
  } catch { /* SSR */ }
}

// Determine initial language
const savedLang = getSavedLang();
const initialLang: SupportedLang = savedLang && isSupportedLang(savedLang) 
  ? savedLang 
  : getDeviceLanguage();

i18n.use(initReactI18next).init({
  resources: {
    it: { translation: it },
    en: { translation: en },
    es: { translation: es },
  },
  lng: initialLang,
  fallbackLng: 'it',
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

export async function setAppLanguage(lang: SupportedLang): Promise<void> {
  saveLang(lang);
  await i18n.changeLanguage(lang);
}

export { SUPPORTED_LANGS };
export default i18n;
