# RetroCore

A self-hosted web launcher for a local retro-game collection. RetroCore scans
your ROM/game folders, presents them as a browsable, searchable library with box
art, and launches each title in the appropriate emulator with a single click —
all from your browser.

> **RetroCore ships no games and no box art.** It is a launcher only. You supply
> your own legally-obtained ROMs and the cover art is downloaded on demand. See
> [Copyright, ROMs & Cover Art](#copyright-roms--cover-art).

---

## Architecture

RetroCore is a small two-tier app plus a generator script. The Node/Express
server is the only process that touches the filesystem and launches emulators;
the React client is a pure presentation layer that talks to the server over HTTP.

```diagram
                ╭──────────────────────────╮
                │   ROM / game folders      │
                │  NES/ Genesis/ DOS/ ...   │   (local, git-ignored)
                ╰────────────┬─────────────╯
                             │  scanned by
                             ▼
                ╭──────────────────────────╮
                │   generate_db.py          │   builds the catalog
                ╰────────────┬─────────────╯
                             │  writes
                             ▼
                ╭──────────────────────────╮
                │   server/database.json    │   platforms + games + launch cmds
                ╰────────────┬─────────────╯
                             │  loaded at boot
                             ▼
   browser            ╭──────────────────────────╮        spawns
 ╭──────────╮  HTTP   │   server/index.js         │   ╭────────────────╮
 │  React   │◀──────▶ │   Express API (:3055)     │──▶│  emulator       │
 │  client  │  JSON   │   /api/games /launch ...  │   │  (mednafen,     │
 ╰──────────╯         │   serves /art + client    │   │  dosbox, etc.)  │
                      ╰────────────┬─────────────╯   ╰────────────────╯
                                   │  records sessions
                                   ▼
                      ╭──────────────────────────╮
                      │   server/history.db       │   SQLite play history
                      ╰──────────────────────────╯
```

### Components

| Path | Role |
|------|------|
| `emulator-launcher/client/` | React + Vite single-page app (the UI). |
| `emulator-launcher/server/index.js` | Express API + static file server (port **3055**). |
| `emulator-launcher/server/generate_db.py` | Scans game folders and writes `database.json`. |
| `emulator-launcher/server/download_art.py` | Downloads box art into `client/public/art/`. |
| `emulator-launcher/server/database.json` | Generated catalog (git-ignored — contains local paths). |
| `emulator-launcher/server/history.db` | SQLite play-history log (git-ignored). |
| `*/ROMs/`, `DOS/`, `NES/`, ... | Your local game files (git-ignored). |

---

## How it works

### 1. Cataloging — `generate_db.py`
The generator walks each platform directory (`Genesis/ROMs`, `SMS`, `DOS`,
`TG16/ROMs`, the Atari folders, etc.), derives a title and a stable `id` from
each filename, and writes a single `database.json` containing:

- **`platforms`** — one entry per system with a launch-command template, e.g.
  `genesis` → `mednafen "{rom}"`, `dos` → `cd "{dir}" && dosbox-staging -conf dosbox.conf`.
- **`games`** — `{ id, title, platformId, category, rom, ... }` for every file
  found. PC Engine vs. TurboGrafx-16 is split by region tag; TG16 categories are
  read from `TG16/TG16_Games_Categorized.md`.

Re-run it any time your collection changes:

```bash
python3 emulator-launcher/server/generate_db.py
```

### 2. Serving — `server/index.js`
On boot the server loads `database.json` and, for each game, looks for a matching
art file at `client/public/art/<platformId>/<id>.<ext>`; if found it attaches an
`art` URL. It then exposes:

| Endpoint | Purpose |
|----------|---------|
| `GET /api/games` | The full catalog (platforms + games, with `art` URLs). |
| `POST /api/launch` | Body `{ gameId }` — runs the platform's launch command and records a session. |
| `GET /api/history` | Play history from `history.db`. |
| `GET /api/ping` | Heartbeat used by the client. |
| `GET /art/...` | Static box-art images. |
| `*` | Falls back to the built React app (`client/dist`). |

Launching substitutes `{rom}`/`{dir}` into the platform template and `exec()`s
it, timing the session and inserting a row into `play_history`.

### 3. Presentation — `client/src/App.jsx`
The React app fetches `/api/games`, groups games by category, and renders a card
grid. Each card shows the box art (or a text placeholder) and launches the game
via `POST /api/launch` on click. Cover art is sized per platform in
[`index.css`](emulator-launcher/client/src/index.css) so each system's box
aspect ratio (NES 5:7, Genesis/SMS 5:7, DOS 4:5, TG16/PC Engine 1:1) fits the
card without cropping. There is also a global search and a Play-History view.

### 4. Cover art — `download_art.py`
Box art is **not** stored in git. It is fetched from the public
[libretro-thumbnails](https://github.com/libretro-thumbnails) project into
`client/public/art/<platformId>/<id>.png`. The included
[`download_art.py`](emulator-launcher/server/download_art.py) handles Genesis,
Master System and DOS (mapping each game id to the correct No-Intro / thumbnail
name). The server picks up any image that matches a game id automatically.

```bash
python3 emulator-launcher/server/download_art.py
```

---

## Setup

Prerequisites: **Node.js**, **Python 3**, and whichever emulators you use
(e.g. `mednafen`, `dosbox-staging`, RetroArch, Stella, VICE — install via
Homebrew).

```bash
# 1. Install server + client dependencies
cd emulator-launcher/server && npm install
cd ../client && npm install

# 2. Point the platform folders at your own ROMs, then build the catalog
python3 ../server/generate_db.py

# 3. (optional) Download cover art
python3 ../server/download_art.py

# 4. Build the client and start the server
npm run build            # in emulator-launcher/client
node ../server/index.js  # serves UI + API on http://localhost:3055
```

For development, run the Vite dev server (`npm run dev` in `client/`) alongside
the API. On macOS the `RetroCore.app` / `StartRetroCore.command` wrappers start
the server and open the browser for you.

---

## Copyright, ROMs & Cover Art

**RetroCore contains no copyrighted game data of any kind.** It is purely a
launcher and catalog tool. The following are deliberately excluded from this
repository (see [`.gitignore`](.gitignore)):

- **ROMs and disc images** — every `ROMs/`, `CD-ROMs/`, `DOS/`, `NES/`, `SMS/`,
  and `Arcade/` folder, plus all ROM/disc file types (`.nes`, `.smc`, `.pce`,
  `.z64`, `.iso`, `.chd`, the Genesis `.md`/`.bin` ROMs, etc.).
- **Cover art** — `client/public/art/` (libretro box-art scans, ~300 MB).
- **The generated `database.json`** — it embeds absolute paths to your local
  files.
- **Personal/runtime data** — `history.db`, save/NVRAM data, logs, `.claude/`.

### Your responsibilities

Video-game ROMs, disc images, and box-art scans are **copyrighted works**.
Downloading or distributing them without owning the original game and/or without
the rights-holder's permission is illegal in most jurisdictions. The legality of
making personal backups of games you own varies by country.

- Only use RetroCore with games **you legally own**.
- This project does not host, link to, or endorse any source of pirated ROMs.
- The helper scripts in this repo (`download_roms.py`, `find_rom.py`,
  `download_art.py`) are convenience tools that reference third-party sites such
  as the Internet Archive; you are responsible for ensuring your use of them
  complies with applicable law and each site's terms.
- Cover art is fetched from the community libretro-thumbnails project and remains
  the property of its respective rights holders; it is used here for personal,
  non-commercial cataloging only.

The author of RetroCore assumes no liability for how this software is used. If
you are a rights holder and have a concern, please open an issue.
