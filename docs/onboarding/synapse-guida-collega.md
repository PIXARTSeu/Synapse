# Synapse — la memoria del team (guida rapida)

Ciao 👋 Synapse è **già installato e collegato** sul tuo Claude Code: non devi
configurare niente. Questa è solo una spiegazione di *cosa fa* e *come sfruttarlo
al massimo*. 5 minuti di lettura.

---

## Cos'è, in 3 righe

Synapse è la **memoria collettiva** del team più un catalogo di **skill condivise**.
In pratica: quello che l'AI impara lavorando con te — bug risolti, decisioni prese,
tue preferenze — **resta** e torna utile a tutti nelle sessioni future.
Non si riparte mai da zero.

---

## Cosa fa da sola (in automatico)

- **All'inizio** di ogni lavoro, l'AI recupera il contesto: l'ultima sessione su quel
  progetto, cosa restava da fare, le memorie e le skill utili.
- **Durante**, cerca procedure già pronte (skill) e ti propone di salvare le cose
  importanti che scopre.
- **Alla fine**, chiude la sessione registrando cosa è stato fatto e i prossimi passi,
  così la volta dopo si riparte pronti.

Tu non devi "comandare" niente di tutto questo: succede se lasci lavorare l'AI col
suo protocollo.

---

## Le 5 abitudini per sfruttarlo al massimo

1. **Non saltare il riassunto iniziale.** All'avvio l'AI recupera il contesto: dagli
   quei 10 secondi, è ciò che le fa "ricordare".
2. **Quando l'AI chiede "salvo questa memoria?" → rispondi.** Decidi tu cosa entra
   nella memoria del team: approva le cose utili, scarta il resto.
3. **Correggi l'AI quando sbaglia approccio.** Le correzioni diventano memoria: non
   ripeterà lo stesso errore (né lei né i colleghi).
4. **Popola il tuo master.env una volta** (vedi sotto): così l'AI usa le tue chiavi e
   i tuoi servizi quando servono, senza chiedertele ogni volta.
5. **Lascia chiudere la sessione** a fine lavoro: è quello che rende produttiva la
   prossima.

---

## Cosa ci guadagni

- 🧠 **Memoria** — niente più "come avevamo risolto quella cosa?": c'è già.
- 🧩 **Skill** — procedure pronte del team (Next.js, pagamenti, SEO, deploy…): non le
  reinventi ogni volta.
- 🔁 **Continuità** — riprendi esattamente da dove avevi lasciato, anche a giorni di
  distanza.
- 🔐 **Credenziali** — le tue chiavi in un posto solo, l'AI le prende quando servono.

---

## Una cosa da fare ORA (2 minuti)

Apri **memory.fl1.it/#/my-env** e inserisci le chiavi dei servizi che usi (API,
database, ecc.). È il tuo **master.env** personale: l'AI le userà quando servono, senza
chiedertele a mano ogni volta. Le chiavi sono cifrate e restano tue.

---

## Dove guardi le cose

Dashboard: **memory.fl1.it** — da lì vedi le memorie, le skill, lo storico delle
sessioni, il tuo profilo e le tue API key.

---

## FAQ lampo

- **Devo installare qualcosa?** No, è già tutto pronto e collegato.
- **Le mie memorie le vedono tutti?** Dipende dallo *scope*: personale (solo tu), team
  (tutto il team), progetto (chi lavora su quel progetto). Quelle di team sì — è il
  punto: condividere ciò che serve.
- **Se l'AI propone una memoria sbagliata?** La rifiuti e non viene salvata. Decidi tu.
- **Mi serve una skill che non c'è?** Chiedila all'AI: la cerca, e se manca si può
  creare e condividere con il team.
- **Come faccio a essere sicuro che l'AI stia usando Synapse?** Se all'inizio ti dà un
  breve recap dell'ultima sessione e ogni tanto ti propone di salvare memorie, sta
  funzionando. In caso contrario, avvisa Daniel: manca il "doc per AI" nella tua config.
