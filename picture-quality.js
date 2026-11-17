/* Picture sizing never reloads media. Provider frames retain their own controls. */
(function () {
  'use strict';
  const engines = new WeakMap(), mounted = new WeakMap();
  function read() { try { return localStorage.getItem('boxplay_picture_size') === 'original' ? 'original' : 'fit'; } catch (_) { return 'fit'; } }
  function best(levels) { return levels.reduce((winner, level, index) => { const a = levels[winner] || {}; return (level.height || 0) > (a.height || 0) || ((level.height || 0) === (a.height || 0) && (level.bitrate || 0) > (a.bitrate || 0)) ? index : winner; }, 0); }
  function bind(video, engine) { engines.set(video, engine); if (engine.on && window.Hls) engine.on(window.Hls.Events.MANIFEST_PARSED, scan); scan(); }
  function scan() {
    document.querySelectorAll('.box-player, #player').forEach(root => {
      const video = root.querySelector('video'), frame = root.querySelector('iframe');
      const target = video || frame;
      let state = mounted.get(root);
      if (state && state.target === target) { state.refresh(); return; }
      if (state) state.bar.remove();
      if (!target) { mounted.delete(root); return; }
      const bar = document.createElement('div'); bar.className = 'box-picture-controls';
      bar.setAttribute('role', 'group'); bar.setAttribute('aria-label', 'Imagen y calidad');
      if (video) {
        const size = document.createElement('button'); size.type = 'button';
        let mode = read();
        const apply = () => { video.style.setProperty('object-fit', mode === 'original' ? 'scale-down' : 'contain', 'important'); size.textContent = mode === 'original' ? 'Imagen: tamaño original' : 'Imagen: ajustar a pantalla'; size.setAttribute('aria-label', size.textContent + '. Pulsa para cambiar'); };
        size.onclick = () => { mode = mode === 'fit' ? 'original' : 'fit'; try { localStorage.setItem('boxplay_picture_size', mode); } catch (_) {} apply(); };
        apply(); bar.append(size);
        const quality = document.createElement('button'); quality.type = 'button';
        let maximum = false;
        quality.onclick = () => { const hls = engines.get(video); if (!hls || !hls.levels || hls.levels.length < 2) return; maximum = !maximum; hls.autoLevelCapping = -1; hls.currentLevel = maximum ? best(hls.levels) : -1; refresh(); };
        bar.append(quality);
        function refresh() {
          const hls = engines.get(video), multiple = hls && hls.levels && hls.levels.length > 1;
          quality.hidden = !multiple;
          quality.textContent = maximum ? 'Calidad: máxima (más datos)' : 'Calidad: automática';
        }
        state = { target, bar, refresh }; refresh();
      } else {
        const note = document.createElement('span'); note.textContent = 'Calidad: usa los ajustes del reproductor de video'; bar.append(note);
        state = { target, bar, refresh: function () {} };
      }
      mounted.set(root, state); root.append(bar);
    });
  }
  window.BoxPicture = { bind, best, scan };
  function start() { scan(); new MutationObserver(records => { if (records.some(r => Array.from(r.addedNodes).concat(Array.from(r.removedNodes)).some(n => n.nodeType === 1 && (n.matches('video,iframe,.box-player,#player') || n.querySelector('video,iframe,.box-player,#player'))))) scan(); }).observe(document.body, { childList: true, subtree: true }); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
