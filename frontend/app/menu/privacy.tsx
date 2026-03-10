import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, typography, spacing, borderRadius, brandGradients } from '../../src/theme/designSystem';

export default function PrivacyScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <LinearGradient colors={brandGradients.background} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} data-testid="privacy-back-btn">
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Privacy Policy</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.card}>
          <Text style={s.sectionTitle}>1. Introduzione</Text>
          <Text style={s.paragraph}>
            La presente Privacy Policy descrive come FantaPronostic raccoglie, utilizza e protegge i dati personali degli utenti.
          </Text>
          <Text style={s.paragraph}>
            Utilizzando l'app l'utente accetta le pratiche descritte in questa informativa.
          </Text>
        </View>

        <View style={s.card}>
          <Text style={s.sectionTitle}>2. Dati raccolti</Text>
          <Text style={s.paragraph}>FantaPronostic può raccogliere i seguenti dati:</Text>
          <Text style={s.subTitle}>Dati forniti dall'utente</Text>
          <Text style={s.bulletItem}>- indirizzo email</Text>
          <Text style={s.bulletItem}>- username</Text>
          <Text style={s.bulletItem}>- informazioni di profilo</Text>
          <Text style={s.subTitle}>Dati di utilizzo</Text>
          <Text style={s.bulletItem}>- pronostici inseriti</Text>
          <Text style={s.bulletItem}>- attività nell'app</Text>
          <Text style={s.bulletItem}>- interazioni con leghe e classifiche</Text>
          <Text style={s.subTitle}>Dati tecnici</Text>
          <Text style={s.bulletItem}>- dispositivo utilizzato</Text>
          <Text style={s.bulletItem}>- sistema operativo</Text>
          <Text style={s.bulletItem}>- identificatori tecnici necessari al funzionamento dell'app</Text>
        </View>

        <View style={s.card}>
          <Text style={s.sectionTitle}>3. Finalità del trattamento</Text>
          <Text style={s.paragraph}>I dati vengono utilizzati per:</Text>
          <Text style={s.bulletItem}>- creare e gestire l'account utente</Text>
          <Text style={s.bulletItem}>- consentire la partecipazione ai giochi di pronostici</Text>
          <Text style={s.bulletItem}>- calcolare classifiche e risultati</Text>
          <Text style={s.bulletItem}>- migliorare l'esperienza dell'app</Text>
          <Text style={s.bulletItem}>- comunicare aggiornamenti o informazioni relative al servizio</Text>
        </View>

        <View style={s.card}>
          <Text style={s.sectionTitle}>4. Condivisione dei dati</Text>
          <Text style={s.paragraph}>
            FantaPronostic non vende i dati personali degli utenti.
          </Text>
          <Text style={s.paragraph}>I dati possono essere condivisi solo con:</Text>
          <Text style={s.bulletItem}>- fornitori di servizi tecnici necessari al funzionamento dell'app</Text>
          <Text style={s.bulletItem}>- provider di dati sportivi</Text>
          <Text style={s.bulletItem}>- servizi di hosting e infrastruttura</Text>
        </View>

        <View style={s.card}>
          <Text style={s.sectionTitle}>5. Sicurezza dei dati</Text>
          <Text style={s.paragraph}>
            FantaPronostic adotta misure tecniche e organizzative per proteggere i dati personali degli utenti.
          </Text>
          <Text style={s.paragraph}>
            Tuttavia nessun sistema online può garantire sicurezza assoluta.
          </Text>
        </View>

        <View style={s.card}>
          <Text style={s.sectionTitle}>6. Conservazione dei dati</Text>
          <Text style={s.paragraph}>
            I dati personali sono conservati per il tempo necessario al funzionamento del servizio o fino alla richiesta di cancellazione dell'account da parte dell'utente.
          </Text>
        </View>

        <View style={s.card}>
          <Text style={s.sectionTitle}>7. Diritti degli utenti</Text>
          <Text style={s.paragraph}>Gli utenti possono richiedere:</Text>
          <Text style={s.bulletItem}>- accesso ai propri dati</Text>
          <Text style={s.bulletItem}>- modifica dei dati</Text>
          <Text style={s.bulletItem}>- cancellazione dell'account</Text>
          <Text style={s.paragraph}>
            Per esercitare questi diritti è possibile contattare il supporto.
          </Text>
        </View>

        <View style={s.card}>
          <Text style={s.sectionTitle}>8. Modifiche alla privacy policy</Text>
          <Text style={s.paragraph}>
            La presente privacy policy può essere aggiornata nel tempo.
          </Text>
          <Text style={s.paragraph}>
            Le modifiche verranno pubblicate sul sito o nell'app.
          </Text>
        </View>

        <View style={s.card}>
          <Text style={s.sectionTitle}>9. Contatti</Text>
          <Text style={s.paragraph}>
            Per richieste relative alla privacy è possibile contattare il supporto tramite l'indirizzo email indicato nell'app.
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
  subTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: 8,
    marginBottom: 4,
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
