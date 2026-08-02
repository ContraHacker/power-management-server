import Database from 'bun:sqlite';
import express from 'express';
import path from 'path';


const app = express();
app.use(express.json());
app.use(express.static(path.join(process.cwd(), 'public')));

// SQLite
const db = new Database('power.db');

db.run(`
CREATE TABLE IF NOT EXISTS readings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device TEXT NOT NULL,
  ts INTEGER NOT NULL,
  power INTEGER NOT NULL,
  voltage REAL,
  frequency REAL
);

CREATE INDEX IF NOT EXISTS idx_readings_ts ON readings(ts);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device TEXT NOT NULL,
  ts INTEGER NOT NULL,
  event TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_ts ON events(ts);
`);

const insertReading = db.prepare(`
  INSERT INTO readings (device, ts, power, voltage, frequency)
  VALUES (?, ?, ?, ?, ?)
`);

const insertEvent = db.prepare(`
  INSERT INTO events (device, ts, event)
  VALUES (?, ?, ?)
`);

// POST /api/readings
app.post('/api/readings', (req, res) => {
  const { device, ts, power, voltage, frequency } = req.body;

  if (!device || typeof ts !== 'number' || typeof power !== 'boolean') {
    return res.status(400).json({ error: 'invalid payload' });
  }

  insertReading.run(
    device,
    ts,
    power ? 1 : 0,
    voltage ?? null,
    frequency ?? null
  );

  res.json({ ok: true });
});

// POST /api/events
app.post('/api/events', (req, res) => {
  const { device, ts, event } = req.body;

  if (!device || typeof ts !== 'number' || typeof event !== 'string') {
    return res.status(400).json({ error: 'invalid payload' });
  }

  insertEvent.run(device, ts, event);

  res.json({ ok: true });
});

// GET /api/readings?from=...&to=...
app.get('/api/readings', (req, res) => {
  const from = Number(req.query.from || 0);
  const to = Number(req.query.to || Math.floor(Date.now() / 1000));

  const rows = db.prepare(`
    SELECT device, ts, power, voltage, frequency
    FROM readings
    WHERE ts BETWEEN ? AND ?
    ORDER BY ts ASC
  `).all(from, to);

  res.json(rows);
});

// GET /api/events?from=...&to=...
app.get('/api/events', (req, res) => {
  const from = Number(req.query.from || 0);
  const to = Number(req.query.to || Math.floor(Date.now() / 1000));

  const rows = db.prepare(`
    SELECT device, ts, event
    FROM events
    WHERE ts BETWEEN ? AND ?
    ORDER BY ts ASC
  `).all(from, to);

  res.json(rows);
});

// Health check
app.get('/health', (_, res) => {
  res.json({ ok: true });
});

app.get('/dashboard', (_req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
});

const PORT = 9034;

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
})