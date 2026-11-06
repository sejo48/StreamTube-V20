/* Shared controls for movies and live television; iframe playback stays mounted. */
(function () {
  'use strict';
  window.BoxPlayerUI = { usePlayerUI: function (ref, source) {
    const [visible, setVisible] = React.useState(true);
    const [full, setFull] = React.useState(false);
    const timer = React.useRef(null), fallback = React.useRef(false);
    const clear = () => clearTimeout(timer.current);
    const wake = () => { clear(); setVisible(true); timer.current = setTimeout(() => {
      const node = ref.current;
      const focused = document.activeElement;
      if (!node || !node.contains(focused) || !focused || !/^(BUTTON|INPUT|SELECT|TEXTAREA|A)$/.test(focused.tagName)) setVisible(false);
    }, 3500); };
    const exit = () => {
      fallback.current = false; setFull(false); wake();
      try {
        const node = ref.current, current = document.fullscreenElement || document.webkitFullscreenElement;
        if (current && node && (current === node || node.contains(current))) {
          const result = (document.exitFullscreen || document.webkitExitFullscreen).call(document);
          if (result && result.catch) result.catch(() => {});
        }
      } catch (_) {}
    };
    React.useEffect(() => {
      const change = () => {
        const node = ref.current, current = document.fullscreenElement || document.webkitFullscreenElement;
        setFull(fallback.current || !!(node && current && (current === node || node.contains(current)))); wake();
      };
      const key = event => { if (event.key === 'Escape' && fallback.current) exit(); };
      document.addEventListener('fullscreenchange', change);
      document.addEventListener('webkitfullscreenchange', change);
      document.addEventListener('keydown', key);
      return () => { clear(); document.removeEventListener('fullscreenchange', change); document.removeEventListener('webkitfullscreenchange', change); document.removeEventListener('keydown', key); };
    }, []);
    React.useEffect(() => { wake(); return clear; }, [source]);
    const toggleFullscreen = () => {
      const node = ref.current;
      if (!node) return;
      if (full) { exit(); return; }
      const useFallback = () => { if (ref.current !== node) return; fallback.current = true; setFull(true); wake(); };
      try {
        const request = node.requestFullscreen || node.webkitRequestFullscreen;
        if (!request) { useFallback(); return; }
        const result = request.call(node);
        if (result && result.catch) result.catch(useFallback);
      } catch (_) { useFallback(); }
    };
    return { visible, full, exit, toggleFullscreen, toggleMenu: () => { clear(); setVisible(value => !value); },
      events: { onPointerMove: event => { if (!event.target.closest || !event.target.closest('.box-menu-toggle')) wake(); }, onPointerDown: event => { if (event.target.tagName === 'VIDEO') wake(); }, onFocus: event => { if (event.target.closest && event.target.closest('.box-menu-toggle')) return; clear(); setVisible(true); }, onBlur: wake, onKeyDown: event => { if (event.key !== 'Escape' && (!event.target.closest || !event.target.closest('.box-menu-toggle'))) wake(); } } };
  } };
})();
