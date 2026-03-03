/**
 * FATTURE SUB-AGENZIE - Backend
 * Stack: Node.js + Express + better-sqlite3
 *
 * Installazione sul NAS Synology:
 *   1. Installa il pacchetto "Node.js" dal Package Center
 *   2. Carica questa cartella sul NAS (es. /volume1/web/fatture-app)
 *   3. Apri SSH sul NAS e vai nella cartella:
 *        cd /volume1/web/fatture-app
 *   4. npm install
 *   5. node server.js
 *   (Opzionale: usa PM2 per tenerlo attivo — npm install -g pm2 && pm2 start server.js)
 *
 * L'app sarà disponibile su: http://[IP-NAS]:3000
 */

const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;
const DB_PATH = path.join(__dirname, 'fatture.db');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─────────────────────────────────────────────
// DATABASE INIT
// ─────────────────────────────────────────────
const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS editori (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    prezzo_lead REAL NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS agenzie (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL UNIQUE,
    codice_tag TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS righe_fattura (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data_import TEXT NOT NULL,
    editore TEXT NOT NULL,
    prezzo_lead REAL NOT NULL,
    agenzia TEXT NOT NULL,
    sub INTEGER NOT NULL,
    totale REAL NOT NULL,
    codice_lista TEXT NOT NULL,
    inviata INTEGER DEFAULT 0,
    num_fattura TEXT DEFAULT '',
    note TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// Seed agenzie default se vuote
const countAgenzie = db.prepare('SELECT COUNT(*) as c FROM agenzie').get();
if (countAgenzie.c === 0) {
  const insertAg = db.prepare('INSERT OR IGNORE INTO agenzie (nome, codice_tag) VALUES (?, ?)');
  insertAg.run('CfComunications', 'ICALL1');
  insertAg.run('Starcall', 'ICALL4');
  insertAg.run('Medusa', 'ICALL6');
}

// ─────────────────────────────────────────────
// EDITORI
// ─────────────────────────────────────────────
app.get('/api/editori', (req, res) => {
  const rows = db.prepare('SELECT * FROM editori ORDER BY created_at DESC').all();
  res.json(rows);
});

app.post('/api/editori', (req, res) => {
  const { nome, prezzo_lead } = req.body;
  if (!nome || prezzo_lead == null) return res.status(400).json({ error: 'Dati mancanti' });
  const stmt = db.prepare('INSERT INTO editori (nome, prezzo_lead) VALUES (?, ?)');
  const info = stmt.run(nome.trim().toUpperCase(), parseFloat(prezzo_lead));
  res.json({ id: info.lastInsertRowid, nome, prezzo_lead });
});

app.delete('/api/editori/:id', (req, res) => {
  db.prepare('DELETE FROM editori WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ─────────────────────────────────────────────
// AGENZIE
// ─────────────────────────────────────────────
app.get('/api/agenzie', (req, res) => {
  const rows = db.prepare('SELECT * FROM agenzie ORDER BY id').all();
  res.json(rows);
});

app.post('/api/agenzie', (req, res) => {
  const { nome, codice_tag } = req.body;
  if (!nome || !codice_tag) return res.status(400).json({ error: 'Dati mancanti' });
  try {
    const info = db.prepare('INSERT INTO agenzie (nome, codice_tag) VALUES (?, ?)').run(nome.trim(), codice_tag.trim().toUpperCase());
    res.json({ id: info.lastInsertRowid, nome, codice_tag });
  } catch (e) {
    res.status(409).json({ error: 'Agenzia già esistente' });
  }
});

app.delete('/api/agenzie/:id', (req, res) => {
  db.prepare('DELETE FROM agenzie WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ─────────────────────────────────────────────
// RIGHE FATTURA
// ─────────────────────────────────────────────
app.get('/api/righe', (req, res) => {
  const rows = db.prepare('SELECT * FROM righe_fattura ORDER BY created_at DESC').all();
  res.json(rows);
});

app.post('/api/righe', (req, res) => {
  const { righe } = req.body; // array
  if (!Array.isArray(righe) || righe.length === 0) return res.status(400).json({ error: 'Nessuna riga' });

  const stmt = db.prepare(`
    INSERT INTO righe_fattura (data_import, editore, prezzo_lead, agenzia, sub, totale, codice_lista, note)
    VALUES (@data_import, @editore, @prezzo_lead, @agenzia, @sub, @totale, @codice_lista, @note)
  `);

  const insertMany = db.transaction((rows) => {
    const ids = [];
    for (const r of rows) {
      const info = stmt.run(r);
      ids.push(info.lastInsertRowid);
    }
    return ids;
  });

  const ids = insertMany(righe);
  res.json({ ok: true, ids });
});

app.patch('/api/righe/:id', (req, res) => {
  const { inviata, num_fattura, note } = req.body;
  const updates = [];
  const params = [];
  if (inviata !== undefined) { updates.push('inviata = ?'); params.push(inviata ? 1 : 0); }
  if (num_fattura !== undefined) { updates.push('num_fattura = ?'); params.push(num_fattura); }
  if (note !== undefined) { updates.push('note = ?'); params.push(note); }
  if (updates.length === 0) return res.status(400).json({ error: 'Nessun campo da aggiornare' });
  params.push(req.params.id);
  db.prepare(`UPDATE righe_fattura SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  res.json({ ok: true });
});

app.delete('/api/righe/:id', (req, res) => {
  db.prepare('DELETE FROM righe_fattura WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.delete('/api/righe', (req, res) => {
  db.prepare('DELETE FROM righe_fattura').run();
  res.json({ ok: true });
});

// ─────────────────────────────────────────────
// EXPORT CSV
// ─────────────────────────────────────────────
app.get('/api/export/csv', (req, res) => {
  const rows = db.prepare('SELECT * FROM righe_fattura ORDER BY created_at DESC').all();

  const headers = ['ID','Data Import','Editore','Agenzia','Sub','Prezzo Lead','Totale (no IVA)','Codice Lista','Inviata','N° Fattura','Note','Creato il'];
  const lines = [headers.join(';')];

  for (const r of rows) {
    lines.push([
      r.id,
      r.data_import,
      r.editore,
      r.agenzia,
      r.sub,
      r.prezzo_lead.toString().replace('.', ','),
      r.totale.toString().replace('.', ','),
      r.codice_lista,
      r.inviata ? 'SI' : 'NO',
      r.num_fattura || '',
      (r.note || '').replace(/;/g, ','),
      r.created_at
    ].join(';'));
  }

  const csv = lines.join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="righe_fatture_${new Date().toISOString().slice(0,10)}.csv"`);
  res.send('\uFEFF' + csv); // BOM per Excel italiano
});

// ─────────────────────────────────────────────
// EXPORT JSON
// ─────────────────────────────────────────────
app.get('/api/export/json', (req, res) => {
  const rows = db.prepare('SELECT * FROM righe_fattura ORDER BY created_at DESC').all();
  res.setHeader('Content-Disposition', `attachment; filename="righe_fatture_${new Date().toISOString().slice(0,10)}.json"`);
  res.json(rows);
});

// ─────────────────────────────────────────────
// SERVE FRONTEND
// ─────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Fatture App attiva su http://localhost:${PORT}`);
});
