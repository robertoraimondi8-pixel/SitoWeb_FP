/**
 * RegisterScreen — Registrazione completa
 * Campi: Email, Nome, Cognome, DOB, Indirizzo, Città, Paese, CAP, Password, Ripeti PW
 * Checkbox: Privacy Policy + Termini e Condizioni
 */
import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
  Image, Dimensions, Modal, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuth } from '../../src/contexts/AuthContext';
import { colors, spacing, borderRadius, shadows, typography } from '../../src/theme/designSystem';

const { width } = Dimensions.get('window');

const COUNTRIES = [
  'Italia', 'Francia', 'Spagna', 'Germania', 'Portogallo',
  'Inghilterra', 'Belgio', 'Olanda', 'Svizzera', 'Austria',
  'Argentina', 'Brasile', 'Stati Uniti', 'Canada', 'Australia',
  'Altro',
];

interface FieldError { [key: string]: string; }

export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useAuth();

  const [form, setForm] = useState({
    email: '', username: '', firstName: '', lastName: '',
    address: '', city: '', country: '', postalCode: '',
    password: '', confirmPassword: '',
  });
  const [dob, setDob] = useState<Date | null>(null);
  const [showDobPicker, setShowDobPicker] = useState(false);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [errors, setErrors] = useState<FieldError>({});
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [usernameChecking, setUsernameChecking] = useState(false);
  const usernameDebounce = React.useRef<any>(null);

  const set = (key: string) => (val: string) => setForm(p => ({ ...p, [key]: val }));

  const formatDob = (d: Date | null) => {
    if (!d) return '';
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const dobIso = (d: Date | null) => {
    if (!d) return '';
    const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const validate = () => {
    const e: FieldError = {};
    if (!form.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = 'Email non valida';
    if (!form.firstName.trim()) e.firstName = 'Nome obbligatorio';
    if (!form.lastName.trim()) e.lastName = 'Cognome obbligatorio';
    if (!dob) {
      e.dob = 'Data di nascita obbligatoria';
    } else {
      const today = new Date();
      const age = today.getFullYear() - dob.getFullYear() - ((today.getMonth() * 100 + today.getDate()) < (dob.getMonth() * 100 + dob.getDate()) ? 1 : 0);
      if (age < 18) e.dob = 'Devi avere almeno 18 anni';
    }
    if (!form.address.trim()) e.address = 'Indirizzo obbligatorio';
    if (!form.city.trim()) e.city = 'Città obbligatoria';
    if (!form.country) e.country = 'Paese obbligatorio';
    if (!form.postalCode.trim()) e.postalCode = 'CAP obbligatorio';
    if (!form.password || form.password.length < 8) e.password = 'Min. 8 caratteri';
    else if (!/[A-Z]/.test(form.password)) e.password = 'Almeno una lettera maiuscola';
    else if (!/[0-9]/.test(form.password)) e.password = 'Almeno un numero';
    if (form.password !== form.confirmPassword) e.confirmPassword = 'Le password non coincidono';
    if (!acceptedPrivacy) e.privacy = 'Accetta la Privacy Policy per continuare';
    if (!acceptedTerms) e.terms = 'Accetta i Termini e Condizioni per continuare';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const canSubmit = acceptedPrivacy && acceptedTerms;

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    setSubmitError('');
    try {
      await register({
        email: form.email.trim().toLowerCase(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        dateOfBirth: dobIso(dob),
        address: form.address.trim(),
        city: form.city.trim(),
        country: form.country,
        postalCode: form.postalCode.trim(),
        password: form.password,
        acceptedPrivacy: true,
        acceptedTerms: true,
      });
      router.replace('/onboarding');
    } catch (e: any) {
      setSubmitError(e.message || 'Registrazione fallita. Riprova.');
    } finally {
      setLoading(false);
    }
  };

  const maxDob = new Date();
  maxDob.setFullYear(maxDob.getFullYear() - 18);

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Header */}
          <View style={s.header}>
            <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
            <Image source={require('../../assets/logo-full.png')} style={s.logo} resizeMode="contain" />
            <View style={{ width: 24 }} />
          </View>

          <Text style={s.pageTitle}>Crea il tuo account</Text>
          <Text style={s.pageSubtitle}>Completa tutti i campi per registrarti</Text>

          {submitError ? (
            <View style={s.errorBanner}>
              <Ionicons name="alert-circle" size={18} color={colors.error} />
              <Text style={s.errorBannerText}>{submitError}</Text>
            </View>
          ) : null}

          {/* ── DATI PERSONALI ── */}
          <Text style={s.sectionLabel}>Dati personali</Text>

          <Field label="Email *" error={errors.email}>
            <Row icon="mail-outline">
              <TextInput
                style={s.input}
                placeholder="nome@esempio.it"
                placeholderTextColor={colors.textMuted}
                value={form.email}
                onChangeText={v => { set('email')(v); setErrors(p => ({ ...p, email: '' })); }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </Row>
          </Field>

          <View style={s.row2}>
            <View style={{ flex: 1 }}>
              <Field label="Nome *" error={errors.firstName}>
                <Row icon="person-outline">
                  <TextInput
                    style={s.input}
                    placeholder="Marco"
                    placeholderTextColor={colors.textMuted}
                    value={form.firstName}
                    onChangeText={v => { set('firstName')(v); setErrors(p => ({ ...p, firstName: '' })); }}
                  />
                </Row>
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Cognome *" error={errors.lastName}>
                <Row icon="person">
                  <TextInput
                    style={s.input}
                    placeholder="Rossi"
                    placeholderTextColor={colors.textMuted}
                    value={form.lastName}
                    onChangeText={v => { set('lastName')(v); setErrors(p => ({ ...p, lastName: '' })); }}
                  />
                </Row>
              </Field>
            </View>
          </View>

          <Field label="Data di nascita *" error={errors.dob}>
            <TouchableOpacity
              style={[s.inputRow, { justifyContent: 'space-between' }, errors.dob && { borderColor: colors.error }]}
              onPress={() => setShowDobPicker(true)}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <Ionicons name="calendar-outline" size={20} color={colors.textSecondary} />
                <Text style={[s.input, { color: dob ? colors.textPrimary : colors.textMuted }]}>
                  {dob ? formatDob(dob) : 'GG/MM/AAAA'}
                </Text>
              </View>
              <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </Field>

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

          {/* ── INDIRIZZO ── */}
          <Text style={s.sectionLabel}>Indirizzo</Text>

          <Field label="Indirizzo *" error={errors.address}>
            <Row icon="home-outline">
              <TextInput
                style={s.input}
                placeholder="Via Roma 1"
                placeholderTextColor={colors.textMuted}
                value={form.address}
                onChangeText={v => { set('address')(v); setErrors(p => ({ ...p, address: '' })); }}
              />
            </Row>
          </Field>

          <View style={s.row2}>
            <View style={{ flex: 1 }}>
              <Field label="Città *" error={errors.city}>
                <Row icon="location-outline">
                  <TextInput
                    style={s.input}
                    placeholder="Milano"
                    placeholderTextColor={colors.textMuted}
                    value={form.city}
                    onChangeText={v => { set('city')(v); setErrors(p => ({ ...p, city: '' })); }}
                  />
                </Row>
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="CAP *" error={errors.postalCode}>
                <Row icon="mail">
                  <TextInput
                    style={s.input}
                    placeholder="20121"
                    placeholderTextColor={colors.textMuted}
                    value={form.postalCode}
                    onChangeText={v => { set('postalCode')(v.replace(/[^0-9A-Za-z-]/g, '')); setErrors(p => ({ ...p, postalCode: '' })); }}
                    keyboardType="default"
                  />
                </Row>
              </Field>
            </View>
          </View>

          <Field label="Paese *" error={errors.country}>
            <TouchableOpacity
              style={[s.inputRow, { justifyContent: 'space-between' }, errors.country && { borderColor: colors.error }]}
              onPress={() => setShowCountryPicker(true)}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <Ionicons name="globe-outline" size={20} color={colors.textSecondary} />
                <Text style={[s.input, { color: form.country ? colors.textPrimary : colors.textMuted }]}>
                  {form.country || 'Seleziona paese'}
                </Text>
              </View>
              <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </Field>

          {/* ── PASSWORD ── */}
          <Text style={s.sectionLabel}>Sicurezza</Text>

          <Field label="Password *" error={errors.password}>
            <Row icon="lock-closed-outline">
              <TextInput
                style={s.input}
                placeholder="Min. 8 car., 1 maiusc., 1 numero"
                placeholderTextColor={colors.textMuted}
                value={form.password}
                onChangeText={v => { set('password')(v); setErrors(p => ({ ...p, password: '' })); }}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(v => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </Row>
          </Field>

          <Field label="Ripeti password *" error={errors.confirmPassword}>
            <Row icon="lock-closed">
              <TextInput
                style={s.input}
                placeholder="Ripeti la password"
                placeholderTextColor={colors.textMuted}
                value={form.confirmPassword}
                onChangeText={v => { set('confirmPassword')(v); setErrors(p => ({ ...p, confirmPassword: '' })); }}
                secureTextEntry={!showConfirmPassword}
              />
              <TouchableOpacity onPress={() => setShowConfirmPassword(v => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </Row>
          </Field>

          {/* ── CONSENSI ── */}
          <Text style={s.sectionLabel}>Consensi obbligatori</Text>

          <TouchableOpacity style={s.checkboxRow} onPress={() => setAcceptedPrivacy(v => !v)} activeOpacity={0.7}>
            <View style={[s.checkbox, acceptedPrivacy && s.checkboxChecked]}>
              {acceptedPrivacy && <Ionicons name="checkmark" size={14} color="#fff" />}
            </View>
            <Text style={s.checkboxLabel}>
              Accetto la{' '}<Text style={s.checkboxLink}>Privacy Policy</Text>
            </Text>
          </TouchableOpacity>
          {errors.privacy ? <Text style={s.fieldError}>{errors.privacy}</Text> : null}

          <TouchableOpacity style={s.checkboxRow} onPress={() => setAcceptedTerms(v => !v)} activeOpacity={0.7}>
            <View style={[s.checkbox, acceptedTerms && s.checkboxChecked]}>
              {acceptedTerms && <Ionicons name="checkmark" size={14} color="#fff" />}
            </View>
            <Text style={s.checkboxLabel}>
              Accetto i{' '}<Text style={s.checkboxLink}>Termini e Condizioni</Text>
            </Text>
          </TouchableOpacity>
          {errors.terms ? <Text style={s.fieldError}>{errors.terms}</Text> : null}

          {/* ── SUBMIT ── */}
          <TouchableOpacity
            style={[s.submitBtn, (!canSubmit || loading) && { opacity: 0.5 }]}
            onPress={handleSubmit}
            disabled={!canSubmit || loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={colors.textInverse} />
            ) : (
              <Text style={s.submitBtnText}>CREA ACCOUNT</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.back()} style={s.loginLink}>
            <Text style={s.loginLinkText}>Hai già un account? <Text style={s.loginLinkAccent}>Accedi</Text></Text>
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
                  <Text style={[s.countryText, { color: colors.textPrimary }]}>{item}</Text>
                  {form.country === item && <Ionicons name="checkmark-circle" size={20} color={colors.accent} />}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <View style={s.fieldWrap}>
      <Text style={s.label}>{label}</Text>
      {children}
      {error ? <Text style={s.fieldError}>{error}</Text> : null}
    </View>
  );
}

function Row({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <View style={s.inputRow}>
      <Ionicons name={icon as any} size={20} color={colors.textSecondary} />
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  logo: { width: width * 0.38, height: 72 },
  pageTitle: { ...typography.titleL, color: colors.textPrimary, marginBottom: spacing.xs },
  pageSubtitle: { ...typography.bodyS, color: colors.textSecondary, marginBottom: spacing.xl },
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.errorLight, borderRadius: borderRadius.md,
    padding: spacing.md, marginBottom: spacing.lg,
  },
  errorBannerText: { flex: 1, ...typography.bodyS, color: colors.error },
  sectionLabel: {
    ...typography.meta, color: colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 1,
    marginTop: spacing.xl, marginBottom: spacing.md,
    fontWeight: '700',
  },
  row2: { flexDirection: 'row', gap: spacing.md },
  fieldWrap: { marginBottom: spacing.md },
  label: { ...typography.bodyS, color: colors.textSecondary, marginBottom: spacing.xs, fontWeight: '600' },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: colors.border,
    borderRadius: borderRadius.lg, height: 52,
    paddingHorizontal: spacing.md, gap: spacing.sm,
    backgroundColor: colors.background,
  },
  input: { flex: 1, fontSize: 15, color: colors.textPrimary, height: '100%' },
  fieldError: { ...typography.meta, color: colors.error, marginTop: 3 },
  confirmDobBtn: {
    alignSelf: 'flex-end', marginBottom: spacing.md,
    backgroundColor: colors.accent, paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm, borderRadius: borderRadius.md,
  },
  confirmDobText: { color: '#fff', fontWeight: '700' },
  checkboxRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: spacing.md, marginBottom: spacing.sm,
  },
  checkbox: {
    width: 22, height: 22, borderRadius: 5,
    borderWidth: 2, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.background,
  },
  checkboxChecked: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkboxLabel: { flex: 1, ...typography.bodyS, color: colors.textPrimary, lineHeight: 20 },
  checkboxLink: { color: colors.accent, fontWeight: '700' },
  submitBtn: {
    height: 56, borderRadius: borderRadius.lg,
    backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
    marginTop: spacing.xl, ...shadows.button,
  },
  submitBtnText: { fontSize: 16, fontWeight: '800', color: colors.textInverse, letterSpacing: 1 },
  loginLink: { alignItems: 'center', paddingVertical: spacing.lg },
  loginLinkText: { ...typography.bodyM, color: colors.textSecondary },
  loginLinkAccent: { color: colors.accent, fontWeight: '700' },
  // Country Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '60%', padding: spacing.lg },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.md },
  modalTitle: { ...typography.titleS, textAlign: 'center', marginBottom: spacing.lg },
  countryItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, paddingHorizontal: spacing.md, borderBottomWidth: 1,
  },
  countryText: { ...typography.bodyM },
});
