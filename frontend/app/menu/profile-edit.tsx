import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { apiCall } from '../../src/api/client';
import { colors, typography, spacing, borderRadius, shadows } from '../../src/theme/designSystem';

export default function ProfileEditScreen() {
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
      Alert.alert('Salvato', 'Email aggiornata con successo');
      setNewEmail('');
      setEmailPwd('');
    } catch (e: any) {
      Alert.alert('Errore', e.message || 'Errore nel cambio email');
    } finally {
      setEmailSaving(false);
    }
  };

  const saveUsername = async () => {
    if (!username.trim() || username === user?.username) return;
    setSaving(true);
    try {
      const updated = await apiCall('/profile', { token, method: 'PUT', body: { username: username.trim() } });
      updateUser({ username: updated.username });
      Alert.alert('Salvato', 'Nome utente aggiornato');
    } catch (e: any) {
      Alert.alert('Errore', e.message || 'Errore nel salvataggio');
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    if (!currentPwd || !newPwd) return;
    setPwdSaving(true);
    try {
      await apiCall('/profile/password', { token, method: 'PUT', body: { current_password: currentPwd, new_password: newPwd } });
      Alert.alert('Salvato', 'Password aggiornata con successo');
      setCurrentPwd('');
      setNewPwd('');
    } catch (e: any) {
      Alert.alert('Errore', e.message || 'Password non corretta');
    } finally {
      setPwdSaving(false);
    }
  };

  const deleteAccount = () => {
    Alert.alert(
      'Elimina Account',
      'Sei sicuro? Tutti i tuoi dati verranno eliminati permanentemente.',
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Elimina', style: 'destructive', onPress: async () => {
            try {
              await apiCall('/profile', { token, method: 'DELETE' });
              await logout();
              router.replace('/(auth)/login' as any);
            } catch (e: any) {
              Alert.alert('Errore', e.message);
            }
          }
        },
      ]
    );
  };

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} data-testid="back-btn">
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Profilo</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView contentContainerStyle={s.content}>
        {/* Email */}
        <View style={s.card}>
          <Text style={s.label}>Email</Text>
          <Text style={s.value}>{user?.email}</Text>
          <View style={s.divider} />
          <Text style={[s.label, { marginTop: 12 }]}>Cambia Email</Text>
          <TextInput style={s.input} value={newEmail} onChangeText={setNewEmail} placeholder="Nuova email" keyboardType="email-address" autoCapitalize="none" placeholderTextColor={colors.textMuted} data-testid="new-email-input" />
          <TextInput style={[s.input, { marginTop: 8 }]} value={emailPwd} onChangeText={setEmailPwd} placeholder="Conferma con password" secureTextEntry placeholderTextColor={colors.textMuted} data-testid="email-pwd-input" />
          <TouchableOpacity style={s.saveBtn} onPress={changeEmail} disabled={emailSaving} data-testid="change-email-btn">
            {emailSaving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.saveBtnText}>Aggiorna Email</Text>}
          </TouchableOpacity>
        </View>

        {/* Username */}
        <View style={s.card}>
          <Text style={s.label}>Nome utente</Text>
          <TextInput style={s.input} value={username} onChangeText={setUsername} placeholder="Username" placeholderTextColor={colors.textMuted} data-testid="username-input" />
          <TouchableOpacity style={s.saveBtn} onPress={saveUsername} disabled={saving} data-testid="save-username-btn">
            {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.saveBtnText}>Salva</Text>}
          </TouchableOpacity>
        </View>

        {/* Password */}
        <View style={s.card}>
          <Text style={s.label}>Cambia Password</Text>
          <TextInput style={s.input} value={currentPwd} onChangeText={setCurrentPwd} placeholder="Password attuale" secureTextEntry placeholderTextColor={colors.textMuted} data-testid="current-pwd-input" />
          <TextInput style={[s.input, { marginTop: 8 }]} value={newPwd} onChangeText={setNewPwd} placeholder="Nuova password" secureTextEntry placeholderTextColor={colors.textMuted} data-testid="new-pwd-input" />
          <TouchableOpacity style={s.saveBtn} onPress={changePassword} disabled={pwdSaving} data-testid="change-pwd-btn">
            {pwdSaving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.saveBtnText}>Cambia Password</Text>}
          </TouchableOpacity>
        </View>

        {/* Delete Account */}
        <TouchableOpacity style={s.deleteBtn} onPress={deleteAccount} data-testid="delete-account-btn">
          <Ionicons name="trash-outline" size={18} color={colors.error} />
          <Text style={s.deleteBtnText}>Elimina Account</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { ...typography.titleM, color: colors.textPrimary },
  content: { padding: spacing.lg, gap: spacing.md },
  card: { backgroundColor: colors.card, borderRadius: borderRadius.lg, padding: spacing.lg, ...shadows.card },
  label: { fontSize: 12, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  value: { fontSize: 15, color: colors.textPrimary, fontWeight: '500' },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 12 },
  input: { backgroundColor: colors.background, borderRadius: borderRadius.md, padding: 12, fontSize: 15, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border },
  saveBtn: { backgroundColor: colors.primary, borderRadius: borderRadius.md, paddingVertical: 10, alignItems: 'center', marginTop: 10 },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, marginTop: spacing.lg },
  deleteBtnText: { fontSize: 15, fontWeight: '600', color: colors.error },
});
