import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, StyleSheet, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/contexts/AuthContext';
import { useLeague } from '../../src/contexts/LeagueContext';
import { apiCall } from '../../src/api/client';
import { colors } from '../../src/theme/designSystem';

export default function PaymentSuccessScreen() {
  const { session_id } = useLocalSearchParams<{ session_id: string }>();
  const { token } = useAuth();
  const { refreshLeagues } = useLeague();
  const router = useRouter();

  const [status, setStatus] = useState<'polling' | 'success' | 'failed' | 'expired'>('polling');
  const [league, setLeague] = useState<any>(null);
  const [error, setError] = useState('');
  const attemptRef = useRef(0);

  useEffect(() => {
    if (!session_id || !token) return;

    const poll = async () => {
      if (attemptRef.current >= 10) {
        setStatus('failed');
        setError('Timeout verifica pagamento. Controlla il tuo email per la conferma.');
        return;
      }
      attemptRef.current += 1;

      try {
        const res = await apiCall(`/payments/status/${session_id}`, { token });

        if (res.payment_status === 'paid') {
          setStatus('success');
          if (res.league) setLeague(res.league);
          if (token) await refreshLeagues(token);
          return;
        }
        if (res.status === 'expired') {
          setStatus('expired');
          return;
        }
        // Still pending, poll again
        setTimeout(poll, 2000);
      } catch {
        setTimeout(poll, 2000);
      }
    };

    poll();
  }, [session_id, token]);

  const handleShare = async () => {
    if (!league?.invite_code) return;
    try {
      await Share.share({
        message: `Unisciti alla mia lega FantaPronostic "${league.name}"!\nCodice invito: ${league.invite_code}`,
      });
    } catch {}
  };

  if (status === 'polling') {
    return (
      <SafeAreaView style={s.container} edges={['top']}>
        <View style={s.center}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={s.pollingText}>Verifica pagamento in corso...</Text>
          <Text style={s.pollingSubtext}>Non chiudere questa pagina</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (status === 'expired' || status === 'failed') {
    return (
      <SafeAreaView style={s.container} edges={['top']}>
        <View style={s.center}>
          <View style={[s.iconWrap, { backgroundColor: 'rgba(239,68,68,0.15)' }]}>
            <Ionicons name="close-circle" size={56} color="#EF4444" />
          </View>
          <Text style={s.title}>{status === 'expired' ? 'Pagamento Scaduto' : 'Errore Pagamento'}</Text>
          <Text style={s.desc}>{error || 'Il pagamento non e stato completato. Riprova.'}</Text>
          <TouchableOpacity style={[s.btn, { backgroundColor: colors.accent }]} onPress={() => router.replace('/league/create')}>
            <Text style={s.btnText}>Torna alla Creazione</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Success
  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.center}>
        <View style={[s.iconWrap, { backgroundColor: 'rgba(16,185,129,0.15)' }]}>
          <Ionicons name="checkmark-circle" size={56} color="#10B981" />
        </View>
        <Text style={s.title}>Pagamento Completato!</Text>
        <Text style={s.desc}>La tua lega con partite personalizzate e stata creata.</Text>

        {league && (
          <>
            <View style={s.codeCard} data-testid="payment-success-invite-code">
              <Text style={s.codeLabel}>CODICE INVITO</Text>
              <Text style={s.codeValue}>{league.invite_code}</Text>
            </View>

            <View style={s.infoCard}>
              <Text style={s.infoTitle}>{league.name}</Text>
              <Text style={s.infoRow}>Giornate: {league.start_matchday} - {league.end_matchday}</Text>
              <Text style={s.infoRow}>Tipo partite: Personalizzate</Text>
              <Text style={s.infoRow}>Termine giocata: {league.bet_deadline_minutes} min prima</Text>
            </View>

            <TouchableOpacity style={[s.btn, { backgroundColor: colors.accent }]} onPress={handleShare} data-testid="share-invite-btn">
              <Ionicons name="share-outline" size={18} color="#FFF" />
              <Text style={s.btnText}>Condividi Codice</Text>
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity
          style={[s.btn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border }]}
          onPress={() => router.replace('/(tabs)/home')}
          data-testid="go-home-btn"
        >
          <Text style={[s.btnText, { color: colors.textPrimary }]}>Vai alla Home</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F8' },
  center: { flex: 1, padding: 32, alignItems: 'center', justifyContent: 'center' },
  pollingText: { fontSize: 18, fontWeight: '700', color: '#1E293B', marginTop: 20 },
  pollingSubtext: { fontSize: 14, color: '#64748B', marginTop: 8 },
  iconWrap: { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  title: { fontSize: 24, fontWeight: '800', color: '#1E293B', marginBottom: 8 },
  desc: { fontSize: 15, color: '#64748B', textAlign: 'center', marginBottom: 24 },
  codeCard: { width: '100%', padding: 20, borderRadius: 16, borderWidth: 2, borderColor: '#F59E0B', backgroundColor: '#1F4C8F', alignItems: 'center', marginBottom: 16 },
  codeLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1, color: 'rgba(255,255,255,0.5)', marginBottom: 6 },
  codeValue: { fontSize: 32, fontWeight: '900', letterSpacing: 4, color: '#F59E0B' },
  infoCard: { width: '100%', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 14, backgroundColor: '#FFF', marginBottom: 20, gap: 4 },
  infoTitle: { fontSize: 15, fontWeight: '700', color: '#1E293B', marginBottom: 4 },
  infoRow: { fontSize: 13, color: '#64748B' },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', height: 52, borderRadius: 14, marginBottom: 12 },
  btnText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
});
