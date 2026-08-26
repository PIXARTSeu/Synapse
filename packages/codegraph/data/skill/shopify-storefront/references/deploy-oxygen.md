# Deploy, Oxygen e go-live

## Indice
- [Environment](#environment)
- [Deploy](#deploy)
- [CI/CD](#cicd)
- [Runtime e limiti Oxygen](#runtime-e-limiti-oxygen)
- [Self-hosting](#self-hosting)
- [Checklist di produzione](#checklist-di-produzione)
- [Go-live e migrazione da un tema Liquid](#go-live-e-migrazione-da-un-tema-liquid)

---

## Environment

Ogni storefront Hydrogen ha più environment (tipicamente Production + Preview + branch custom), ognuno con le proprie variabili. Si gestiscono dall'app canale Hydrogen nell'admin o da CLI:

```bash
npx shopify hydrogen env list
npx shopify hydrogen env pull    # remoto → .env locale
npx shopify hydrogen env push    # .env locale → remoto
```

I development store **non hanno environment pubblici**: ogni URL di deploy richiede il login allo store. Il numero di environment pubblici dipende dal piano.

---

## Deploy

```bash
npx shopify hydrogen deploy
```

Il comando builda, crea un deployment Oxygen e restituisce un preview link. Per i test si sceglie l'environment **Preview**; la produzione va promossa solo dopo verifica.

Prima di deployare vale la pena passare da:

```bash
npx shopify hydrogen build
npx shopify hydrogen preview   # la build di produzione, in locale
```

`preview` gira sulla build reale, non sul dev server: intercetta i problemi che esistono solo in produzione (CSP, variabili mancanti, codice che assume Node).

---

## CI/CD

Due strade:

- **GitHub integration** — si collega il repo dall'app canale Hydrogen; ogni push crea un deployment, ogni PR un preview environment. È la via di default.
- **CI/CD custom** — si usa il token Oxygen come secret e si chiama il deploy dalla pipeline (GitHub Actions, GitLab, ecc.):

```yaml
- run: npx shopify hydrogen deploy --token ${{ secrets.OXYGEN_DEPLOYMENT_TOKEN }}
```

Il token si genera dall'app canale Hydrogen. Non committarlo mai.

---

## Runtime e limiti Oxygen

Oxygen è un runtime worker basato su `workerd` (open source di Cloudflare). Supporta le web standard API: `fetch`, Cache, Streams, Web Crypto, `URL`, `TextEncoder`. **Non è Node**: molte API Node non esistono.

Conseguenze pratiche, da valutare *prima* di scegliere una dipendenza:

- Niente `fs`, `path`, `child_process`
- Librerie che assumono Node (molti SDK, alcuni client di database, `sharp`, gran parte dei tool di image processing) non funzionano
- Preferisci sempre pacchetti "edge-compatible" / "runtime agnostic"

Limiti hard:

| Limite | Valore |
|---|---|
| Dimensione worker | 10 MB |
| Startup time | 400 ms |
| CPU per richiesta | 30 s |
| Memoria | 128 MB |
| Variabili d'ambiente custom | 110 |
| Richieste in uscita | completate entro 2 minuti |
| Immagini / video / 3D / altri file | 20 MB / 1 GB / 500 MB / 20 MB |

Il worker deve chiamarsi `index.js` (`index.js.map` per la source map) — se ne occupa il build di Hydrogen.

**Niente proxy davanti a Oxygen.** Un proxy entra in conflitto col sistema anti-bot e causa problemi SEO: le richieste devono arrivare direttamente a Oxygen.

Se superi i 10 MB: controlla le dipendenze pesanti importate lato server, le icone importate in blocco, i dataset JSON inclusi nel bundle. `npx shopify hydrogen debug cpu` aiuta invece sul tempo di startup.

Oxygen è incluso senza costi aggiuntivi sui piani Starter, Basic, Grow, Advanced, Plus e Pause-and-build. Non disponibile sui piani Agentic.

---

## Self-hosting

Hydrogen può essere ospitato fuori da Oxygen (Node server, altri edge runtime). Si perdono full-page cache integrata, environment e deployment gestiti — vanno ricostruiti. Ha senso solo con un vincolo reale (infrastruttura aziendale, requisiti di data residency); altrimenti Oxygen è incluso nel piano e integrato con la CDN Shopify.

---

## Checklist di produzione

**Operations**

- [ ] Log drain configurato verso il provider di logging (piani Plus)
- [ ] Trace export verso l'endpoint HTTP scelto (piani Plus)
- [ ] Monitoring: uptime, error rate, performance score
- [ ] Alert su eventi e metriche critiche verso il team giusto
- [ ] Piano di rollout con setup del dominio
- [ ] Processo di incident response, incluso il rollback di emergenza
- [ ] Merchant Success Manager avvisato del lancio (piani Plus)

**Sicurezza e resilienza**

- [ ] `package-lock.json` / `yarn.lock` committato
- [ ] Piano di degradazione per i servizi upstream (CMS, API terze) lenti o giù
- [ ] Load test coordinato con Shopify — **3-5 settimane di anticipo**, altrimenti l'anti-bot lo scambia per traffico malevolo e lo throttla

**Performance**

- [ ] Strategie di cache esplicite su tutte le query
- [ ] Bundle server sotto i limiti; asset statici ottimizzati
- [ ] Subrequest profiler passato sulle pagine chiave
- [ ] Nessun dato cliente in cache condivisa (vedi `data-e-caching.md`)

**Analytics e feed**

- [ ] Shopify Analytics configurato e verificato con ordini di test
- [ ] Cataloghi Meta e Google aggiornati al nuovo dominio (feed rules o tool terzo)

---

## Go-live e migrazione da un tema Liquid

- **Ordini esistenti:** redirigi le vecchie URL di order status verso l'online store, altrimenti i clienti con ordini in corso prendono 404
- **Redirect:** aggancia `storefrontRedirect` in `server.js` così i redirect configurati nell'admin continuano a valere
- **URL prodotto:** mantieni `/products/:handle`; se cambi struttura, servono redirect 3XX server-side
- **Traffico:** il passaggio effettivo avviene ridirigendo il traffico verso il canale Hydrogen
- **Cart permalink:** verifica che funzionino, li usano campagne, email e app terze

Ultimo controllo prima di aprire: apri il preview link, aggiungi al carrello, vai fino al checkout, completa un ordine di test, e verifica che compaia in Shopify Analytics. Se questo giro funziona end-to-end, il resto sono dettagli.
