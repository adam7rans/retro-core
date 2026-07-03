const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = 3055;

app.use(cors());
app.use(express.json());

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../client/dist')));
// Serve art files directly from client/public/art so it works in dev and prod
app.use('/art', express.static(path.join(__dirname, '../client/public/art')));

const dbPath = path.join(__dirname, 'database.json');
const profilesPath = path.join(__dirname, 'profiles.json');
const artRoot = path.join(__dirname, '../client/public/art');

function loadProfiles() {
  try {
    return JSON.parse(fs.readFileSync(profilesPath, 'utf8'));
  } catch (error) {
    console.error('Error loading profiles.json:', error);
    return {};
  }
}
const artExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];

function loadDatabase() {
  let database = { platforms: [], games: [] };
  try {
    database = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  } catch (error) {
    console.error('Error loading database.json:', error);
    return database;
  }

  // Attach art paths if a matching artwork file exists in client/public/art/<platformId>/<gameId>.<ext>
  for (const game of database.games) {
    const dir = path.join(artRoot, game.platformId);
    if (!fs.existsSync(dir)) continue;
    for (const ext of artExtensions) {
      const file = path.join(dir, game.id + ext);
      if (fs.existsSync(file)) {
        game.art = `/art/${game.platformId}/${encodeURIComponent(game.id + ext)}`;
        break;
      }
    }
  }

  return database;
}

const historyDbPath = path.join(__dirname, 'history.db');
const historyDb = new sqlite3.Database(historyDbPath);

historyDb.serialize(() => {
  historyDb.run(`
    CREATE TABLE IF NOT EXISTS play_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      gameId TEXT,
      gameTitle TEXT,
      platformName TEXT,
      startTime TEXT,
      endTime TEXT,
      durationSeconds INTEGER
    )
  `);
});

app.get('/api/games', (req, res) => {
  const database = loadDatabase();
  res.json(database);
});

app.get('/api/history', (req, res) => {
  historyDb.all('SELECT * FROM play_history ORDER BY startTime DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/launch', (req, res) => {
  const database = loadDatabase();
  const { gameId } = req.body;
  if (!gameId) return res.status(400).json({ error: 'gameId is required' });

  const game = database.games.find(g => g.id === gameId);
  if (!game) return res.status(404).json({ error: 'Game not found' });

  const platform = database.platforms.find(p => p.id === game.platformId);
  if (!platform) return res.status(404).json({ error: 'Platform not found' });

  let cmd = platform.cmd.replace('{rom}', game.rom).replace('{dir}', game.dir || '');
  console.log(`Executing launch command: ${cmd}`);
  
  const startTime = new Date();

  const child = exec(cmd, (error, stdout, stderr) => {
    const endTime = new Date();
    const Math = global.Math;
    const durationSeconds = Math.round((endTime - startTime) / 1000);
    if (error) console.error(`Launch error for "${game.title}": ${error.message}`);
    if (stderr) console.error(`stderr for "${game.title}": ${stderr}`);
    
    // Some emulators run detached and return instantly. but Mednafen mostly blocks.
    historyDb.run(
      `INSERT INTO play_history (gameId, gameTitle, platformName, startTime, endTime, durationSeconds) VALUES (?, ?, ?, ?, ?, ?)`,
      [game.id, game.title, platform.name, startTime.toISOString(), endTime.toISOString(), durationSeconds],
      function (err) {
        if (err) console.error("Error saving history:", err);
      }
    );
  });

  res.json({ success: true, message: `Launched ${game.title}` });
});

app.get('/api/profile/:slug', (req, res) => {
  const profiles = loadProfiles();
  const profile = profiles[req.params.slug];
  if (!profile) return res.status(404).json({ error: 'Profile not found' });
  res.json(profile);
});

app.get('/api/ping', (req, res) => {
  res.json({ success: true });
});

// Serve React App for all other routes
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

app.listen(PORT, () => {
  console.log(`Emulator launcher API & Frontend serving on http://localhost:${PORT}`);
});
