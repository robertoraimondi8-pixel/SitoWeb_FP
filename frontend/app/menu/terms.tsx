import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, typography, spacing, borderRadius, brandGradients } from '../../src/theme/designSystem';

export default function TermsScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <LinearGradient colors={brandGradients.background} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} data-testid="terms-back-btn">
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Termini di Servizio</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.card}>
          <Text style={s.sectionTitle}>1. Informazioni generali</Text>
          <Text style={s.paragraph}>
            FantaPronostic è un'applicazione mobile che consente agli utenti di partecipare a giochi di pronostici sportivi basati su partite di calcio e classifiche tra utenti.
          </Text>
          <Text style={s.paragraph}>
            L'utilizzo dell'app implica l'accettazione dei presenti Termini di Servizio.
          </Text>
          <Text style={s.paragraph}>
            Se non si accettano questi termini, si invita a non utilizzare l'applicazione.
          </Text>
        </View>

        <View style={s.card}>
          <Text style={s.sectionTitle}>2. Natura del servizio</Text>
          <Text style={s.paragraph}>
            FantaPronostic è un gioco di intrattenimento basato su pronostici sportivi.
          </Text>
          <Text style={s.paragraph}>L'app:</Text>
          <Text style={s.bulletItem}>- non rappresenta una piattaforma di scommesse</Text>
          <Text style={s.bulletItem}>- non consente puntate con denaro reale</Text>
          <Text style={s.bulletItem}>- non è affiliata a bookmaker o operatori di gioco</Text>
          <Text style={s.paragraph}>
            I risultati delle partite e le statistiche visualizzate nell'app possono provenire da provider di dati sportivi di terze parti.
          </Text>
        </View>

        <View style={s.card}>
          <Text style={s.sectionTitle}>3. Registrazione dell'account</Text>
          <Text style={s.paragraph}>
            Per utilizzare alcune funzionalità dell'app è necessario creare un account.
          </Text>
          <Text style={s.paragraph}>L'utente si impegna a:</Text>
          <Text style={s.bulletItem}>- fornire informazioni accurate</Text>
          <Text style={s.bulletItem}>- mantenere sicura la propria password</Text>
          <Text style={s.bulletItem}>- non condividere l'account con altri utenti</Text>
          <Text style={s.paragraph}>
            L'utente è responsabile di tutte le attività svolte tramite il proprio account.
          </Text>
        </View>

        <View style={s.card}>
          <Text style={s.sectionTitle}>4. Utilizzo dell'app</Text>
          <Text style={s.paragraph}>L'utente si impegna a non:</Text>
          <Text style={s.bulletItem}>- utilizzare l'app per attività illegali</Text>
          <Text style={s.bulletItem}>- interferire con il funzionamento dell'applicazione</Text>
          <Text style={s.bulletItem}>- tentare di accedere ai sistemi o ai dati di altri utenti</Text>
          <Text style={s.bulletItem}>- utilizzare bot o sistemi automatici per alterare il gioco</Text>
          <Text style={s.paragraph}>
            FantaPronostic si riserva il diritto di sospendere o chiudere account che violino queste regole.
          </Text>
        </View>

        <View style={s.card}>
          <Text style={s.sectionTitle}>5. Classifiche e risultati</Text>
          <Text style={s.paragraph}>
            Le classifiche e i punteggi sono calcolati automaticamente in base ai pronostici degli utenti e ai risultati ufficiali delle partite.
          </Text>
          <Text style={s.paragraph}>
            FantaPronostic non garantisce l'assenza di errori nei dati provenienti da provider esterni.
          </Text>
          <Text style={s.paragraph}>
            Eventuali correzioni ai risultati o ai punteggi possono essere effettuate dall'amministratore.
          </Text>
        </View>

        <View style={s.card}>
          <Text style={s.sectionTitle}>6. Premi e competizioni</Text>
          <Text style={s.paragraph}>
            Nel caso in cui vengano organizzati tornei o competizioni con premi, le modalità di partecipazione e le regole specifiche saranno comunicate separatamente all'interno dell'app.
          </Text>
        </View>

        <View style={s.card}>
          <Text style={s.sectionTitle}>7. Limitazione di responsabilità</Text>
          <Text style={s.paragraph}>FantaPronostic non è responsabile per:</Text>
          <Text style={s.bulletItem}>- eventuali interruzioni del servizio</Text>
          <Text style={s.bulletItem}>- errori nei dati forniti da terze parti</Text>
          <Text style={s.bulletItem}>- perdite derivanti dall'utilizzo dell'app</Text>
          <Text style={s.paragraph}>L'app viene fornita "così com'è".</Text>
        </View>

        <View style={s.card}>
          <Text style={s.sectionTitle}>8. Modifiche ai termini</Text>
          <Text style={s.paragraph}>
            FantaPronostic può aggiornare i presenti Termini di Servizio in qualsiasi momento.
          </Text>
          <Text style={s.paragraph}>
            Le modifiche saranno pubblicate nell'app o sul sito ufficiale.
          </Text>
        </View>

        <View style={s.card}>
          <Text style={s.sectionTitle}>9. Contatti</Text>
          <Text style={s.paragraph}>
            Per qualsiasi domanda è possibile contattare il supporto tramite l'indirizzo email indicato nell'app.
          </Text>
        </View>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, backgroundColor: '#F3F4F6' },
  headerTitle: { ...typography.titleM, color: colors.textPrimary },
  content: { padding: spacing.lg, gap: spacing.md },
  card: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 10,
  },
  paragraph: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.textPrimary,
    marginBottom: 8,
  },
  bulletItem: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.textSecondary,
    marginBottom: 4,
    paddingLeft: 8,
  },
});
