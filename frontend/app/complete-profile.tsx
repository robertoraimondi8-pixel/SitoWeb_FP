/**
 * CompleteProfileScreen — obbligatoria post-Google OAuth
 * Mostra i campi mancanti e i consensi
 */
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
  Image, Dimensions, Modal, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuth } from '../src/contexts/AuthContext';
import { apiCall } from '../src/api/client';
import { colors, spacing, borderRadius, shadows, typography } from '../src/theme/designSystem';

const { width } = Dimensions.get('window');

const COUNTRIES = [
  'Italia', 'Francia', 'Spagna', 'Germania', 'Portogallo',
  'Inghilterra', 'Belgio', 'Olanda', 'Svizzera', 'Austria',
  'Argentina', 'Brasile', 'Stati Uniti', 'Canada', 'Australia', 'Altro',
];

export default function CompleteProfileScreen() {
  const router = useRouter();
  const { token, updateUser } = useAuth();

  const [form, setForm] = useState({
    firstName: '', lastName: '', address: '', city: '', country: '', postalCode: '',
  });
  const [dob, setDob] = useState<Date | null>(null);
  const [showDobPicker, setShowDobPicker] = useState(false);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ [k: string]: string }>({});
  const [submitError, setSubmitError] = useState('');

  const set = (key: string) => (val: string) => setForm(p => ({ ...p, [key]: val }));

  const dobIso = (d: Date | null) => {
    if (!d) return '';
    const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const formatDob = (d: Date | null) => {
    if (!d) return '';
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const validate = () => {
    const e: { [k: string]: string } = {};
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
    if (!acceptedPrivacy) e.privacy = 'Accetta la Privacy Policy';
    if (!acceptedTerms) e.terms = 'Accetta i Termini e Condizioni';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    setSubmitError('');
    try {
      const res = await apiCall('/users/me/complete-profile', {
        method: 'POST',
        token,
        body: {
          first_name: form.firstName.trim(),
          last_name: form.lastName.trim(),
          date_of_birth: dobIso(dob),
          address: form.address.trim(),
          city: form.city.trim(),
          country: form.country,
          postal_code: form.postalCode.trim(),
          accepted_privacy: true,
          accepted_terms: true,
        },
      });
      if (updateUser) updateUser({ ...res.user, profile_completed: true });
      // Navigate to league gate
      router.replace('/');
    } catch (e: any) {
      setSubmitError(e.message || 'Errore nel salvataggio. Riprova.');
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
          <View style={s.headerSection}>
            <Image source={require('../assets/logo-full.png')} style={s.logo} resizeMode="contain" />
            <View style={s.badge}>
              <Ionicons name="shield-checkmark" size={16} color={colors.accent} />
              <Text style={s.badgeText}>Profilo incompleto</Text>
            </View>
          </View>

          <Text style={s.pageTitle}>Completa il tuo profilo</Text>
          <Text style={s.pageSubtitle}>
            Per accedere all'app è necessario completare il profilo con i dati richiesti.
            Questo passaggio è obbligatorio.
          </Text>

          {submitError ? (
            <View style={s.errorBanner}>
              <Ionicons name="alert-circle" size={18} color={colors.error} />
              <Text style={s.errorBannerText}>{submitError}</Text>
            </View>
          ) : null}

          {/* Dati personali */}
          <Text style={s.sectionLabel}>Dati personali</Text>

          <View style={s.row2}>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>Nome *</Text>
              <View style={[s.inputRow, errors.firstName && { borderColor: colors.error }]}>
                <Ionicons name="person-outline" size={18} color={colors.textSecondary} />
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
              <Text style={s.label}>Cognome *</Text>
              <View style={[s.inputRow, errors.lastName && { borderColor: colors.error }]}>
                <Ionicons name="person" size={18} color={colors.textSecondary} />
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
                <Ionicons name="location-outline" size={18} color={colors.textSecondary} />
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
                <Ionicons name="mail" size={18} color={colors.textSecondary} />
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

          {/* Consensi */}
          <Text style={s.sectionLabel}>Consensi obbligatori</Text>

          <TouchableOpacity style={s.checkboxRow} onPress={() => setAcceptedPrivacy(v => !v)}>
            <View style={[s.checkbox, acceptedPrivacy && s.checkboxChecked]}>
              {acceptedPrivacy && <Ionicons name="checkmark" size={14} color="#fff" />}
            </View>
            <Text style={s.checkboxLabel}>Accetto la <Text style={s.checkboxLink}>Privacy Policy</Text></Text>
          </TouchableOpacity>
          {errors.privacy ? <Text style={s.fieldError}>{errors.privacy}</Text> : null}

          <TouchableOpacity style={s.checkboxRow} onPress={() => setAcceptedTerms(v => !v)}>
            <View style={[s.checkbox, acceptedTerms && s.checkboxChecked]}>
              {acceptedTerms && <Ionicons name="checkmark" size={14} color="#fff" />}
            </View>
            <Text style={s.checkboxLabel}>Accetto i <Text style={s.checkboxLink}>Termini e Condizioni</Text></Text>
          </TouchableOpacity>
          {errors.terms ? <Text style={s.fieldError}>{errors.terms}</Text> : null}

          <TouchableOpacity
            style={[s.submitBtn, loading && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? <ActivityIndicator color={colors.textInverse} /> : <Text style={s.submitBtnText}>SALVA E CONTINUA</Text>}
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
  headerSection: { alignItems: 'center', marginBottom: spacing.lg, gap: spacing.sm },
  logo: { width: width * 0.45, height: 100 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: `${colors.accent}15`, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.pill },
  badgeText: { ...typography.meta, color: colors.accent, fontWeight: '700' },
  pageTitle: { ...typography.titleL, color: colors.textPrimary, marginBottom: spacing.xs },
  pageSubtitle: { ...typography.bodyS, color: colors.textSecondary, lineHeight: 20, marginBottom: spacing.lg },
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.errorLight, borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.lg },
  errorBannerText: { flex: 1, ...typography.bodyS, color: colors.error },
  sectionLabel: { ...typography.meta, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginTop: spacing.xl, marginBottom: spacing.md, fontWeight: '700' },
  row2: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  label: { ...typography.bodyS, color: colors.textSecondary, marginBottom: spacing.xs, fontWeight: '600', marginTop: spacing.sm },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: colors.border, borderRadius: borderRadius.lg, height: 52, paddingHorizontal: spacing.md, gap: spacing.sm, backgroundColor: colors.background, marginBottom: 2 },
  input: { flex: 1, fontSize: 15, color: colors.textPrimary, height: '100%' },
  fieldError: { ...typography.meta, color: colors.error, marginTop: 2, marginBottom: spacing.xs },
  confirmDobBtn: { alignSelf: 'flex-end', marginBottom: spacing.md, backgroundColor: colors.accent, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm, borderRadius: borderRadius.md },
  confirmDobText: { color: '#fff', fontWeight: '700' },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm, marginTop: spacing.sm },
  checkbox: { width: 22, height: 22, borderRadius: 5, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  checkboxChecked: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkboxLabel: { flex: 1, ...typography.bodyS, color: colors.textPrimary, lineHeight: 20 },
  checkboxLink: { color: colors.accent, fontWeight: '700' },
  submitBtn: { height: 56, borderRadius: borderRadius.lg, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginTop: spacing.xl, ...shadows.button },
  submitBtnText: { fontSize: 16, fontWeight: '800', color: colors.textInverse, letterSpacing: 1 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '60%', padding: spacing.lg },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.md },
  modalTitle: { ...typography.titleS, textAlign: 'center', marginBottom: spacing.lg },
  countryItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: spacing.md, borderBottomWidth: 1 },
});
