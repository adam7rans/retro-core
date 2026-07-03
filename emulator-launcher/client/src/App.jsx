import { useState, useEffect } from 'react';
import './index.css';
import GameProfile from './GameProfile.jsx';

const slugify = (t) =>
  t.toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-');

function getRoute() {
  const path = window.location.pathname;
  const profileMatch = path.match(/^\/games\/(.+)$/);
  if (profileMatch) {
    return { type: 'profile', slug: decodeURIComponent(profileMatch[1]) };
  }
  const platform = path.replace(/^\//, '');
  if (!platform || platform === 'genres') return { type: 'platform', platform: 'all' };
  return { type: 'platform', platform }; // 'history', 'tg16', 'genesis', 'atari2600', etc.
}

function App() {
  const [db, setDb] = useState({ platforms: [], games: [] });
  const [history, setHistory] = useState([]);
  const [route, setRoute] = useState(getRoute);
  const selectedPlatform = route.type === 'platform' ? route.platform : null;
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [toast, setToast] = useState(null);

  const [sortField, setSortField] = useState('startTime');
  const [sortDesc, setSortDesc] = useState(true);
  const [cdOnly, setCdOnly] = useState(false);

  useEffect(() => {
    fetch('/api/games')
      .then(res => res.json())
      .then(data => setDb(data))
      .catch(err => console.error('Failed to parse or fetch games', err));

    const heartbeat = setInterval(() => {
      fetch('/api/ping').catch(() => {});
    }, 5000);

    return () => clearInterval(heartbeat);
  }, []);

  useEffect(() => {
    const onPopState = () => {
      setRoute(getRoute());
      setCdOnly(false);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigateTo = (platformId) => {
    const url = platformId === 'all' ? '/' : `/${platformId}`;
    window.history.pushState(null, '', url);
    setRoute({ type: 'platform', platform: platformId });
    setCdOnly(false);
  };

  const navigateToGame = (slug) => {
    window.history.pushState(null, '', `/games/${slug}`);
    setRoute({ type: 'profile', slug });
    setCdOnly(false);
  };

  const fetchHistory = () => {
    fetch('/api/history')
      .then(r => r.json())
      .then(data => setHistory(data))
      .catch(err => console.error('Failed to fetch history', err));
  };

  useEffect(() => {
    if (selectedPlatform === 'history') {
      fetchHistory();
    }
  }, [selectedPlatform]);

  const handleLaunch = async (gameId) => {
    try {
      const response = await fetch('/api/launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId })
      });
      const result = await response.json();
      if (result.success) {
        showToast(result.message);
      }
    } catch (e) {
      console.error(e);
      showToast('Error launching game.');
    }
  };

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleSort = (field) => {
    if (field === sortField) {
      setSortDesc(!sortDesc);
    } else {
      setSortField(field);
      setSortDesc(true);
    }
  };

  const searchResults = searchQuery.length > 1 ? db.games.filter(g =>
    g.title.toLowerCase().includes(searchQuery.toLowerCase())
  ).slice(0, 10) : [];

  let viewGames = db.games;
  if (selectedPlatform !== 'all' && selectedPlatform !== 'history') {
    viewGames = viewGames.filter(g => g.platformId === selectedPlatform);
  }

  const cdFilterablePlatforms = ['pcengine', 'tg16'];
  const showCdFilter = cdFilterablePlatforms.includes(selectedPlatform) &&
    viewGames.some(g => g.isCD);
  if (showCdFilter && cdOnly) {
    viewGames = viewGames.filter(g => g.isCD);
  }

  const categories = {};
  viewGames.forEach(g => {
    if (!categories[g.category]) categories[g.category] = [];
    categories[g.category].push(g);
  });

  for (const cat in categories) {
    categories[cat].sort((a,b) => a.title.localeCompare(b.title));
  }
  const categoryKeys = Object.keys(categories).sort();

  const sortedHistory = [...history].sort((a, b) => {
    let valA = a[sortField];
    let valB = b[sortField];
    if (valA < valB) return sortDesc ? 1 : -1;
    if (valA > valB) return sortDesc ? -1 : 1;
    return 0;
  });

  const headerTitle =
    selectedPlatform === 'all' ? 'Genres' :
    selectedPlatform === 'history' ? 'Play History' :
    db.platforms.find(p => p.id === selectedPlatform)?.name ?? '';

  const profileGame =
    route.type === 'profile'
      ? db.games.find(g => slugify(g.title) === route.slug)
      : null;

  return (
    <div className="app-container">
      {/* Sidebar */}
      <nav className="sidebar glass-panel">
        <div className="brand">RetroCore</div>
        <ul className="nav-list">
          <li className={`nav-item ${selectedPlatform === 'all' ? 'active' : ''}`}
            onClick={() => navigateTo('all')}>
            Genres
          </li>
          <li className={`nav-item ${selectedPlatform === 'history' ? 'active' : ''}`}
            onClick={() => navigateTo('history')}>
            Play History
          </li>
          {db.platforms.map(p => (
            <li key={p.id}
              className={`nav-item ${selectedPlatform === p.id ? 'active' : ''}`}
              onClick={() => navigateTo(p.id)}
            >
              {p.name}
            </li>
          ))}
        </ul>
      </nav>

      {/* Main Content */}
      {route.type === 'profile' ? (
        <main className="main-content main-content--profile">
          <GameProfile
            slug={route.slug}
            game={profileGame}
            onLaunch={handleLaunch}
            onBack={() => navigateTo('all')}
          />
        </main>
      ) : (
      <main className="main-content">
        <header className="header-area">
          <div className="title-area">
            <h2 style={{ fontFamily: 'var(--font-heading)' }}>{headerTitle}</h2>
            {showCdFilter && (
              <button
                type="button"
                className={`cd-filter ${cdOnly ? 'active' : ''}`}
                onClick={() => setCdOnly(v => !v)}
                title={cdOnly ? 'Show all games' : 'Show only CD-ROM games'}
              >
                <svg viewBox="0 0 32 32" width="18" height="18" aria-hidden="true">
                  <defs>
                    <linearGradient id="cdFilterBase" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#f6f7fb" />
                      <stop offset="35%" stopColor="#c9ccd6" />
                      <stop offset="70%" stopColor="#8d909c" />
                      <stop offset="100%" stopColor="#d2d5de" />
                    </linearGradient>
                    <linearGradient id="cdFilterPrism" x1="0" y1="0" x2="1" y2="1" gradientTransform="rotate(20 0.5 0.5)">
                      <stop offset="0%" stopColor="#ff5f6d" />
                      <stop offset="22%" stopColor="#ffc371" />
                      <stop offset="44%" stopColor="#5eff8b" />
                      <stop offset="66%" stopColor="#5ec8ff" />
                      <stop offset="85%" stopColor="#b06bff" />
                      <stop offset="100%" stopColor="#ff5f6d" />
                    </linearGradient>
                  </defs>
                  <circle cx="16" cy="16" r="15" fill="url(#cdFilterBase)" />
                  <circle cx="16" cy="16" r="15" fill="url(#cdFilterPrism)" style={{ mixBlendMode: 'overlay' }} opacity="0.85" />
                  <circle cx="16" cy="16" r="15" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="0.8" />
                  <circle cx="16" cy="16" r="5" fill="url(#cdFilterBase)" stroke="rgba(0,0,0,0.25)" strokeWidth="0.6" />
                  <circle cx="16" cy="16" r="2.2" fill="#1a1a22" stroke="rgba(255,255,255,0.5)" strokeWidth="0.6" />
                </svg>
                <span>CD-ROM only</span>
              </button>
            )}
          </div>
          <div className="search-wrapper">
            <input
              type="text"
              className="search-input"
              placeholder="Search library..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
            />

            {searchFocused && searchResults.length > 0 && (
              <div className="search-results">
                {searchResults.map(result => (
                  <div key={result.id} className="search-result-item" onClick={() => handleLaunch(result.id)}>
                    <span className="search-result-title">{result.title}</span>
                    <span className="search-result-platform">
                      {db.platforms.find(p => p.id === result.platformId)?.name}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </header>

        {selectedPlatform === 'history' ? (
          <section className="category-section">
            <div className="history-table-container">
              <table className="history-table">
                <thead>
                  <tr>
                    <th onClick={() => handleSort('gameTitle')}>Game Title {sortField === 'gameTitle' && (sortDesc ? '↓' : '↑')}</th>
                    <th onClick={() => handleSort('platformName')}>Platform {sortField === 'platformName' && (sortDesc ? '↓' : '↑')}</th>
                    <th onClick={() => handleSort('startTime')}>Played On {sortField === 'startTime' && (sortDesc ? '↓' : '↑')}</th>
                    <th onClick={() => handleSort('durationSeconds')}>Duration {sortField === 'durationSeconds' && (sortDesc ? '↓' : '↑')}</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedHistory.length === 0 ? (
                    <tr><td colSpan="4" className="empty-history">No play history found. Play a game to record a session!</td></tr>
                  ) : (
                    sortedHistory.map(row => (
                      <tr key={row.id}>
                        <td style={{ fontWeight: 500 }}>{row.gameTitle}</td>
                        <td style={{ color: 'var(--text-muted)' }}>{row.platformName}</td>
                        <td>{new Date(row.startTime).toLocaleString()}</td>
                        <td style={{ color: 'var(--accent-color)' }}>
                          {row.durationSeconds > 60 ? `${(row.durationSeconds/60).toFixed(1)} min` : `${row.durationSeconds} sec`}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        ) : (
          categoryKeys.map(cat => (
            <section key={cat} className="category-section">
              <h3 className="category-title">{cat}</h3>
              <div className="games-grid">
                {categories[cat].map(game => (
                  <div key={game.id} className="card" onClick={() => handleLaunch(game.id)}>
                    {game.isCD && (
                      <span className="cd-badge" title="CD-ROM game" aria-label="CD-ROM game">
                        <svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true">
                          <defs>
                            <linearGradient id="cdBase" x1="0" y1="0" x2="1" y2="1">
                              <stop offset="0%" stopColor="#f6f7fb" />
                              <stop offset="35%" stopColor="#c9ccd6" />
                              <stop offset="70%" stopColor="#8d909c" />
                              <stop offset="100%" stopColor="#d2d5de" />
                            </linearGradient>
                            <linearGradient id="cdPrism" x1="0" y1="0" x2="1" y2="1" gradientTransform="rotate(20 0.5 0.5)">
                              <stop offset="0%" stopColor="#ff5f6d" />
                              <stop offset="22%" stopColor="#ffc371" />
                              <stop offset="44%" stopColor="#5eff8b" />
                              <stop offset="66%" stopColor="#5ec8ff" />
                              <stop offset="85%" stopColor="#b06bff" />
                              <stop offset="100%" stopColor="#ff5f6d" />
                            </linearGradient>
                          </defs>
                          <circle cx="16" cy="16" r="15" fill="url(#cdBase)" />
                          <circle cx="16" cy="16" r="15" fill="url(#cdPrism)" style={{ mixBlendMode: 'overlay' }} opacity="0.85" />
                          <circle cx="16" cy="16" r="15" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="0.8" />
                          <circle cx="16" cy="16" r="9.5" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="0.6" />
                          <circle cx="16" cy="16" r="5" fill="url(#cdBase)" stroke="rgba(0,0,0,0.25)" strokeWidth="0.6" />
                          <circle cx="16" cy="16" r="2.2" fill="#1a1a22" stroke="rgba(255,255,255,0.5)" strokeWidth="0.6" />
                        </svg>
                      </span>
                    )}
                    <div className={`card-art card-art--${game.platformId}`}>
                      {game.art ? (
                        <img src={game.art} alt={game.title} loading="lazy" />
                      ) : (
                        <div className="card-art-placeholder">{game.title}</div>
                      )}
                      <button
                        type="button"
                        className="card-info-btn"
                        onClick={(e) => { e.stopPropagation(); navigateToGame(slugify(game.title)); }}
                        title="View game info"
                      >
                        Info
                      </button>
                      <div className="card-play" aria-hidden="true">
                        <svg viewBox="0 0 24 24" width="26" height="26">
                          <path d="M8 5v14l11-7z" fill="currentColor" />
                        </svg>
                      </div>
                    </div>
                    <div className="title">{game.title}</div>
                    {selectedPlatform === 'all' && (
                      <div className="category">{db.platforms.find(p => p.id === game.platformId)?.name}</div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))
        )}
      </main>
      )}

      {/* Toast Notification */}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

export default App;
