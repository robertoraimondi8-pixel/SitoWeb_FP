import React from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, typography, spacing, borderRadius } from '../src/theme/designSystem';

export default function PrivacyPolicyScreen() {
  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Text style={s.mainTitle}>Privacy Policy</Text>
        <Text style={s.lastUpdated}>Ultimo aggiornamento: Febbraio 2026</Text>

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
          <Text style={s.paragraph}>FantaPronostic puo raccogliere i seguenti dati:</Text>
          <Text style={s.subTitle}>Dati forniti dall'utente</Text>
          <Text style={s.bulletItem}>- indirizzo email</Text>
          <Text style={s.bulletItem}>- username</Text>
          <Text style={s.bulletItem}>- informazioni di profilo</Text>
          <Text style={s.subTitle}>Dati di utilizzo</Text>
          <Text style={s.bulletItem}>- pronostici inseriti</Text>
          <Text style={s.bulletItem}>- attivita nell'app</Text>
          <Text style={s.bulletItem}>- interazioni con leghe e classifiche</Text>
          <Text style={s.subTitle}>Dati tecnici</Text>
          <Text style={s.bulletItem}>- dispositivo utilizzato</Text>
          <Text style={s.bulletItem}>- sistema operativo</Text>
          <Text style={s.bulletItem}>- identificatori tecnici necessari al funzionamento dell'app</Text>
        </View>

        <View style={s.card}>
          <Text style={s.sectionTitle}>3. Finalita del trattamento</Text>
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
            Tuttavia nessun sistema online puo garantire sicurezza assoluta.
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
            Per esercitare questi diritti e possibile contattare il supporto.
          </Text>
        </View>

        <View style={s.card}>
          <Text style={s.sectionTitle}>8. Modifiche alla privacy policy</Text>
          <Text style={s.paragraph}>
            La presente privacy policy puo essere aggiornata nel tempo.
          </Text>
          <Text style={s.paragraph}>
            Le modifiche verranno pubblicate sul sito o nell'app.
          </Text>
        </View>

        <View style={s.card}>
          <Text style={s.sectionTitle}>9. Contatti</Text>
          <Text style={s.paragraph}>
            Per richieste relative alla privacy e possibile contattare il supporto tramite l'indirizzo email indicato nell'app.
          </Text>
        </View>

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md },
  mainTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 4,
  },
  lastUpdated: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
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
