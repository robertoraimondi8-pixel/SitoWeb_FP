import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/contexts/AuthContext';
import { apiCall } from '../../src/api/client';
import { colors, typography, spacing, borderRadius, shadows } from '../../src/theme/designSystem';

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
      Alert.alert('Fatto', 'Ti sei unito alla lega!');
      setCode('');
    } catch (e: any) {
      Alert.alert('Errore', e.message || 'Codice invito non valido');
    } finally {
      setJoining(false);
    }
  };

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} data-testid="back-btn">
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>I miei inviti</Text>
        <View style={{ width: 24 }} />
      </View>
      <View style={s.content}>
        <View style={s.card}>
          <Text style={s.cardTitle}>Hai un codice invito?</Text>
          <Text style={s.desc}>Inserisci il codice per unirti a una lega privata</Text>
          <TextInput
            style={s.input}
            value={code}
            onChangeText={setCode}
            placeholder="Inserisci codice invito"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="characters"
            data-testid="invite-code-input"
          />
          <TouchableOpacity style={s.joinBtn} onPress={joinWithCode} disabled={joining} data-testid="join-btn">
            <Ionicons name="enter-outline" size={18} color="#fff" />
            <Text style={s.joinBtnText}>{joining ? 'Entrando...' : 'Unisciti'}</Text>
          </TouchableOpacity>
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
  card: { backgroundColor: colors.card, borderRadius: borderRadius.xl, padding: spacing.lg, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 20, elevation: 4 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },
  desc: { fontSize: 13, color: colors.textSecondary, marginBottom: 14 },
  input: { backgroundColor: colors.background, borderRadius: borderRadius.md, padding: 14, fontSize: 16, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border, letterSpacing: 2, fontWeight: '700', textAlign: 'center' },
  joinBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.primary, borderRadius: borderRadius.md, paddingVertical: 12, marginTop: 12 },
  joinBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
