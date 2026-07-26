// ─────────────────────────────────────────────────────────────────────────────
// Configurazione FantaPronostic Community League (lega gratuita)
// ─────────────────────────────────────────────────────────────────────────────

export const COMMUNITY_LEAGUE = {
  name: "Community League",
  season: "Stagione 2026/2027",
  weeklyPrize: "Buono Amazon da 20€",
  finalPrize: "Un weekend per 2 in una capitale europea",
};

// Capitani creator. Per aggiungere i loghi: metti i file in
// landing/public/captains/ (es. pippofootball.png) e imposta "image".
export const CAPTAINS = [
  { name: "PippoFootball", image: "/captains/pippofootball.png" },
  { name: "I Difensori del Fanta", image: "/captains/difensori-del-fanta.png" },
  { name: "La Napoli Bene", image: "/captains/la-napoli-bene.png" },
  { name: "Footbolandia", image: "/captains/footbolandia.png" },
  { name: "Calcio Bello da Dio", image: "/captains/cbdd.png" },
  { name: "Extra Time", image: "/captains/extra-time.png" },
];

export const COMMUNITY_SCORING = [
  { label: "Esito finale 1X2", points: 2 },
  { label: "Risultato esatto", points: 5 },
  { label: "Goal / No Goal", points: 1 },
  { label: "Over / Under 2,5", points: 1 },
];

export const COMMUNITY_REGOLAMENTO: { n: number; title: string; body: string }[] = [
  {
    n: 1,
    title: "Iscrizione gratuita",
    body: `La partecipazione alla Community League è completamente gratuita. Per partecipare è necessario avere un account FantaPronostic attivo, iscriversi alla Community League dall'app e scegliere una delle community (capitani) disponibili.
La partecipazione è aperta a tutte le persone maggiorenni cittadine o residenti in uno degli Stati membri dell'Unione Europea. Ogni partecipante può utilizzare un solo account.`,
  },
  {
    n: 2,
    title: "Scelta della community",
    body: `Al momento dell'iscrizione il partecipante sceglie la community del capitano che preferisce tra quelle disponibili. I punti realizzati dal partecipante concorrono sia alla propria classifica individuale, sia alla classifica complessiva della community scelta.`,
  },
  {
    n: 3,
    title: "Modalità di gioco",
    body: `La Community League si svolge in modalità tutti contro tutti e multipronostico: tutti i pronostici correttamente indovinati concorrono all'assegnazione del punteggio. Le partite sono selezionate dal campionato di Serie A. L'elenco delle partite di ogni giornata viene pubblicato nell'app prima dell'apertura dei pronostici.`,
  },
  {
    n: 4,
    title: "Pronostici e punteggio",
    body: `Per ogni partita il partecipante può inserire: esito finale 1X2 (2 punti); risultato esatto (5 punti); Goal/No Goal (1 punto); Over/Under 2,5 (1 punto). Ogni tipologia viene valutata separatamente, quindi nella stessa partita si possono ottenere punti per più pronostici corretti. Il punteggio massimo per una partita ordinaria è 9 punti. I pronostici errati assegnano zero punti e non comportano penalità.
Ogni settimana una partita della giornata sarà designata come partita X3: tutti i punti ottenuti in quella partita vengono moltiplicati per tre (fino a 27 punti). La partita X3 è chiaramente contrassegnata nell'app prima della chiusura dei pronostici.`,
  },
  {
    n: 5,
    title: "Chiusura dei pronostici",
    body: `Tutti i pronostici della giornata devono essere inseriti entro l'orario di inizio della prima partita prevista. All'inizio della prima partita i pronostici vengono bloccati e non sono più modificabili. Non saranno accettati pronostici inviati tramite email, messaggi o altri canali esterni all'app. L'orario valido è quello registrato dai sistemi di FantaPronostic.`,
  },
  {
    n: 6,
    title: "Premio settimanale",
    body: `Per ogni giornata viene assegnato un premio al partecipante che ottiene il punteggio più alto nella singola giornata: un buono Amazon del valore di 20€. Il premio settimanale è assegnato a una sola persona.
In caso di parità di punti nella classifica settimanale, sarà meglio classificato, nell'ordine, il partecipante che avrà: indovinato il maggior numero complessivo di pronostici; indovinato il maggior numero di risultati esatti; indovinato il maggior numero di esiti 1X2; ottenuto il maggior punteggio nella giornata precedente. Se la parità permane, verranno considerate progressivamente le giornate precedenti; in ultima istanza si procederà con uno spareggio pronostici tra i partecipanti ancora in parità.`,
  },
  {
    n: 7,
    title: "Premio finale",
    body: `Al termine della stagione, il primo classificato nella classifica generale della Community League vince un weekend per 2 persone in una capitale europea. Il premio è assegnato a una sola persona.
Non sono previsti premi condivisi o assegnazioni ex aequo. In caso di parità di punti nella classifica finale, si applicano nell'ordine gli stessi criteri di spareggio previsti per la classifica settimanale (maggior numero di pronostici corretti, poi risultati esatti, poi esiti 1X2, poi punteggio nelle ultime giornate a ritroso) e, se necessario, uno spareggio pronostici, in modo da determinare un unico vincitore.`,
  },
  {
    n: 8,
    title: "Premio di community",
    body: `Al termine della stagione, la community che avrà totalizzato complessivamente più punti riceverà un ulteriore riconoscimento, secondo le modalità comunicate dall'Organizzatore tramite l'app.`,
  },
  {
    n: 9,
    title: "Comunicazione e consegna dei premi",
    body: `I vincitori vengono contattati all'indirizzo email associato all'account e/o tramite comunicazione nell'app. Il vincitore dovrà rispondere entro 10 giorni e fornire i dati necessari alla verifica dell'identità e alla consegna. In caso di mancata risposta, il premio potrà essere assegnato al partecipante successivo in classifica. I premi non sono convertibili in denaro.`,
  },
  {
    n: 10,
    title: "Condotte vietate e accettazione",
    body: `È vietato utilizzare più account, dati falsi, bot o procedure automatizzate, oppure cedere il proprio account. In caso di comportamento irregolare, FantaPronostic potrà escludere il partecipante e annullare i punti ottenuti. La partecipazione comporta l'accettazione integrale del presente regolamento e delle condizioni di utilizzo dell'app FantaPronostic.`,
  },
];
