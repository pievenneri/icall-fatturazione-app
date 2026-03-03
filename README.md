# Fatture Sub-Agenzie — Installazione NAS Synology

## Struttura del progetto

```
fatture-app/
├── server.js        ← Backend Node.js (API + database)
├── package.json     ← Dipendenze npm
├── fatture.db       ← Database SQLite (creato automaticamente al primo avvio)
└── public/
    └── index.html   ← Frontend (servito dal backend)
```

---

## Installazione su NAS Synology DS223

### 1. Installa Node.js
- Vai su **Package Center** nel DSM
- Cerca **Node.js v18** (o superiore) e installalo

### 2. Carica i file sul NAS
- Apri **File Station**
- Crea la cartella: `/volume1/web/fatture-app`
- Carica tutta la cartella `fatture-app` (server.js, package.json, cartella public/)

### 3. Installa le dipendenze
Apri **Pannello di controllo → Terminale & SNMP → Abilita SSH**

Connettiti via SSH (es. con PuTTY o Terminal):
```bash
ssh admin@[IP-NAS]
cd /volume1/web/fatture-app
npm install
```

### 4. Avvia il server
```bash
node server.js
```

L'app sarà disponibile su: **http://[IP-NAS]:3000**

---

## Avvio automatico con PM2 (consigliato)

PM2 mantiene il server attivo anche dopo il riavvio del NAS.

```bash
# Installa PM2 globalmente
npm install -g pm2

# Avvia l'app
cd /volume1/web/fatture-app
pm2 start server.js --name fatture-app

# Salva la configurazione per il riavvio automatico
pm2 save
pm2 startup
```

---

## Utilizzo

### Tab "Configurazione"
Prima di tutto, configura:
- **Editori/Fornitori**: aggiungi nome e prezzo per lead (es. TTP → 0.07)
- **Sub-Agenzie**: aggiungi le agenzie con il loro codice tag (es. CfComunications → ICALL1)

### Tab "Nuova Emissione"
1. Seleziona l'editore (il prezzo si compila automaticamente)
2. Scegli la data import lista
3. Inserisci il numero di Sub per ogni agenzia
4. Il codice lista e il totale si calcolano in automatico
5. Clicca "Emetti Righe Fattura"

### Tab "Righe Emesse"
- Filtra per Inviate / In Attesa
- Spunta il checkbox "Inviata" quando la fattura è inviata
- Inserisci il numero di fattura e le note direttamente nella tabella
- Scarica i dati in **CSV** (compatibile Excel italiano) o **JSON**

---

## Porta diversa

Per cambiare la porta (es. da 3000 a 8080), modifica `server.js`:
```js
const PORT = 8080; // ← cambia qui
```

---

## Database

Il file `fatture.db` (SQLite) viene creato automaticamente nella stessa cartella di `server.js`.
Fai un backup periodico di questo file per non perdere i dati.
