const express = require('express');
const path = require('path');
const { MongoClient } = require('mongodb');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'colts2017';
const MONGODB_URI = process.env.MONGODB_URI;

let db, collection;

async function connectDB() {
  try {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    db = client.db('largscolts');
    collection = db.collection('bonusball');
    console.log('MongoDB connected');
  } catch(e) {
    console.error('MongoDB connection error:', e.message);
  }
}

async function readDB() {
  try {
    const doc = await collection.findOne({ _id: 'state' });
    if (!doc) return { players: {}, winBall: null, month: '', year: '2026' };
    return { players: doc.players || {}, winBall: doc.winBall || null, month: doc.month || '', year: doc.year || '2026' };
  } catch(e) {
    console.error('readDB error:', e.message);
    return { players: {}, winBall: null, month: '', year: '2026' };
  }
}

async function writeDB(data) {
  try {
    await collection.updateOne(
      { _id: 'state' },
      { $set: { players: data.players, winBall: data.winBall, month: data.month, year: data.year } },
      { upsert: true }
    );
    return true;
  } catch(e) {
    console.error('writeDB error:', e.message);
    return false;
  }
}

// Public: get data
app.get('/api/data', async (req, res) => {
  const data = await readDB();
  res.json(data);
});

// Public: register
app.post('/api/register', async (req, res) => {
  try {
    const { name, number } = req.body;
    const num = parseInt(number, 10);
    if (!name || !num || num < 1 || num > 59) {
      return res.status(400).json({ error: 'Invalid name or number' });
    }
    const data = await readDB();
    if (data.players[num]) {
      return res.status(400).json({ error: 'Number ' + num + ' is already taken by ' + data.players[num] });
    }
    data.players[num] = name;
    const saved = await writeDB(data);
    if (!saved) return res.status(500).json({ error: 'Could not save — please try again' });
    res.json({ ok: true });
  } catch(e) {
    console.error('register error:', e.message);
    res.status(500).json({ error: 'Server error: ' + e.message });
  }
});

// Admin: save full state
app.post('/api/admin', async (req, res) => {
  const { password, data } = req.body;
  if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Wrong password' });
  await writeDB(data);
  res.json({ ok: true });
});

// Admin: set winning ball
app.post('/api/admin/setwin', async (req, res) => {
  const { password, winBall } = req.body;
  if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Wrong password' });
  const data = await readDB();
  data.winBall = winBall;
  await writeDB(data);
  res.json({ ok: true });
});

// Admin: fetch bonus ball from lottery
app.post('/api/admin/fetchball', async (req, res) => {
  const { password } = req.body;
  if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Wrong password' });
  res.status(500).json({ error: 'Auto-fetch unavailable — please enter the bonus ball manually.' });
});

// Admin: delete player
app.post('/api/admin/delete', async (req, res) => {
  const { password, number } = req.body;
  if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Wrong password' });
  const data = await readDB();
  delete data.players[number];
  await writeDB(data);
  res.json({ ok: true });
});

// Health check
app.get('/api/health', async (req, res) => {
  const data = await readDB();
  res.json({ status: 'ok', players: Object.keys(data.players).length });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
connectDB().then(() => {
  app.listen(PORT, () => console.log('Running on port ' + PORT));
});
