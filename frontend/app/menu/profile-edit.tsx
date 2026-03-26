import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../src/contexts/AuthContext';
import { apiCall } from '../../src/api/client';
import { colors, typography, spacing, borderRadius, brandGradients } from '../../src/theme/designSystem';
import { useTranslation } from 'react-i18next';

export default function ProfileEditScreen() {
  const { t } = useTranslation();
  const { user, token, logout, updateUser } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState(user?.username || '');
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [saving, setSaving] = useState(false);
  const [pwdSaving, setPwdSaving] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailPwd, setEmailPwd] = useState('');
  const [emailSaving, setEmailSaving] = useState(false);

  const changeEmail = async () => {
    if (!newEmail.trim() || !emailPwd) return;
    setEmailSaving(true);
    try {
      const res = await apiCall<{ email: string }>('/profile/email', { token, method: 'PUT', body: { new_email: newEmail.trim(), password: emailPwd } });
      updateUser({ email: res.email });
      Alert.alert(t('profileEdit.saved'), t('profileEdit.email_updated'));
      setNewEmail(''); setEmailPwd('');
    } catch (e: any) { Alert.alert(t('profileEdit.error'), e.message || t('profileEdit.email_change_error')); }
    finally { setEmailSaving(false); }
  };

  const saveUsername = async () => {
    if (!username.trim() || username === user?.username) return;
    setSaving(true);
    try {
      const updated = await apiCall('/profile', { token, method: 'PUT', body: { username: username.trim() } });
      updateUser({ username: updated.username });
      Alert.alert(t('profileEdit.saved'), t('profileEdit.username_updated'));
    } catch (e: any) { Alert.alert(t('profileEdit.error'), e.message || t('profileEdit.save_error')); }
    finally { setSaving(false); }
  };

  const changePassword = async () => {
    if (!currentPwd || !newPwd) return;
    setPwdSaving(true);
    try {
      await apiCall('/profile/password', { token, method: 'PUT', body: { current_password: currentPwd, new_password: newPwd } });
      Alert.alert(t('profileEdit.saved'), t('profileEdit.password_updated'));
      setCurrentPwd(''); setNewPwd('');
    } catch (e: any) { Alert.alert(t('profileEdit.error'), e.message || t('profileEdit.wrong_password')); }
    finally { setPwdSaving(false); }
  };

  const deleteAccount = () => {
    Alert.alert(
      t('profileEdit.delete_account'),
      t('profileEdit.delete_confirm'),
      [
        { text: t('profileEdit.cancel'), style: 'cancel' },
        {
          text: t('profileEdit.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await apiCall('/profile', { token, method: 'DELETE' });
              // Navigate FIRST, then clear state
              router.replace('/(auth)/login' as any);
              setTimeout(async () => {
                await logout();
              }, 200);
              Alert.alert(
                t('profileEdit.delete_success_title'),
                t('profileEdit.delete_success_msg')
              );
            } catch (e: any) {
              Alert.alert(
                t('profileEdit.error'),
                e.message || t('profileEdit.delete_error_msg')
              );
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <LinearGradient colors={brandGradients.background} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} data-testid="back-btn">
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t('profileEdit.title')}</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView contentContainerStyle={s.content}>
        {/* Email */}
        <View style={s.card}>
          <Text style={s.label}>{t('profileEdit.email')}</Text>
          <Text style={s.value}>{user?.email}</Text>
          <View style={s.divider} />
          <Text style={[s.label, { marginTop: 12 }]}>{t('profileEdit.change_email')}</Text>
          <TextInput style={s.input} value={newEmail} onChangeText={setNewEmail} placeholder={t("profileEdit.new_email")} keyboardType="email-address" autoCapitalize="none" placeholderTextColor="rgba(255,255,255,0.3)" data-testid="new-email-input" />
          <TextInput style={[s.input, { marginTop: 8 }]} value={emailPwd} onChangeText={setEmailPwd} placeholder={t("profileEdit.confirm_password")} secureTextEntry placeholderTextColor="rgba(255,255,255,0.3)" data-testid="email-pwd-input" />
          <TouchableOpacity style={s.saveBtn} onPress={changeEmail} disabled={emailSaving} data-testid="change-email-btn">
            <LinearGradient colors={brandGradients.cta} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.saveBtnGradient}>
              {emailSaving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.saveBtnText}>{t('profileEdit.update_email')}</Text>}
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Username */}
        <View style={s.card}>
          <Text style={s.label}>{t('profileEdit.username')}</Text>
          <TextInput style={s.input} value={username} onChangeText={setUsername} placeholder={t("profileEdit.username_placeholder")} placeholderTextColor="rgba(255,255,255,0.3)" data-testid="username-input" />
          <TouchableOpacity style={s.saveBtn} onPress={saveUsername} disabled={saving} data-testid="save-username-btn">
            <LinearGradient colors={brandGradients.cta} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.saveBtnGradient}>
              {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.saveBtnText}>{t('profileEdit.save')}</Text>}
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Password */}
        <View style={s.card}>
          <Text style={s.label}>{t('profileEdit.change_password')}</Text>
          <TextInput style={s.input} value={currentPwd} onChangeText={setCurrentPwd} placeholder={t("profileEdit.current_password")} secureTextEntry placeholderTextColor="rgba(255,255,255,0.3)" data-testid="current-pwd-input" />
          <TextInput style={[s.input, { marginTop: 8 }]} value={newPwd} onChangeText={setNewPwd} placeholder={t("profileEdit.new_password")} secureTextEntry placeholderTextColor="rgba(255,255,255,0.3)" data-testid="new-pwd-input" />
          <TouchableOpacity style={s.saveBtn} onPress={changePassword} disabled={pwdSaving} data-testid="change-pwd-btn">
            <LinearGradient colors={brandGradients.cta} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.saveBtnGradient}>
              {pwdSaving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.saveBtnText}>{t('profileEdit.change_password')}</Text>}
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Delete Account */}
        <TouchableOpacity style={s.deleteBtn} onPress={deleteAccount} data-testid="delete-account-btn">
          <Ionicons name="trash-outline" size={18} color={colors.error} />
          <Text style={s.deleteBtnText}>{t('profileEdit.delete_account')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, backgroundColor: '#F3F4F6' },
  headerTitle: { ...typography.titleM, color: colors.textPrimary },
  content: { padding: spacing.lg, gap: spacing.md },
  card: { backgroundColor: colors.primary, borderRadius: borderRadius.xl, padding: spacing.lg, borderWidth: 1.5, borderColor: colors.accent },
  label: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  value: { fontSize: 15, color: '#FFFFFF', fontWeight: '500' },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 12 },
  input: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: borderRadius.md, padding: 12, fontSize: 15, color: '#FFFFFF', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  saveBtn: { borderRadius: borderRadius.lg, overflow: 'hidden', marginTop: 10 },
  saveBtnGradient: { paddingVertical: 10, alignItems: 'center', borderRadius: borderRadius.lg },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, marginTop: spacing.lg },
  deleteBtnText: { fontSize: 15, fontWeight: '600', color: colors.error },
});
