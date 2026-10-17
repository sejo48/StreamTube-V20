/* One active radio stream. Web Audio analyses only streams that allow CORS. */
(function (root) {
    'use strict';
    class RadioEngine {
        constructor(onState, env = root) {
            this.env = env; this.onState = onState; this.status = 'idle'; this.volume = .8;
            this.audio = null; this.context = null; this.analyser = null; this.source = null;
            this.hls = null; this.generation = 0; this.url = ''; this.timer = null;
        }
        emit(status) { this.status = status; this.onState({ status, analysis: !!this.analyser }); }
        prepare() {
            try {
                const AudioContext = this.env.AudioContext || this.env.webkitAudioContext;
                if (!this.context && AudioContext) this.context = new AudioContext();
                this.context?.resume().catch(() => {});
            } catch { /* Audio remains available without analysis. */ }
        }
        clear() {
            this.env.clearTimeout(this.timer); this.timer = null;
            this.hls?.destroy(); this.hls = null;
            if (this.audio) {
                this.audio.onplaying = this.audio.onwaiting = this.audio.onerror = this.audio.onended = null;
                this.audio.pause(); this.audio.removeAttribute('src'); this.audio.load(); this.audio = null;
            }
            this.source?.disconnect(); this.source = null;
            this.analyser?.disconnect(); this.analyser = null;
        }
        start(station, volume = this.volume) {
            const url = station?.url || station?.stream || '';
            this.setVolume(volume);
            if (!/^https?:\/\//i.test(url)) { this.stop(); this.emit('error'); return; }
            if (url === this.url && this.audio && this.status !== 'error') {
                this.prepare(); this.emit('loading');
                const audio = this.audio;
                this.env.clearTimeout(this.timer);
                this.timer = this.env.setTimeout(() => { if (audio === this.audio && this.status === 'loading') audio.onerror?.(); }, 15000);
                this.play(audio, this.generation); return;
            }
            ++this.generation; this.clear(); this.url = url;
            this.open(url, !!this.context, this.generation);
        }
        play(audio, generation) {
            try {
                Promise.resolve(audio.play()).catch(error => {
                    if (generation !== this.generation || audio !== this.audio) return;
                    this.env.clearTimeout(this.timer);
                    if (error?.name === 'NotAllowedError') this.emit('blocked');
                    else if (error?.name !== 'AbortError') audio.onerror?.();
                });
            } catch { if (generation === this.generation) this.emit('error'); }
        }
        open(url, analyse, generation) {
            const audio = this.audio = new this.env.Audio();
            audio.preload = 'none'; audio.volume = this.volume;
            if (analyse) audio.crossOrigin = 'anonymous';
            if (analyse) {
                try {
                    this.source = this.context.createMediaElementSource(audio);
                    this.analyser = this.context.createAnalyser();
                    this.analyser.fftSize = 256; this.analyser.smoothingTimeConstant = .8;
                    this.source.connect(this.analyser); this.analyser.connect(this.context.destination);
                } catch {
                    this.clear(); return this.open(url, false, generation);
                }
            }
            const current = () => generation === this.generation && audio === this.audio;
            const fail = () => {
                if (!current()) return;
                this.env.clearTimeout(this.timer);
                // A stream can play without CORS even when it cannot be analysed.
                if (analyse && !this.hls) {
                    this.clear(); this.open(url, false, generation);
                } else { this.clear(); this.emit('error'); }
            };
            audio.onerror = fail;
            audio.onwaiting = () => { if (current()) { this.emit('loading'); this.env.clearTimeout(this.timer); this.timer = this.env.setTimeout(fail, 15000); } };
            audio.onplaying = () => {
                if (!current()) { audio.pause(); return; }
                this.env.clearTimeout(this.timer); this.emit('playing');
            };
            audio.onended = () => { if (current()) this.emit('paused'); };
            this.emit('loading');
            this.timer = this.env.setTimeout(fail, 15000);
            const Hls = this.env.Hls;
            if (/\.m3u8(?:[?#]|$)/i.test(url) && Hls?.isSupported()) {
                const hls = this.hls = new Hls({ enableWorker: true });
                hls.loadSource(url); hls.attachMedia(audio);
                hls.on(Hls.Events.MANIFEST_PARSED, () => { if (current() && this.status !== 'paused') this.play(audio, generation); });
                hls.on(Hls.Events.ERROR, (_, data) => { if (data.fatal) fail(); });
            } else { audio.src = url; audio.load(); this.play(audio, generation); }
        }
        pause() {
            ++this.generation; // Invalidate delayed play() and HLS callbacks.
            this.clear(); this.url = '';
            if (!['error', 'blocked', 'idle'].includes(this.status)) this.emit('paused');
        }
        stop() {
            ++this.generation; this.clear(); this.url = ''; this.emit('idle');
            this.context?.suspend().catch(() => {});
        }
        setVolume(value) {
            this.volume = Math.max(0, Math.min(1, Number(value) || 0));
            if (this.audio) this.audio.volume = this.volume;
        }
        frequencies(buffer) {
            if (this.status !== 'playing' || !this.analyser || this.context?.state !== 'running') { buffer.fill(0); return false; }
            this.analyser.getByteFrequencyData(buffer); return true;
        }
        dispose() { this.stop(); this.context?.close().catch(() => {}); this.context = null; }
    }
    root.BoxRadioEngine = RadioEngine;
    if (typeof module !== 'undefined') module.exports = RadioEngine;
})(typeof window !== 'undefined' ? window : globalThis);
