const express = require('express');
const fs = require('fs');
const path = require('path');
const https = require('https');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const DB = path.join(__dirname, 'data.json');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'colts2017';

function readDB() {
  try {
    if (!fs.existsSync(DB)) return { sold: {}, players: {}, winBall: null, month: '', year: '2026' };
    return JSON.parse(fs.readFileSync(DB, 'utf8'));
  } catch(e) {
    return { sold: {}, players: {}, winBall: null, month: '', year: '2026' };
  }
}

function writeDB(data) {
  fs.writeFileSync(DB, JSON.stringify(data), 'utf8');
}

function isFirstSaturday() {
  const now = new Date();
  return now.getDay() === 6 && now.getDate() <= 7;
}

function fetchLotteryBonusBall(callback) {
  // National Lottery results API
  const url = 'https://www.national-lottery.co.uk/results/lotto/draw-history/csv';
  https.get('https://www.lotteryguru.co.uk/api/lotto/latest', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const json = JSON.parse(data);
        const bonus = json.bonusBall || json.bonus_ball || json.bonusball;
        callback(null, parseInt(bonus, 10));
      } catch(e) {
        callback('Could not parse lottery data', null);
      }
    });
  }).on('error', (e) => callback(e.message, null));
}

// Public: get data (everyone can read)
app.get('/api/data', (req, res) => {
  res.json(readDB());
});

// Public: register a player (anyone can add themselves)
app.post('/api/register', (req, res) => {
  const { name, number } = req.body;
  if (!name || !number || number < 1 || number > 59) {
    return res.status(400).json({ error: 'Invalid name or number' });
  }
  const db = readDB();
  if (db.players[number]) {
    return res.status(400).json({ error: 'Number ' + number + ' is already taken by ' + db.players[number] });
  }
  db.players[number] = name;
  db.sold[number] = 1;
  writeDB(db);
  res.json({ ok: true });
});

// Admin: full data update (password required)
app.post('/api/admin', (req, res) => {
  const { password, data } = req.body;
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Wrong password' });
  }
  writeDB(data);
  res.json({ ok: true });
});

// Admin: set winning ball only
app.post('/api/admin/setwin', (req, res) => {
  const { password, winBall } = req.body;
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Wrong password' });
  }
  const db = readDB();
  db.winBall = winBall;
  writeDB(db);
  res.json({ ok: true });
});

// Admin: fetch bonus ball from lottery API
app.post('/api/admin/fetchball', (req, res) => {
  const { password } = req.body;
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Wrong password' });
  }
  fetchLotteryBonusBall((err, ball) => {
    if (err || !ball) {
      return res.status(500).json({ error: 'Could not fetch lottery result. Please enter manually.' });
    }
    const db = readDB();
    db.winBall = ball;
    writeDB(db);
    res.json({ ok: true, ball: ball });
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Running on port ' + PORT));
