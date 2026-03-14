/**
 * Complete Profile Screen - After Google OAuth or initial registration
 * Redesigned to match the FantaPronostic brand: dark theme with gradient
 */
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Platform, Modal, FlatList,
  KeyboardAvoidingView, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuth } from '../src/contexts/AuthContext';
import { apiCall } from '../src/api/client';
import { useTranslation } from 'react-i18next';
import { colors, typography, spacing, borderRadius, brandGradients, shadows } from '../src/theme/designSystem';
import { BrandLogo } from '../src/components/BrandLogo';

const { width } = Dimensions.get('window');
const COUNTRIES = ['Italia', 'Svizzera', 'Germania', 'Francia', 'Spagna', 'Regno Unito', 'Altro'];

type FormState = {
  firstName: string; lastName: string; username: string;
  address: string; city: string; country: string; postalCode: string;
};

export default function CompleteProfileScreen() {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const { t } = useTranslation();

  const [form, setForm] = useState<FormState>({
    firstName: '', lastName: '', username: '',
    address: '', city: '', country: 'Italia', postalCode: '',
  });
  const set = (key: keyof FormState) => (val: string) => setForm(p => ({ ...p, [key]: val }));

  const [dob, setDob] = useState<Date | null>(null);
  const [showDobPicker, setShowDobPicker] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');

  const formatDob = (d: Date) => `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;

  const handleSubmit = async () => {
    const e: Record<string, string> = {};
    if (!form.firstName.trim()) e.firstName = t('complete_profile.err_first_name');
    if (!form.lastName.trim()) e.lastName = t('complete_profile.err_last_name');
    if (form.username.trim() && !/^[a-zA-Z0-9_]{3,20}$/.test(form.username.trim())) e.username = t('complete_profile.username_validation');
    if (!dob) e.dob = t('complete_profile.err_dob');
    if (!form.address.trim()) e.address = t('complete_profile.err_address');
    if (!form.city.trim()) e.city = t('complete_profile.err_city');
    if (!form.postalCode.trim()) e.postalCode = t('complete_profile.err_cap');
    if (!form.country) e.country = t('complete_profile.err_country');
    if (!acceptedPrivacy) e.privacy = t('complete_profile.err_privacy');
    if (!acceptedTerms) e.terms = t('complete_profile.err_terms');
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    setLoading(true);
    setSubmitError('');
    try {
      const payload: any = {
        first_name: form.firstName.trim(),
        last_name: form.lastName.trim(),
        date_of_birth: dob ? `${dob.getFullYear()}-${(dob.getMonth() + 1).toString().padStart(2, '0')}-${dob.getDate().toString().padStart(2, '0')}` : null,
        address: form.address.trim(),
        city: form.city.trim(),
        country: form.country,
        postal_code: form.postalCode.trim(),
        accepted_privacy: true,
        accepted_terms: true,
      };
      if (form.username.trim()) payload.username = form.username.trim();
      const res = await apiCall('/users/me/complete-profile', { method: 'POST', body: payload });
      await refreshUser();
      router.replace('/(tabs)/home');
    } catch (e: unknown) {
      const err = e as any;
      setSubmitError(err?.message || t('complete_profile.save_error'));
    } finally {
      setLoading(false);
    }
  };

  const maxDob = new Date();
  maxDob.setFullYear(maxDob.getFullYear() - 18);

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      <LinearGradient colors={brandGradients.background} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Header */}
          <View style={s.headerSection}>
            <BrandLogo variant="wordmark" size="lg" />
            <View style={s.badge}>
              <Ionicons name="shield-checkmark" size={16} color={colors.accent} />
              <Text style={s.badgeText}>{t('complete_profile.badge_incomplete')}</Text>
            </View>
          </View>

          <Text style={s.pageTitle}>{t('complete_profile.title')}</Text>
          <Text style={s.pageSubtitle}>
            {t('complete_profile.subtitle')}
          </Text>

          {submitError ? (
            <View style={s.errorBanner}>
              <Ionicons name="alert-circle" size={18} color={colors.error} />
              <Text style={s.errorBannerText}>{submitError}</Text>
            </View>
          ) : null}

          {/* Card con form */}
          <View style={s.formCard}>

            {/* Username */}
            <Text style={s.sectionLabel}>{t('complete_profile.section_username')}</Text>
            <Text style={s.label}>{t('username')}</Text>
            <View style={[s.inputRow, errors.username && { borderColor: colors.error }]}>
              <Ionicons name="at-outline" size={18} color={colors.textSecondary} />
              <TextInput
                style={s.input}
                placeholder="es. mario_rossi"
                placeholderTextColor={colors.textMuted}
                value={form.username}
                onChangeText={v => { set('username')(v); setErrors(p => ({ ...p, username: '' })); }}
                autoCapitalize="none"
                data-testid="username-input"
              />
            </View>
            {errors.username ? <Text style={s.fieldError}>{errors.username}</Text> : null}
            <Text style={s.hint}>{t('complete_profile.username_hint')}</Text>

            <Text style={s.sectionLabel}>{t('complete_profile.section_personal')}</Text>

            <View style={s.row2}>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>{t('complete_profile.name_label')}</Text>
                <View style={[s.inputRow, errors.firstName && { borderColor: colors.error }]}>
                  <TextInput
                    style={s.input}
                    placeholder="Mario"
                    placeholderTextColor={colors.textMuted}
                    value={form.firstName}
                    onChangeText={v => { set('firstName')(v); setErrors(p => ({ ...p, firstName: '' })); }}
                  />
                </View>
                {errors.firstName ? <Text style={s.fieldError}>{errors.firstName}</Text> : null}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>{t('complete_profile.surname_label')}</Text>
                <View style={[s.inputRow, errors.lastName && { borderColor: colors.error }]}>
                  <TextInput
                    style={s.input}
                    placeholder="Bianchi"
                    placeholderTextColor={colors.textMuted}
                    value={form.lastName}
                    onChangeText={v => { set('lastName')(v); setErrors(p => ({ ...p, lastName: '' })); }}
                  />
                </View>
                {errors.lastName ? <Text style={s.fieldError}>{errors.lastName}</Text> : null}
              </View>
            </View>

            <Text style={s.label}>Data di nascita *</Text>
            <TouchableOpacity
              style={[s.inputRow, { justifyContent: 'space-between' }, errors.dob && { borderColor: colors.error }]}
              onPress={() => setShowDobPicker(true)}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
                <Text style={{ color: dob ? colors.textPrimary : colors.textMuted, fontSize: 15 }}>
                  {dob ? formatDob(dob) : 'GG/MM/AAAA'}
                </Text>
              </View>
              <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
            {errors.dob ? <Text style={s.fieldError}>{errors.dob}</Text> : null}

            {showDobPicker && (
              <DateTimePicker
                value={dob || maxDob}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
                maximumDate={maxDob}
                minimumDate={new Date(1920, 0, 1)}
                onChange={(_, d) => {
                  setShowDobPicker(Platform.OS === 'ios');
                  if (d) { setDob(d); setErrors(p => ({ ...p, dob: '' })); }
                }}
              />
            )}
            {Platform.OS === 'ios' && showDobPicker && (
              <TouchableOpacity style={s.confirmDobBtn} onPress={() => setShowDobPicker(false)}>
                <Text style={s.confirmDobText}>Conferma</Text>
              </TouchableOpacity>
            )}

            {/* Indirizzo */}
            <Text style={s.sectionLabel}>Indirizzo</Text>

            <Text style={s.label}>Via / Indirizzo *</Text>
            <View style={[s.inputRow, errors.address && { borderColor: colors.error }]}>
              <Ionicons name="home-outline" size={18} color={colors.textSecondary} />
              <TextInput
                style={s.input}
                placeholder="Via Roma 1"
                placeholderTextColor={colors.textMuted}
                value={form.address}
                onChangeText={v => { set('address')(v); setErrors(p => ({ ...p, address: '' })); }}
              />
            </View>
            {errors.address ? <Text style={s.fieldError}>{errors.address}</Text> : null}

            <View style={s.row2}>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Città *</Text>
                <View style={[s.inputRow, errors.city && { borderColor: colors.error }]}>
                  <TextInput
                    style={s.input}
                    placeholder="Milano"
                    placeholderTextColor={colors.textMuted}
                    value={form.city}
                    onChangeText={v => { set('city')(v); setErrors(p => ({ ...p, city: '' })); }}
                  />
                </View>
                {errors.city ? <Text style={s.fieldError}>{errors.city}</Text> : null}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>CAP *</Text>
                <View style={[s.inputRow, errors.postalCode && { borderColor: colors.error }]}>
                  <TextInput
                    style={s.input}
                    placeholder="20121"
                    placeholderTextColor={colors.textMuted}
                    value={form.postalCode}
                    onChangeText={v => { set('postalCode')(v); setErrors(p => ({ ...p, postalCode: '' })); }}
                  />
                </View>
                {errors.postalCode ? <Text style={s.fieldError}>{errors.postalCode}</Text> : null}
              </View>
            </View>

            <Text style={s.label}>Paese *</Text>
            <TouchableOpacity
              style={[s.inputRow, { justifyContent: 'space-between' }, errors.country && { borderColor: colors.error }]}
              onPress={() => setShowCountryPicker(true)}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Ionicons name="globe-outline" size={18} color={colors.textSecondary} />
                <Text style={{ color: form.country ? colors.textPrimary : colors.textMuted, fontSize: 15 }}>
                  {form.country || 'Seleziona paese'}
                </Text>
              </View>
              <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
            {errors.country ? <Text style={s.fieldError}>{errors.country}</Text> : null}

          </View>

          {/* Consensi */}
          <Text style={[s.sectionLabel, { marginTop: spacing.xl }]}>Consensi obbligatori</Text>

          <TouchableOpacity style={s.checkboxRow} onPress={() => setAcceptedPrivacy(v => !v)} data-testid="privacy-checkbox">
            <View style={[s.checkbox, acceptedPrivacy && s.checkboxChecked]}>
              {acceptedPrivacy && <Ionicons name="checkmark" size={14} color="#fff" />}
            </View>
            <Text style={s.checkboxLabel}>Accetto la <Text style={s.checkboxLink} onPress={() => router.push('/privacy-policy')}>Privacy Policy</Text></Text>
          </TouchableOpacity>
          {errors.privacy ? <Text style={s.fieldError}>{errors.privacy}</Text> : null}

          <TouchableOpacity style={s.checkboxRow} onPress={() => setAcceptedTerms(v => !v)} data-testid="terms-checkbox">
            <View style={[s.checkbox, acceptedTerms && s.checkboxChecked]}>
              {acceptedTerms && <Ionicons name="checkmark" size={14} color="#fff" />}
            </View>
            <Text style={s.checkboxLabel}>Accetto i <Text style={s.checkboxLink} onPress={() => router.push('/menu/terms')}>Termini e Condizioni</Text></Text>
          </TouchableOpacity>
          {errors.terms ? <Text style={s.fieldError}>{errors.terms}</Text> : null}

          <TouchableOpacity
            style={[s.submitBtn, loading && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.85}
            data-testid="complete-profile-submit"
          >
            <LinearGradient
              colors={brandGradients.accent}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.submitGradient}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.submitBtnText}>SALVA E CONTINUA</Text>}
            </LinearGradient>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Country Picker Modal */}
      <Modal visible={showCountryPicker} transparent animationType="slide">
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setShowCountryPicker(false)}>
          <View style={[s.modalSheet, { backgroundColor: colors.card }]}>
            <View style={s.modalHandle} />
            <Text style={[s.modalTitle, { color: colors.textPrimary }]}>Seleziona Paese</Text>
            <FlatList
              data={COUNTRIES}
              keyExtractor={item => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[s.countryItem, { borderBottomColor: colors.borderLight }, form.country === item && { backgroundColor: `${colors.accent}15` }]}
                  onPress={() => { setForm(p => ({ ...p, country: item })); setShowCountryPicker(false); setErrors(p => ({ ...p, country: '' })); }}
                >
                  <Text style={{ ...typography.bodyM, color: colors.textPrimary }}>{item}</Text>
                  {form.country === item && <Ionicons name="checkmark-circle" size={18} color={colors.accent} />}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  headerSection: { alignItems: 'center', marginBottom: spacing.lg, marginTop: spacing.md, gap: spacing.md },
  badge: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: `${colors.accent}20`, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.pill },
  badgeText: { ...typography.meta, color: colors.accent, fontWeight: '700' },
  pageTitle: { ...typography.titleL, color: colors.textPrimary, marginBottom: spacing.xs, textAlign: 'center' },
  pageSubtitle: { ...typography.bodyS, color: colors.textSecondary, lineHeight: 20, marginBottom: spacing.lg, textAlign: 'center' },
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.errorLight, borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.lg },
  errorBannerText: { flex: 1, ...typography.bodyS, color: colors.error },
  formCard: { backgroundColor: colors.card, borderRadius: borderRadius.xl, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  sectionLabel: { ...typography.meta, color: colors.accent, textTransform: 'uppercase', letterSpacing: 1.2, marginTop: spacing.lg, marginBottom: spacing.sm, fontWeight: '700' },
  row2: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xs },
  label: { ...typography.bodyS, color: colors.textSecondary, marginBottom: spacing.xs, fontWeight: '600', marginTop: spacing.sm },
  hint: { ...typography.meta, color: colors.textMuted, marginTop: 2, marginBottom: spacing.sm },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: colors.border, borderRadius: borderRadius.lg, height: 50, paddingHorizontal: spacing.md, gap: spacing.sm, backgroundColor: colors.background, marginBottom: 2 },
  input: { flex: 1, fontSize: 15, color: colors.textPrimary, height: '100%' },
  fieldError: { ...typography.meta, color: colors.error, marginTop: 2, marginBottom: spacing.xs },
  confirmDobBtn: { alignSelf: 'flex-end', marginBottom: spacing.md, backgroundColor: colors.accent, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm, borderRadius: borderRadius.md },
  confirmDobText: { color: '#fff', fontWeight: '700' },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm, marginTop: spacing.sm },
  checkbox: { width: 22, height: 22, borderRadius: 5, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  checkboxChecked: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkboxLabel: { flex: 1, ...typography.bodyS, color: colors.textPrimary, lineHeight: 20 },
  checkboxLink: { color: colors.accent, fontWeight: '700' },
  submitBtn: { height: 56, borderRadius: borderRadius.lg, overflow: 'hidden', marginTop: spacing.xl },
  submitGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  submitBtnText: { fontSize: 16, fontWeight: '800', color: '#fff', letterSpacing: 1 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '60%', padding: spacing.lg },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.md },
  modalTitle: { ...typography.titleS, textAlign: 'center', marginBottom: spacing.lg },
  countryItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: spacing.md, borderBottomWidth: 1 },
});
