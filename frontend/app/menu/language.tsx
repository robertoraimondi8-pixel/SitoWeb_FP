import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { setAppLanguage, SUPPORTED_LANGS } from '../../src/i18n';
import type { SupportedLang } from '../../src/i18n';
import { useTranslation } from 'react-i18next';
import { colors, typography, spacing, borderRadius, shadows } from '../../src/theme/designSystem';

const LANG_LABELS: Record<string, { label: string; flag: string }> = {
  it: { label: 'Italiano', flag: '\u{1F1EE}\u{1F1F9}' },
  en: { label: 'English', flag: '\u{1F1EC}\u{1F1E7}' },
  es: { label: 'Espanol', flag: '\u{1F1EA}\u{1F1F8}' },
};

export default function LanguageScreen() {
  const router = useRouter();
  const { i18n } = useTranslation();
  const currentLang = i18n.language;

  const handleSelect = async (lang: SupportedLang) => {
    await setAppLanguage(lang);
    router.back();
  };

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} data-testid="back-btn">
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Lingua</Text>
        <View style={{ width: 24 }} />
      </View>
      <View style={s.content}>
        {SUPPORTED_LANGS.map((lang) => {
          const info = LANG_LABELS[lang] || { label: lang, flag: '' };
          const isActive = currentLang === lang;
          return (
            <TouchableOpacity
              key={lang}
              style={[s.langItem, isActive && s.langItemActive]}
              onPress={() => handleSelect(lang)}
              data-testid={`lang-${lang}`}
            >
              <Text style={s.flag}>{info.flag}</Text>
              <Text style={[s.langText, isActive && s.langTextActive]}>{info.label}</Text>
              {isActive && <Ionicons name="checkmark-circle" size={22} color={colors.accent} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, backgroundColor: '#F3F4F6' },
  headerTitle: { ...typography.titleM, color: colors.textPrimary },
  content: { padding: spacing.lg, gap: 8 },
  langItem: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.card, borderRadius: borderRadius.xl, padding: spacing.lg, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 20, elevation: 4 },
  langItemActive: { borderWidth: 2, borderColor: colors.accent },
  flag: { fontSize: 24 },
  langText: { flex: 1, fontSize: 16, fontWeight: '500', color: colors.textPrimary },
  langTextActive: { fontWeight: '700', color: colors.accent },
});
