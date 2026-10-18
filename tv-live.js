/* BOXPLAYTV live television. Uses the existing React and Hls globals. */
(function () {
  'use strict';
  const h = React.createElement;
  const { useState, useEffect, useMemo, useRef } = React;
  const key = c => String(c.id || c.title || c.url);
  const fold = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  function category(c) {
    const g = fold(c.group);
    if (/noticia|news/.test(g)) return 'Noticias';
    if (/deport|sport/.test(g)) return 'Deportes';
    if (/infantil|cartoon|kids|animad/.test(g + ' ' + fold(c.title))) return 'Infantiles';
    if (/pelicula|cine|western|oeste/.test(g + ' ' + fold(c.title))) return 'Cine';
    if (/retro|clasic/.test(g)) return 'Clásicos';
    if (/religio|cristian|catolic/.test(g)) return 'Religiosos';
    return 'Entretenimiento';
  }
  function readRecent() { try { const r = JSON.parse(localStorage.getItem('boxplay_tv_recent') || '[]'); return Array.isArray(r) ? r.filter(x => typeof x === 'string').slice(0, 12) : []; } catch (_) { return []; } }
  function Logo({ channel }) {
    const [failed, setFailed] = useState(false);
    useEffect(() => setFailed(false), [channel.image]);
    return h('span', { className: 'bxtv-logo' }, channel.image && !failed ? h('img', { src: channel.image, alt: '', loading: 'lazy', onError: () => setFailed(true) }) : h('span', null, (channel.title || 'TV').slice(0, 2).toUpperCase()));
  }
  function LivePlayer({ channel, attempt, onStatus }) {
    const videoRef = useRef(null);
    const url = channel ? channel.url : '';
    const direct = /\.(m3u8|mp4|webm)(?:[?#]|$)/i.test(url);
    useEffect(() => {
      if (!channel) { onStatus('idle'); return; }
      if (!direct) { onStatus('external'); return; }
      const video = videoRef.current;
      let active = true, engine, timeout;
      const update = value => { if (active) onStatus(value); };
      const clear = () => clearTimeout(timeout);
      const waiting = () => { update('loading'); clear(); timeout = setTimeout(() => update('error'), 25000); };
      const playing = () => { clear(); update('playing'); };
      const failed = () => { clear(); update('error'); };
      const paused = () => { clear(); update('paused'); };
      const play = () => { const promise = video.play(); if (promise) promise.catch(error => { if (error.name === 'NotAllowedError') paused(); else if (error.name !== 'AbortError') failed(); }); };
      video.addEventListener('playing', playing); video.addEventListener('waiting', waiting);
      video.addEventListener('error', failed); video.addEventListener('pause', paused);
      video.addEventListener('ended', failed);
      waiting();
      if (/\.m3u8(?:[?#]|$)/i.test(url) && !video.canPlayType('application/vnd.apple.mpegurl')) {
        if (window.Hls && Hls.isSupported()) {
          engine = new Hls({ maxBufferLength: 30, maxMaxBufferLength: 60, capLevelToPlayerSize: true });
          engine.on(Hls.Events.MEDIA_ATTACHED, () => engine.loadSource(url));
          engine.on(Hls.Events.MANIFEST_PARSED, play);
          engine.on(Hls.Events.ERROR, (_, data) => { if (data.fatal) { engine.stopLoad(); failed(); } });
          engine.attachMedia(video);
        } else { clear(); update('unsupported'); }
      } else { video.src = url; video.addEventListener('loadedmetadata', play); video.load(); }
      return () => {
        active = false; clear(); if (engine) engine.destroy();
        video.removeEventListener('playing', playing); video.removeEventListener('waiting', waiting);
        video.removeEventListener('error', failed); video.removeEventListener('pause', paused);
        video.removeEventListener('ended', failed); video.removeEventListener('loadedmetadata', play);
        video.pause(); video.removeAttribute('src'); video.load();
      };
    }, [url, attempt, direct]);
    if (!channel) return null;
    if (!direct) return h('iframe', { key: attempt, src: url, title: 'Transmisión de ' + channel.title, allow: 'autoplay; encrypted-media; fullscreen; picture-in-picture', allowFullScreen: true, onError: () => onStatus('error') });
    return h('video', { ref: videoRef, controls: true, playsInline: true, preload: 'metadata', 'aria-label': 'Transmisión de ' + channel.title });
  }
  window.BoxTVLive = function BoxTVLive({ channels, favorites, selected, onSelect, onFavorite, onClose, loading }) {
    const [query, setQuery] = useState(''), [group, setGroup] = useState('Todas'), [view, setView] = useState('Todos');
    const [recent, setRecent] = useState(readRecent), [status, setStatus] = useState('idle'), [attempt, setAttempt] = useState(0);
    const [full, setFull] = useState(false);
    const player = useRef(null), lastSelected = useRef('');
    const favoriteKeys = useMemo(() => new Set(favorites.map(key)), [favorites]);
    const groups = useMemo(() => ['Todas', ...Array.from(new Set(channels.map(category))).sort((a, b) => a.localeCompare(b, 'es'))], [channels]);
    const shown = useMemo(() => {
      let result = channels.filter(c => (!query || fold(c.title).includes(fold(query))) && (group === 'Todas' || category(c) === group) && (view !== 'Favoritos' || favoriteKeys.has(key(c))) && (view !== 'Recientes' || recent.includes(key(c))));
      if (view === 'Recientes') result = result.slice().sort((a, b) => recent.indexOf(key(a)) - recent.indexOf(key(b)));
      return result;
    }, [channels, query, group, view, favoriteKeys, recent]);
    useEffect(() => {
      if (!selected) { lastSelected.current = ''; return; }
      const id = key(selected);
      if (lastSelected.current === id) return;
      lastSelected.current = id;
      setRecent(previous => { const next = [id, ...previous.filter(x => x !== id)].slice(0, 12); try { localStorage.setItem('boxplay_tv_recent', JSON.stringify(next)); } catch (_) {} return next; });
    }, [selected]);
    useEffect(() => { const change = () => setFull(!!(document.fullscreenElement || document.webkitFullscreenElement)); document.addEventListener('fullscreenchange', change); document.addEventListener('webkitfullscreenchange', change); return () => { document.removeEventListener('fullscreenchange', change); document.removeEventListener('webkitfullscreenchange', change); }; }, []);
    const choose = c => { setStatus('loading'); setAttempt(x => x + 1); onSelect(c); };
    const next = direction => { const pool = shown.length ? shown : channels; if (!pool.length) return; const i = pool.findIndex(c => selected && key(c) === key(selected)); choose(pool[i < 0 ? (direction > 0 ? 0 : pool.length - 1) : (i + direction + pool.length) % pool.length]); };
    const fullscreen = () => {
      if (document.fullscreenElement) { document.exitFullscreen().catch(() => {}); return; }
      if (document.webkitFullscreenElement && document.webkitExitFullscreen) { document.webkitExitFullscreen(); return; }
      const node = player.current; const video = node && node.querySelector('video');
      if (node && node.requestFullscreen) node.requestFullscreen().catch(() => { if (video && video.webkitEnterFullscreen) video.webkitEnterFullscreen(); });
      else if (video && video.webkitEnterFullscreen) video.webkitEnterFullscreen();
      else if (node && node.webkitRequestFullscreen) node.webkitRequestFullscreen();
    };
    const error = ['error', 'unsupported'].includes(status);
    const statuses = { idle: 'Elige un canal', loading: 'Conectando con la señal…', playing: 'Reproduciendo en directo', paused: 'Pulsa reproducir para continuar', error: 'No se pudo reproducir esta señal', unsupported: 'Esta señal no es compatible con este navegador', external: 'Reproductor del canal' };
    const button = (label, action, text, disabled) => h('button', { type: 'button', title: label, 'aria-label': label, onClick: action, disabled: !!disabled }, text);
    return h('section', { className: 'bxtv', 'aria-label': 'Televisión en directo' },
      h('header', { className: 'bxtv-heading' }, h('div', null, h('p', { className: 'bxtv-eyebrow' }, 'BOXPLAY', h('span', null, 'TV'), ' / EN DIRECTO'), h('h1', null, 'Tu próxima señal favorita.'), h('p', { className: 'bxtv-subtitle' }, 'Noticias, cine y entretenimiento. TV gratuita en la web.')), h('span', { className: 'bxtv-count' }, channels.length, ' canales')),
      h('div', { className: 'bxtv-layout' },
        h('aside', { className: 'bxtv-directory', 'aria-label': 'Lista de canales' },
          h('div', { className: 'bxtv-filters' },
            h('div', { className: 'bxtv-tabs', 'aria-label': 'Filtrar canales' }, ['Todos', 'Favoritos', 'Recientes'].map(tab => h('button', { key: tab, type: 'button', 'aria-pressed': view === tab, onClick: () => setView(tab) }, tab))),
            h('label', { className: 'bxtv-search' }, h('span', { className: 'bxtv-sr' }, 'Buscar canal'), h('span', { 'aria-hidden': true }, '⌕'), h('input', { type: 'search', placeholder: 'Buscar un canal…', value: query, onChange: e => setQuery(e.target.value) })),
            h('label', { className: 'bxtv-category' }, h('span', null, 'Categoría'), h('select', { value: group, onChange: e => setGroup(e.target.value) }, groups.map(g => h('option', { key: g, value: g }, g)))),
            h('p', { className: 'bxtv-result-count', 'aria-live': 'polite' }, shown.length, shown.length === 1 ? ' canal disponible en la lista' : ' canales en la lista')),
          h('div', { className: 'bxtv-channel-list' }, loading && !channels.length ? h('p', { className: 'bxtv-empty' }, 'Cargando canales…') : shown.length ? shown.map(c => h('div', { key: key(c), className: 'bxtv-channel' + (selected && key(c) === key(selected) ? ' is-selected' : '') },
            h('button', { type: 'button', className: 'bxtv-channel-select', 'aria-pressed': !!selected && key(c) === key(selected), onClick: () => choose(c) }, h(Logo, { channel: c }), h('span', { className: 'bxtv-channel-copy' }, h('strong', null, c.title), h('small', null, category(c))), selected && key(c) === key(selected) && h('span', { className: 'bxtv-bars' + (status === 'playing' ? ' is-playing' : ''), 'aria-hidden': true }, h('i'), h('i'), h('i'))),
            h('button', { type: 'button', className: 'bxtv-favorite', 'aria-label': (favoriteKeys.has(key(c)) ? 'Quitar de favoritos: ' : 'Añadir a favoritos: ') + c.title, 'aria-pressed': favoriteKeys.has(key(c)), onClick: () => onFavorite(c) }, favoriteKeys.has(key(c)) ? '♥' : '♡'))) : h('div', { className: 'bxtv-empty' }, h('strong', null, view === 'Favoritos' ? 'Tu selección empieza aquí' : view === 'Recientes' ? 'Todavía no hay canales recientes' : 'No encontramos ese canal'), h('p', null, view === 'Favoritos' ? 'Toca el corazón de un canal para guardarlo.' : 'Prueba otra búsqueda o categoría.'), button('Mostrar todos los canales', () => { setQuery(''); setGroup('Todas'); setView('Todos'); }, 'Ver todos')))),
        h('div', { className: 'bxtv-stage' },
          h('div', { className: 'bxtv-player', ref: player },
            h('div', { className: 'bxtv-screen' },
              h(LivePlayer, { channel: selected, attempt, onStatus: setStatus }),
              status === 'playing' && h('span', { className: 'bxtv-live-badge' }, h('i'), 'EN DIRECTO'),
              (!selected || status === 'loading' || error) && h('div', { className: 'bxtv-overlay', role: 'status' },
                status === 'loading' && selected ? h('span', { className: 'bxtv-spinner', 'aria-hidden': true }) : h('span', { className: 'bxtv-overlay-symbol', 'aria-hidden': true }, error ? '↻' : '▶'),
                h('h2', null, selected ? statuses[status] : 'Elige qué quieres ver'), h('p', null, error ? 'La señal puede estar temporalmente fuera de servicio. Puedes reintentar o elegir otro canal.' : selected ? selected.title : 'Selecciona un canal de la lista para comenzar.'), error && button('Reintentar señal', () => { setStatus('loading'); setAttempt(x => x + 1); }, 'Reintentar'))),
            h('div', { className: 'bxtv-now' }, h('div', { className: 'bxtv-now-title' }, selected && h(Logo, { channel: selected }), h('div', null, h('strong', null, selected ? selected.title : 'BOXPLAYTV en directo'), h('p', { 'aria-live': 'polite', className: error ? 'has-error' : '' }, statuses[status]))),
              h('div', { className: 'bxtv-controls' }, button('Canal anterior', () => next(-1), '‹', !channels.length), button('Canal siguiente', () => next(1), '›', !channels.length), button('Reintentar señal', () => { setStatus('loading'); setAttempt(x => x + 1); }, '↻', !selected), button(full ? 'Salir de pantalla completa' : 'Pantalla completa', fullscreen, '⛶', !selected), button('Cerrar señal', onClose, '×', !selected)))),
          h('div', { className: 'bxtv-caption' }, h('span', null, 'TU TELEVISIÓN, A TU RITMO'), h('p', null, 'Guarda tus favoritos y vuelve a tus canales recientes desde este dispositivo.')))));
  };
  window.BoxTVLive.category = category;
  window.BoxTVLive.initialChannel = channels => { const recent = readRecent(); return channels.find(c => key(c) === recent[0]) || channels[0]; };
})();
