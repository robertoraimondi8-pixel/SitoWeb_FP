// ─────────────────────────────────────────────────────────────────────────────
// Configurazione FantaPronostic Super League 2026/2027
// ─────────────────────────────────────────────────────────────────────────────

// ⚠️ DA COMPLETARE con i dati reali dell'organizzatore prima del lancio.
export const ORGANIZER = {
  denominazione: "[Denominazione completa della ditta individuale]",
  sede: "[Indirizzo]",
  nif: "[Numero NIF]",
};

export const SUPER_LEAGUE = {
  name: "FantaPronostic Super League",
  season: "Stagione 2026/2027",
  productName: "FantaPronostic Club 2026/2027 – Piano editoriale digitale",
  price: 39,
  prizePool: "oltre 5.000€",
  leagueId: "451b4232-2402-492e-9702-351f4c4b03b9",
  // Sfondo hero (generato con Higgsfield, ospitato sul loro CDN).
  // Nota: idealmente va scaricato in public/ quando la policy di rete lo permette.
  heroImage:
    "https://d8j0ntlcm91z4.cloudfront.net/user_3FEIeMUVpKpDKSxptELTEyv0Qud/hf_20260722_105102_7ddfe7a7-c20e-48af-aa8b-23fa287a5f35.png",
  // Apertura iscrizioni (attiva il pagamento) e inizio competizione.
  // Formato ISO. La pagina passa in modalità "pagamento" a partire da openingDate.
  openingDate: "2026-08-04T00:00:00",
  startDate: "2026-09-04T00:00:00",
  startLabel: "4 settembre 2026",
  openingLabel: "4 agosto 2026",
};

export const LEAGUES = [
  { flag: "🇮🇹", name: "Serie A" },
  { flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", name: "Premier League" },
  { flag: "🇪🇸", name: "LaLiga" },
  { flag: "🇩🇪", name: "Bundesliga" },
  { flag: "🇫🇷", name: "Ligue 1" },
];

// Per aggiungere le foto reali dei premi: metti i file in landing/public/prizes/
// (es. apple-pack.png) e imposta "image" con il percorso "/prizes/apple-pack.png".
export const PRIZES = [
  {
    place: 1,
    label: "1° Classificato",
    title: "Apple Pack",
    items: ["iPhone 18 Pro", "AirPods 4 ANC", "Apple Watch"],
    icon: "🥇",
    image: "", // metti "/prizes/iphone.png" quando la foto è pronta
  },
  {
    place: 2,
    label: "2° Classificato",
    title: 'MacBook Neo 13"',
    items: [],
    icon: "🥈",
    image: "", // metti "/prizes/macbook.png" quando la foto è pronta
  },
  {
    place: 3,
    label: "3° Classificato",
    title: "PlayStation 5 Slim",
    items: [],
    icon: "🥉",
    image: "", // metti "/prizes/ps5.png" quando la foto è pronta
  },
];

export const SCORING = [
  { label: "Esito finale 1X2", points: 2 },
  { label: "Risultato esatto", points: 5 },
  { label: "Goal / No Goal", points: 1 },
  { label: "Over / Under 2,5", points: 1 },
];

// Regolamento completo — 21 articoli (testo ufficiale).
export const REGOLAMENTO: { n: number; title: string; body: string }[] = [
  {
    n: 1,
    title: "Organizzatore",
    body: `La FantaPronostic Super League 2026/2027 è organizzata da ${ORGANIZER.denominazione}, con sede in ${ORGANIZER.sede}, NIF ${ORGANIZER.nif}, titolare del progetto FantaPronostic, di seguito denominata "Organizzatore".`,
  },
  {
    n: 2,
    title: "Piano editoriale e accesso alla Super League",
    body: `L'acquisto del prodotto digitale "FantaPronostic Club 2026/2027 – Piano editoriale digitale" comprende l'accesso ai contenuti statistici, agli approfondimenti calcistici e agli aggiornamenti editoriali pubblicati durante la stagione 2026/2027.
Tra i servizi inclusi nel Piano editoriale è previsto anche l'accesso alla FantaPronostic Super League 2026/2027, secondo le modalità indicate nel presente regolamento.
Il pagamento è effettuato una sola volta e non prevede rinnovo automatico.
Prezzo del Piano editoriale: € 39,00, imposte incluse ove applicabili.
Ogni acquisto permette l'accesso alla lega a un solo account FantaPronostic.`,
  },
  {
    n: 3,
    title: "Durata",
    body: `La Super League si svolgerà dal 4 settembre 2026 fino all'ultima giornata prevista dall'Organizzatore nella stagione 2026/2027, indicativamente entro il mese di maggio 2027.
Il calendario definitivo delle giornate sarà pubblicato all'interno dell'app FantaPronostic.
L'Organizzatore potrà non programmare giornate durante le soste dei campionati, nelle settimane con un numero insufficiente di partite o in presenza di circostanze tecniche e sportive eccezionali.`,
  },
  {
    n: 4,
    title: "Requisiti di partecipazione",
    body: `Per partecipare è necessario: avere un account FantaPronostic attivo; acquistare il Piano editoriale digitale 2026/2027; inserire correttamente il codice o utilizzare il collegamento ricevuto dopo il pagamento; rispettare il presente regolamento e le condizioni di utilizzo dell'app.
Ogni partecipante può utilizzare un solo account. Non è consentita la partecipazione mediante account duplicati, identità false, sistemi automatizzati o account intestati a soggetti diversi dall'effettivo partecipante.
L'Organizzatore potrà richiedere al vincitore la verifica dell'identità prima della consegna del premio.`,
  },
  {
    n: 5,
    title: "Modalità di gioco",
    body: `La Super League si svolge in modalità tutti contro tutti e multipronostico: tutti i pronostici correttamente indovinati concorrono all'assegnazione del punteggio.
Ogni giornata sarà composta, indicativamente, da 12 partite selezionate direttamente da FantaPronostic. Le partite potranno appartenere a campionati e competizioni differenti e saranno scelte dall'Organizzatore tra gli eventi disponibili nel calendario calcistico.
L'elenco delle partite sarà pubblicato nell'app prima dell'apertura dei pronostici.`,
  },
  {
    n: 6,
    title: "Pronostici disponibili",
    body: `Per ogni partita il partecipante potrà inserire i seguenti pronostici: esito finale 1X2; risultato esatto; Goal/No Goal; Over/Under 2,5.
Ogni tipologia di pronostico viene valutata separatamente. Pertanto, all'interno della stessa partita, il partecipante può ottenere punti per più pronostici corretti.
Esempio: un partecipante pronostica vittoria della squadra di casa, risultato esatto 2-1, Goal e Over 2,5. Se la partita termina effettivamente 2-1, saranno assegnati i punti previsti per tutte e quattro le tipologie correttamente indovinate.`,
  },
  {
    n: 7,
    title: "Sistema di punteggio",
    body: `Per ogni partita vengono assegnati: Esito finale 1X2 → 2 punti; Risultato esatto → 5 punti; Goal/No Goal → 1 punto; Over/Under 2,5 → 1 punto.
Il punteggio massimo ottenibile in una partita ordinaria è quindi pari a 9 punti.
I pronostici errati assegnano zero punti e non comportano penalità.`,
  },
  {
    n: 8,
    title: "Partite con moltiplicatore X3",
    body: `FantaPronostic potrà individuare, a propria discrezione, una o più partite della giornata alle quali applicare il moltiplicatore X3. Le partite X3 saranno chiaramente contrassegnate nell'app prima della chiusura dei pronostici.
Per le partite X3, tutti i punti ottenuti nella partita vengono moltiplicati per tre. Esempio: se in una partita X3 il partecipante totalizza normalmente 8 punti, il punteggio effettivamente assegnato sarà 8 × 3 = 24 punti. Il punteggio massimo ottenibile in una singola partita X3 è pari a 27 punti.
Il numero delle partite X3 potrà variare da una giornata all'altra ed è stabilito esclusivamente da FantaPronostic.`,
  },
  {
    n: 9,
    title: "Inserimento e chiusura dei pronostici",
    body: `Tutti i pronostici relativi alle 12 partite della giornata devono essere inseriti entro l'orario di inizio della prima partita prevista. Fino a tale momento, il partecipante può modificare liberamente i propri pronostici.
All'inizio della prima partita: tutti i pronostici della giornata vengono bloccati; non sono più consentite modifiche; non è possibile inserire pronostici mancanti; non saranno accettati pronostici inviati tramite email, messaggi o altri canali esterni all'app.
L'orario considerato valido è quello registrato dai sistemi di FantaPronostic.`,
  },
  {
    n: 10,
    title: "Classifica generale",
    body: `La classifica generale viene determinata dalla somma di tutti i punti ottenuti dal partecipante nelle giornate della Super League. Al termine della stagione vince il partecipante che ha totalizzato il maggior numero di punti complessivi.
Le classifiche saranno aggiornate attraverso l'app sulla base dei risultati acquisiti dal provider sportivo utilizzato da FantaPronostic. Eventuali rettifiche ufficiali dei risultati potranno comportare il ricalcolo dei punteggi e della classifica.`,
  },
  {
    n: 11,
    title: "Criteri di spareggio della classifica finale",
    body: `Non sono previsti premi condivisi o assegnazioni ex aequo. In caso di parità di punti nella classifica finale, sarà meglio classificato, nell'ordine, il partecipante che avrà: indovinato il maggior numero complessivo di pronostici; indovinato il maggior numero di pronostici nelle partite X3; indovinato il maggior numero di risultati esatti; indovinato il maggior numero di esiti 1X2; ottenuto il maggior numero di punti nell'ultima giornata disputata.
Se la parità permane, verranno confrontati i punti ottenuti nella penultima giornata e, successivamente, nelle giornate precedenti, procedendo a ritroso. Qualora la parità dovesse permanere anche dopo l'applicazione di tutti i criteri precedenti, FantaPronostic organizzerà uno spareggio pronostici riservato esclusivamente ai partecipanti ancora in parità, secondo modalità comunicate tramite l'app.`,
  },
  {
    n: 12,
    title: "Premi finali",
    body: `Al termine della stagione saranno assegnati i seguenti premi: 1° classificato — Apple Pack composto da iPhone 18 Pro, AirPods 4 ANC e Apple Watch; 2° classificato — MacBook Neo 13"; 3° classificato — PlayStation 5 Slim.
Ogni premio finale viene assegnato a un solo partecipante. I premi non sono convertibili in denaro; non possono essere ceduti prima della loro assegnazione; saranno consegnati previa verifica dell'identità e dei requisiti del vincitore; potranno essere sostituiti, in caso di indisponibilità commerciale, con un prodotto della stessa categoria avente valore equivalente o superiore.
Colori, capacità di memoria, configurazioni e versioni dei prodotti saranno determinati dall'Organizzatore in base alla disponibilità al momento dell'acquisto. La denominazione MacBook Neo 13" risulta effettivamente utilizzata da Apple per il relativo modello da 13 pollici.`,
  },
  {
    n: 13,
    title: "Premio settimanale",
    body: `Per ogni giornata della Super League viene assegnato un premio al partecipante che ottiene il punteggio più alto nella singola giornata. Il premio settimanale consiste nell'accesso gratuito all'edizione FantaPronostic Super League della stagione successiva, secondo i termini e le condizioni che saranno previsti per tale edizione. Il premio settimanale è assegnato a una sola persona.
In caso di parità di punti nella classifica settimanale, saranno applicati nell'ordine i seguenti criteri: maggior numero di pronostici corretti nella giornata; maggior numero di pronostici corretti nelle partite X3; maggior numero di risultati esatti corretti; maggior numero di esiti 1X2 corretti; maggior punteggio ottenuto nella giornata immediatamente precedente. Se la parità permane, saranno considerate progressivamente le giornate precedenti. Per la prima giornata o qualora non fosse comunque possibile determinare un unico vincitore, sarà effettuato uno spareggio pronostici tra i partecipanti ancora in parità.`,
  },
  {
    n: 14,
    title: "Vittorie settimanali consecutive",
    body: `Se un partecipante vince il premio settimanale per due o più giornate consecutive: per la prima vittoria riceve l'accesso gratuito all'edizione successiva; dalla seconda vittoria consecutiva riceve, in sostituzione, un buono Amazon del valore di 20 euro. La medesima regola si applica a ogni ulteriore vittoria consecutiva.
Quando la serie di vittorie consecutive si interrompe, un'eventuale nuova vittoria futura dà nuovamente diritto all'accesso gratuito all'edizione successiva. La vincita di uno o più premi settimanali non impedisce al partecipante di concorrere per i premi finali.`,
  },
  {
    n: 15,
    title: "Partite rinviate, sospese o annullate",
    body: `Nel caso in cui una partita venga rinviata prima della chiusura dei pronostici, FantaPronostic potrà: sostituirla con un'altra partita; mantenerla nella giornata; escluderla dal calcolo dei punteggi.
Nel caso in cui il rinvio avvenga dopo la chiusura dei pronostici, la partita sarà considerata valida soltanto se disputata entro il termine indicato dall'Organizzatore per la chiusura definitiva della giornata. In caso contrario, la partita sarà annullata ai fini del gioco e non assegnerà punti.
Per le partite sospese o interrotte sarà utilizzato il risultato ufficialmente riconosciuto dalla competizione di riferimento. Qualora venga disposto il completo rifacimento della partita, sarà considerato il risultato della nuova gara.`,
  },
  {
    n: 16,
    title: "Risultato valido",
    body: `Salvo diversa indicazione, i pronostici si riferiscono al risultato maturato al termine dei tempi regolamentari, compreso il recupero. Non vengono considerati: tempi supplementari; calci di rigore; eventuali risultati successivi al termine dei tempi regolamentari.`,
  },
  {
    n: 17,
    title: "Problemi tecnici",
    body: `Il partecipante è responsabile della corretta connessione internet, del dispositivo utilizzato e dell'inserimento dei pronostici entro il termine previsto.
In presenza di un malfunzionamento generale e verificabile dei sistemi FantaPronostic, l'Organizzatore potrà: prorogare il termine, purché nessuna partita sia ancora iniziata; annullare la giornata; riprogrammare le partite; adottare una soluzione uniforme per tutti i partecipanti coinvolti. Non potranno essere inseriti manualmente pronostici dopo l'inizio della prima partita.`,
  },
  {
    n: 18,
    title: "Condotte vietate",
    body: `È vietato: creare o utilizzare più account; partecipare utilizzando dati falsi; alterare o tentare di alterare i sistemi; utilizzare bot, script o procedure automatizzate; sfruttare consapevolmente errori tecnici; cedere il proprio account ad altri partecipanti; coordinare account multipli riconducibili alla stessa persona.
In caso di comportamento irregolare, FantaPronostic potrà sospendere o escludere il partecipante, annullare i punti ottenuti e non assegnare eventuali premi.`,
  },
  {
    n: 19,
    title: "Comunicazione e consegna dei premi",
    body: `I vincitori saranno contattati attraverso: l'indirizzo email associato all'account; una comunicazione all'interno dell'app; eventuali altri recapiti forniti dal partecipante.
Il vincitore dovrà rispondere entro 10 giorni dalla comunicazione e fornire i dati necessari alla verifica dell'identità e alla consegna. In caso di mancata risposta entro il termine indicato, il premio potrà essere assegnato al partecipante successivo in classifica. Le modalità e i tempi di consegna saranno comunicati direttamente al vincitore.`,
  },
  {
    n: 20,
    title: "Modifiche al calendario",
    body: `FantaPronostic potrà modificare: le partite selezionate; gli orari; il numero delle partite della giornata; le partite X3; il calendario delle giornate; quando ciò sia necessario per rinvii, variazioni dei calendari ufficiali, problemi tecnici o altre circostanze non dipendenti dall'Organizzatore. Le modifiche saranno comunicate attraverso l'app o i canali ufficiali di FantaPronostic.`,
  },
  {
    n: 21,
    title: "Accettazione",
    body: `La partecipazione alla FantaPronostic Super League comporta l'accettazione integrale del presente regolamento, delle condizioni generali del Piano editoriale digitale e delle condizioni di utilizzo dell'app FantaPronostic.`,
  },
];
