import { useState, useEffect } from 'react';

const VIDEO_TYPES = ['gameplay', 'documentary'];

function GameProfile({ slug, game, onLaunch, onBack }) {
  const [profile, setProfile] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [activeTypes, setActiveTypes] = useState(VIDEO_TYPES);
  const [lightboxIndex, setLightboxIndex] = useState(null);

  const toggleType = (type) => {
    setActiveTypes((prev) =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  // Carousel = the cover art first, followed by the extra gallery images.
  const galleryImages = profile?.gallery || [];
  const coverTitle = profile?.title || game?.title || 'Cover art';
  const carousel = game?.art
    ? [{ src: game.art, caption: coverTitle }, ...galleryImages]
    : galleryImages;

  const closeLightbox = () => setLightboxIndex(null);
  const showPrev = (e) => {
    e.stopPropagation();
    setLightboxIndex(i => (i - 1 + carousel.length) % carousel.length);
  };
  const showNext = (e) => {
    e.stopPropagation();
    setLightboxIndex(i => (i + 1) % carousel.length);
  };

  useEffect(() => {
    if (lightboxIndex === null) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setLightboxIndex(null);
      else if (e.key === 'ArrowRight') setLightboxIndex(i => (i + 1) % carousel.length);
      else if (e.key === 'ArrowLeft') setLightboxIndex(i => (i - 1 + carousel.length) % carousel.length);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxIndex, carousel.length]);

  useEffect(() => {
    let cancelled = false;
    setProfile(null);
    setNotFound(false);
    fetch(`/api/profile/${encodeURIComponent(slug)}`)
      .then(res => {
        if (!res.ok) throw new Error('not found');
        return res.json();
      })
      .then(data => { if (!cancelled) setProfile(data); })
      .catch(() => { if (!cancelled) setNotFound(true); });
    return () => { cancelled = true; };
  }, [slug]);

  const title = profile?.title || game?.title || 'Unknown Game';
  const system = profile?.system || '';
  const shownVideos = profile
    ? profile.videos.filter(v => activeTypes.includes(v.type))
    : [];

  return (
    <div className="profile-columns">
      {/* Column 1 — Art */}
      <div className="profile-art">
        <button type="button" className="profile-back" onClick={onBack}>
          ← Library
        </button>
        <div
          className={`profile-art-frame ${game?.art ? 'profile-art-frame--zoomable' : ''}`}
          onClick={() => { if (game?.art) setLightboxIndex(0); }}
          role={game?.art ? 'button' : undefined}
          title={game?.art ? 'Click to expand' : undefined}
        >
          {game?.art ? (
            <img src={game.art} alt={title} />
          ) : (
            <div className="profile-art-placeholder">{title}</div>
          )}
        </div>
        {game && (
          <button
            type="button"
            className="profile-play"
            onClick={() => onLaunch(game.id)}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path d="M8 5v14l11-7z" fill="currentColor" />
            </svg>
            Play
          </button>
        )}
        {galleryImages.length > 0 && (
          <div className="profile-gallery">
            {galleryImages.map((img, i) => (
              <button
                type="button"
                className="profile-gallery-thumb"
                key={img.src}
                onClick={() => setLightboxIndex(i + 1)}
                title={img.caption}
              >
                <img src={img.src} alt={img.caption} loading="lazy" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Column 2 — Info */}
      <div className="profile-info">
        <h1 className="profile-title">{title}</h1>
        {system && <div className="profile-system">{system}</div>}

        {notFound && (
          <p className="profile-empty">No detailed profile available for this game yet.</p>
        )}

        {profile && (
          <>
            <dl className="profile-facts">
              {profile.facts.map((f, i) => (
                <div className="profile-fact" key={i}>
                  <dt>{f.label}</dt>
                  <dd>{f.value}</dd>
                </div>
              ))}
            </dl>

            {profile.story && profile.story.length > 0 && (
              <div className="profile-story">
                <h2>Story</h2>
                {profile.story.map((p, i) => <p key={i}>{p}</p>)}
              </div>
            )}

            {profile.wikipedia && (
              <a
                className="profile-wiki"
                href={profile.wikipedia}
                target="_blank"
                rel="noopener noreferrer"
              >
                Read more on Wikipedia →
              </a>
            )}
          </>
        )}
      </div>

      {/* Column 3 — Videos */}
      <div className="profile-videos">
        <div className="profile-videos-header">
          <h2 className="profile-videos-heading">Videos</h2>
          <div className="profile-video-filters">
            {VIDEO_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                className={`profile-filter-pill profile-filter-pill--${type} ${activeTypes.includes(type) ? 'active' : ''}`}
                onClick={() => toggleType(type)}
                aria-pressed={activeTypes.includes(type)}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
        {profile && shownVideos.map((v) => (
          <div className="profile-video" key={v.id}>
            <div className="profile-video-frame">
              <iframe
                src={`https://www.youtube.com/embed/${v.id}`}
                title={v.title}
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
            <div className="profile-video-title">{v.title}</div>
            <span className={`profile-video-tag profile-video-tag--${v.type}`}>{v.type}</span>
          </div>
        ))}
        {profile && shownVideos.length === 0 && (
          <p className="profile-empty">No videos match the selected filters.</p>
        )}
      </div>

      {/* Lightbox / carousel overlay */}
      {lightboxIndex !== null && carousel[lightboxIndex] && (
        <div className="lightbox" onClick={closeLightbox}>
          <button
            type="button"
            className="lightbox-close"
            onClick={(e) => { e.stopPropagation(); closeLightbox(); }}
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </button>

          {carousel.length > 1 && (
            <>
              <div className="lightbox-nav lightbox-nav--left" onClick={showPrev} aria-label="Previous image">
                <svg className="lightbox-chevron" viewBox="0 0 24 24" width="40" height="40" aria-hidden="true">
                  <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div className="lightbox-nav lightbox-nav--right" onClick={showNext} aria-label="Next image">
                <svg className="lightbox-chevron" viewBox="0 0 24 24" width="40" height="40" aria-hidden="true">
                  <path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </>
          )}

          <figure className="lightbox-figure" onClick={(e) => e.stopPropagation()}>
            <img
              className="lightbox-img"
              src={carousel[lightboxIndex].src}
              alt={carousel[lightboxIndex].caption}
            />
            <figcaption className="lightbox-caption">
              <span>{carousel[lightboxIndex].caption}</span>
              <span className="lightbox-counter">{lightboxIndex + 1} / {carousel.length}</span>
            </figcaption>
          </figure>
        </div>
      )}
    </div>
  );
}

export default GameProfile;
