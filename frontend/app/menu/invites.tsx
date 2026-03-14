import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../src/contexts/AuthContext';
import { apiCall } from '../../src/api/client';
import { colors, typography, spacing, borderRadius, brandGradients } from '../../src/theme/designSystem';

export default function InvitesScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);

  const joinWithCode = async () => {
    if (!code.trim()) return;
    setJoining(true);
    try {
      await apiCall('/leagues/join', { token, method: 'POST', body: { invite_code: code.trim() } });
      Alert.alert('OK', t('invites.joined_success'));
      setCode('');
    } catch (e: any) {
      Alert.alert(t('profileEdit.error'), e.message || t('invites.invalid_code'));
    } finally {
      setJoining(false);
    }
  };

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <LinearGradient colors={brandGradients.background} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} data-testid="back-btn">
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>I miei inviti</Text>
        <View style={{ width: 24 }} />
      </View>
      <View style={s.content}>
        <View style={s.cardOuter}>
          <LinearGradient colors={brandGradients.cardPremium} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.card}>
            <Text style={s.cardTitle}>Hai un codice invito?</Text>
            <Text style={s.desc}>Inserisci il codice per unirti a una lega privata</Text>
            <TextInput
              style={s.input}
              value={code}
              onChangeText={setCode}
              placeholder="Inserisci codice invito"
              placeholderTextColor="rgba(255,255,255,0.35)"
              autoCapitalize="characters"
              data-testid="invite-code-input"
            />
            <TouchableOpacity style={s.joinBtn} onPress={joinWithCode} disabled={joining} data-testid="join-btn">
              <LinearGradient colors={brandGradients.cta} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.joinBtnGradient}>
                <Ionicons name="enter-outline" size={18} color="#fff" />
                <Text style={s.joinBtnText}>{joining ? 'Entrando...' : 'Unisciti'}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, backgroundColor: '#F3F4F6' },
  headerTitle: { ...typography.titleM, color: colors.textPrimary },
  content: { padding: spacing.lg },
  cardOuter: { borderRadius: borderRadius.xl, overflow: 'hidden', borderWidth: 1.5, borderColor: colors.accent },
  card: { borderRadius: borderRadius.xl, padding: spacing.xl },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', marginBottom: 4 },
  desc: { fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 14 },
  input: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: borderRadius.md, padding: 14, fontSize: 16, color: '#FFFFFF', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', letterSpacing: 2, fontWeight: '700', textAlign: 'center' },
  joinBtn: { borderRadius: borderRadius.lg, overflow: 'hidden', marginTop: 12 },
  joinBtnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: borderRadius.lg },
  joinBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
