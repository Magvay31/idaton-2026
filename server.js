const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3456;
const DATA_FILE = path.join(__dirname, 'data.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// SSE clients
let sseClients = [];

function readData() {
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function broadcast(event, payload) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  sseClients.forEach(res => res.write(msg));
}

// SSE endpoint
app.get('/api/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  res.write('\n');
  sseClients.push(res);
  req.on('close', () => {
    sseClients = sseClients.filter(c => c !== res);
  });
});

// Get all data
app.get('/api/data', (req, res) => {
  res.json(readData());
});

// Save scores for a judge + team
app.post('/api/scores/:judge/:teamId', (req, res) => {
  const { judge, teamId } = req.params;
  const { business, innovation, readiness, presentation, comment } = req.body;

  if (!['aleksej', 'egor'].includes(judge)) {
    return res.status(400).json({ error: 'Invalid judge' });
  }

  const data = readData();
  if (!data.scores[judge]) data.scores[judge] = {};
  data.scores[judge][teamId] = { business, innovation, readiness, presentation, comment };
  writeData(data);

  broadcast('scores_updated', { judge, teamId });
  res.json({ ok: true });
});

// Trigger reveal
app.post('/api/reveal', (req, res) => {
  const data = readData();
  data.revealed = true;
  writeData(data);
  broadcast('reveal', {});
  res.json({ ok: true });
});

// Reset reveal
app.post('/api/reset', (req, res) => {
  const data = readData();
  data.revealed = false;
  writeData(data);
  broadcast('reset', {});
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`\n  Hackathon Scoring System`);
  console.log(`  http://localhost:${PORT}\n`);
  console.log(`  Judge Aleksej: http://localhost:${PORT}/judge.html?judge=aleksej`);
  console.log(`  Judge Egor:    http://localhost:${PORT}/judge.html?judge=egor`);
  console.log(`  Dashboard:     http://localhost:${PORT}/dashboard.html\n`);
});
