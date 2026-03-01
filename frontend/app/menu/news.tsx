import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../src/contexts/AuthContext';
import { apiCall } from '../../src/api/client';
import { colors, typography, spacing, borderRadius, brandGradients } from '../../src/theme/designSystem';

type NewsItem = { id: string; title: string; body: string; author_name: string; created_at: string };

export default function NewsScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try { setNews(await apiCall<NewsItem[]>('/news', { token })); } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, [token]);

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <LinearGradient colors={brandGradients.background} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} data-testid="back-btn">
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>News</Text>
        <View style={{ width: 24 }} />
      </View>
      {loading ? (
        <ActivityIndicator size="large" color={colors.accent} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={news}
          keyExtractor={(item) => item.id}
          contentContainerStyle={s.content}
          renderItem={({ item }) => (
            <View style={s.newsCard} data-testid={`news-${item.id}`}>
              <Text style={s.newsTitle}>{item.title}</Text>
              <Text style={s.newsBody}>{item.body}</Text>
              <View style={s.newsMeta}>
                <Ionicons name="person-outline" size={12} color="rgba(255,255,255,0.4)" />
                <Text style={s.newsMetaText}>{item.author_name}</Text>
                <Text style={s.newsMetaText}>{formatDate(item.created_at)}</Text>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={s.emptyWrap}>
              <Ionicons name="newspaper-outline" size={48} color="rgba(255,255,255,0.2)" />
              <Text style={s.empty}>Nessuna news al momento</Text>
              <Text style={s.emptyDesc}>Le novita appariranno qui</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, backgroundColor: '#F3F4F6' },
  headerTitle: { ...typography.titleM, color: colors.textPrimary },
  content: { padding: spacing.lg, gap: spacing.md },
  newsCard: { backgroundColor: colors.primary, borderRadius: borderRadius.xl, padding: spacing.lg, borderWidth: 1.5, borderColor: colors.accent },
  newsTitle: { fontSize: 17, fontWeight: '700', color: '#FFFFFF', marginBottom: 8 },
  newsBody: { fontSize: 14, color: 'rgba(255,255,255,0.6)', lineHeight: 21 },
  newsMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.08)' },
  newsMetaText: { fontSize: 11, color: 'rgba(255,255,255,0.4)' },
  emptyWrap: { alignItems: 'center', paddingTop: 80, gap: 10 },
  empty: { fontSize: 16, fontWeight: '600', color: colors.textSecondary },
  emptyDesc: { fontSize: 13, color: colors.textMuted },
});
