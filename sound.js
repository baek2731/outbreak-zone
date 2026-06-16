// ================================================================
//  sound.js — OUTBREAK ZONE 사운드 매니저
//  Web Audio API 기반 프로시저럴 효과음 + BGM 파일 관리
// ================================================================

const SoundManager = (() => {

  // ── 내부 상태 ────────────────────────────────────────────────
  let _ctx        = null;   // AudioContext
  let _masterGain = null;   // 전체 볼륨
  let _bgmGain    = null;   // BGM 전용
  let _sfxGain    = null;   // 효과음 전용
  let _ready      = false;  // AudioContext 초기화 완료 여부

  // 단일 채널 노드 테이블 — 이전 것 정지 후 새로 재생
  const _soloNodes = {};

  // 루프 노드 테이블
  const _loopNodes   = {};
  const _loopActive  = {};

  // BGM
  let _bgmSource  = null;
  let _bgmBuffer  = {};     // { id: AudioBuffer }
  let _bgmCurrent = null;   // 현재 재생 중인 BGM id
  let _bgmFadeTimer = null;

  // ── 볼륨 설정 ────────────────────────────────────────────────
  const VOL = {
    master: 0.85,
    bgm:    0.38,
    sfx:    0.72,
  };

  // ── 초기화 ───────────────────────────────────────────────────
  function init() {
    if (_ready) return;
    try {
      _ctx        = new (window.AudioContext || window.webkitAudioContext)();
      _masterGain = _ctx.createGain();
      _bgmGain    = _ctx.createGain();
      _sfxGain    = _ctx.createGain();

      _masterGain.gain.value = VOL.master;
      _bgmGain.gain.value    = VOL.bgm;
      _sfxGain.gain.value    = VOL.sfx;

      _bgmGain.connect(_masterGain);
      _sfxGain.connect(_masterGain);
      _masterGain.connect(_ctx.destination);

      _ready = true;
    } catch(e) {
      console.warn('[Sound] AudioContext 초기화 실패:', e);
    }
  }

  function _ensureCtx() {
    if (!_ready) init();
    if (_ctx && _ctx.state === 'suspended') _ctx.resume();
    return _ready;
  }

  // ================================================================
  //  효과음 정의 테이블
  //  각 항목: { type, synth 함수 }
  //  synth(ctx, dest, time) — Web Audio 노드 그래프 구성
  // ================================================================

  const _sfxDefs = {

    // ── 소나 ────────────────────────────────────────────────────

    sonar_fire: (ctx, dest, t) => {
      // 핑 → 부드럽게 퍼지는 파동음
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(dest);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(820, t);
      osc.frequency.exponentialRampToValueAtTime(280, t + 0.6);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.55, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.65);
      osc.start(t); osc.stop(t + 0.68);
    },

    sonar_precise: (ctx, dest, t) => {
      // 정밀 소나 — 더 높고 날카로운 이중 핑
      [900, 1200].forEach((freq, i) => {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(dest);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t + i * 0.06);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.5, t + i * 0.06 + 0.4);
        gain.gain.setValueAtTime(0, t + i * 0.06);
        gain.gain.linearRampToValueAtTime(0.4, t + i * 0.06 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.06 + 0.45);
        osc.start(t + i * 0.06); osc.stop(t + i * 0.06 + 0.48);
      });
    },

    sonar_ping_hit: (ctx, dest, t, danger = 1) => {
      // 핑 위험도별 틱음 (danger 1~3)
      const freqs = [440, 660, 900];
      const freq  = freqs[Math.min(danger - 1, 2)];
      const osc   = ctx.createOscillator();
      const gain  = ctx.createGain();
      osc.connect(gain); gain.connect(dest);
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      osc.start(t); osc.stop(t + 0.1);
    },

    // ── 병원체 회수 ──────────────────────────────────────────────

    collect_success: (ctx, dest, t) => {
      // 상승하는 전자음 — 짧고 긍정적
      const freqs = [440, 554, 659, 880];
      freqs.forEach((freq, i) => {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(dest);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t + i * 0.055);
        gain.gain.setValueAtTime(0.3, t + i * 0.055);
        gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.055 + 0.18);
        osc.start(t + i * 0.055); osc.stop(t + i * 0.055 + 0.2);
      });
    },

    collect_fail: (ctx, dest, t) => {
      // 하강 경고음 + 저음 충격
      const osc1  = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.connect(gain1); gain1.connect(dest);
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(380, t);
      osc1.frequency.exponentialRampToValueAtTime(80, t + 0.35);
      gain1.gain.setValueAtTime(0.5, t);
      gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
      osc1.start(t); osc1.stop(t + 0.4);

      // 충격 저음
      const osc2  = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2); gain2.connect(dest);
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(55, t);
      osc2.frequency.exponentialRampToValueAtTime(30, t + 0.3);
      gain2.gain.setValueAtTime(0.7, t);
      gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
      osc2.start(t); osc2.stop(t + 0.35);
    },

    collect_prompt: (ctx, dest, t) => {
      // 탐지 병원체 위에 섰을 때 — 짧은 알림
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(dest);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(660, t);
      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      osc.start(t); osc.stop(t + 0.14);
    },

    // ── 전투 ────────────────────────────────────────────────────

    combat_start: (ctx, dest, t) => {
      // 충돌 + 긴장감 — 노이즈 burst + 저음
      const bufSize = ctx.sampleRate * 0.12;
      const buf     = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const data    = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1);
      const noise = ctx.createBufferSource();
      noise.buffer = buf;
      const ngain  = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass'; filter.frequency.value = 400; filter.Q.value = 0.8;
      noise.connect(filter); filter.connect(ngain); ngain.connect(dest);
      ngain.gain.setValueAtTime(0.8, t);
      ngain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      noise.start(t); noise.stop(t + 0.14);

      // 저음 강조
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(dest);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(80, t);
      osc.frequency.exponentialRampToValueAtTime(40, t + 0.25);
      gain.gain.setValueAtTime(0.6, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.start(t); osc.stop(t + 0.3);
    },

    combat_mash: (ctx, dest, t) => {
      // F키 연타 타격음 — 짧고 둔탁하게. 연타 시 탕탕탕탕
      const bufSize = ctx.sampleRate * 0.05;
      const buf     = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const data    = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1);
      const noise  = ctx.createBufferSource();
      noise.buffer = buf;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass'; filter.frequency.value = 800;
      const gain   = ctx.createGain();
      noise.connect(filter); filter.connect(gain); gain.connect(dest);
      gain.gain.setValueAtTime(0.55, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
      noise.start(t); noise.stop(t + 0.08);
    },

    combat_win: (ctx, dest, t) => {
      // 안도 + 짧은 해방감
      const freqs = [330, 440, 554];
      freqs.forEach((freq, i) => {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(dest);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t + i * 0.1);
        gain.gain.setValueAtTime(0.28, t + i * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.1 + 0.3);
        osc.start(t + i * 0.1); osc.stop(t + i * 0.1 + 0.32);
      });
    },

    combat_lose: (ctx, dest, t) => {
      // 둔탁한 타격 + 하강
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(dest);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, t);
      osc.frequency.exponentialRampToValueAtTime(40, t + 0.45);
      gain.gain.setValueAtTime(0.6, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.48);
      osc.start(t); osc.stop(t + 0.5);

      const osc2  = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2); gain2.connect(dest);
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(60, t + 0.05);
      gain2.gain.setValueAtTime(0.5, t + 0.05);
      gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
      osc2.start(t + 0.05); osc2.stop(t + 0.4);
    },

    // ── 패트롤 경보 ──────────────────────────────────────────────

    patrol_phase1: (ctx, dest, t) => {
      // 경보 1회 — 낮고 짧게
      _beep(ctx, dest, t, 440, 0.5, 0.35);
    },

    patrol_phase2: (ctx, dest, t) => {
      // 경보 2회 연속 — 빠르게
      _beep(ctx, dest, t,        520, 0.5, 0.22);
      _beep(ctx, dest, t + 0.28, 520, 0.5, 0.22);
    },

    patrol_phase3: (ctx, dest, t) => {
      // 풀 경보 3회 + 저음 드론
      [0, 0.24, 0.48].forEach(dt => _beep(ctx, dest, t + dt, 660, 0.55, 0.18));
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(dest);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(55, t);
      gain.gain.setValueAtTime(0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
      osc.start(t); osc.stop(t + 1.25);
    },

    // ── 아이템 / 출구 ─────────────────────────────────────────────

    capsule_pickup: (ctx, dest, t) => {
      // 산뜻한 회복음
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(dest);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523, t);
      osc.frequency.linearRampToValueAtTime(784, t + 0.15);
      gain.gain.setValueAtTime(0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.start(t); osc.stop(t + 0.3);
    },

    exit_reach: (ctx, dest, t) => {
      // 출구 도달 — 문 열리는 느낌 (하강 후 안정)
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(dest);
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(660, t);
      osc.frequency.exponentialRampToValueAtTime(220, t + 0.4);
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      osc.start(t); osc.stop(t + 0.48);
    },

    // ── 좀비 ────────────────────────────────────────────────────

    zombie_spawn: (ctx, dest, t) => {
      // 으스스한 출현음 — 저주파 글리치
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(dest);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(55, t);
      osc.frequency.setValueAtTime(110, t + 0.08);
      osc.frequency.setValueAtTime(55,  t + 0.16);
      osc.frequency.setValueAtTime(82,  t + 0.22);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.4, t + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
      osc.start(t); osc.stop(t + 0.58);
    },

    // ── 산소 / 감염 ──────────────────────────────────────────────

    oxygen_critical: (ctx, dest, t) => {
      // 산소 0% — 날카로운 경보
      [0, 0.18, 0.36].forEach(dt => {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(dest);
        osc.type = 'square';
        osc.frequency.setValueAtTime(880, t + dt);
        gain.gain.setValueAtTime(0.4, t + dt);
        gain.gain.exponentialRampToValueAtTime(0.001, t + dt + 0.14);
        osc.start(t + dt); osc.stop(t + dt + 0.16);
      });
    },

    infection_high: (ctx, dest, t) => {
      // 감염 75% — 무겁고 불길한 음
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(dest);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(110, t);
      osc.frequency.exponentialRampToValueAtTime(55, t + 0.7);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.45, t + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.75);
      osc.start(t); osc.stop(t + 0.78);
    },

    // ── 게임오버 ─────────────────────────────────────────────────

    gameover_death: (ctx, dest, t) => {
      // 충격 + 길게 하강
      const bufSize = ctx.sampleRate * 0.15;
      const buf     = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const data    = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1);
      const noise  = ctx.createBufferSource();
      noise.buffer = buf;
      const ngain  = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass'; filter.frequency.value = 600;
      noise.connect(filter); filter.connect(ngain); ngain.connect(dest);
      ngain.gain.setValueAtTime(0.7, t);
      ngain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      noise.start(t); noise.stop(t + 0.18);

      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(dest);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(120, t + 0.05);
      osc.frequency.exponentialRampToValueAtTime(30, t + 1.4);
      gain.gain.setValueAtTime(0.6, t + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 1.5);
      osc.start(t + 0.05); osc.stop(t + 1.55);
    },

    gameover_infected: (ctx, dest, t) => {
      // 좀비화 — 느리고 으스스한 변형음
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(dest);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, t);
      osc.frequency.exponentialRampToValueAtTime(55, t + 2.0);
      // 진동(vibrato) 효과
      const lfo  = ctx.createOscillator();
      const lGain = ctx.createGain();
      lfo.connect(lGain); lGain.connect(osc.frequency);
      lfo.frequency.value = 5;
      lGain.gain.setValueAtTime(0, t);
      lGain.gain.linearRampToValueAtTime(18, t + 0.8);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.5, t + 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 2.2);
      lfo.start(t); lfo.stop(t + 2.3);
      osc.start(t); osc.stop(t + 2.3);
    },

    // ── 탈출 ────────────────────────────────────────────────────

    stage_clear: (ctx, dest, t) => {
      // 탈출 성공 — 안도감
      const freqs = [392, 523, 659, 784];
      freqs.forEach((freq, i) => {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(dest);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t + i * 0.09);
        gain.gain.setValueAtTime(0.28, t + i * 0.09);
        gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.09 + 0.4);
        osc.start(t + i * 0.09); osc.stop(t + i * 0.09 + 0.42);
      });
    },

    all_clear: (ctx, dest, t) => {
      // ALL CLEAR — 해방감 + 여운
      const melody = [
        [523, 0],   [659, 0.12], [784, 0.24],
        [1047, 0.38],[784, 0.56],[1047, 0.72],
      ];
      melody.forEach(([freq, dt]) => {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(dest);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t + dt);
        gain.gain.setValueAtTime(0.32, t + dt);
        gain.gain.exponentialRampToValueAtTime(0.001, t + dt + 0.5);
        osc.start(t + dt); osc.stop(t + dt + 0.52);
      });
    },

    // ── 기지 ────────────────────────────────────────────────────

    upgrade_buy: (ctx, dest, t) => {
      // 강화 구매 — 짧고 긍정
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(dest);
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(660, t);
      osc.frequency.linearRampToValueAtTime(880, t + 0.1);
      gain.gain.setValueAtTime(0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      osc.start(t); osc.stop(t + 0.2);
    },

  }; // end _sfxDefs

  // ── 내부 유틸: 단순 비프 ─────────────────────────────────────
  function _beep(ctx, dest, t, freq, vol, dur) {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(dest);
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(vol * 0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.start(t); osc.stop(t + dur + 0.02);
  }

  // ================================================================
  //  효과음 재생 — 단일 채널 (이전 정지 후 새로 재생)
  // ================================================================

  // 단일 채널 ID 목록 — 이 ID들은 이전 것을 정지하고 새로 재생
  const _SOLO_IDS = new Set([
    'sonar_fire', 'sonar_precise',
    'collect_success', 'collect_fail',
    'combat_start', 'combat_mash', 'combat_win', 'combat_lose',
    'gameover_death', 'gameover_infected',
    'stage_clear', 'all_clear',
    'exit_reach', 'infection_high', 'zombie_spawn',
  ]);

  function play(id, ...args) {
    if (!_ensureCtx()) return;
    const def = _sfxDefs[id];
    if (!def) { console.warn('[Sound] 미정의 효과음:', id); return; }

    const t    = _ctx.currentTime + 0.01;
    const dest = _sfxGain;

    // 단일 채널: 이전 GainNode를 즉시 0으로 끊어 새로 시작
    if (_SOLO_IDS.has(id)) {
      if (_soloNodes[id]) {
        try {
          _soloNodes[id].gain.cancelScheduledValues(_ctx.currentTime);
          _soloNodes[id].gain.setValueAtTime(0, _ctx.currentTime);
        } catch(e) {}
      }
      // 이번 재생용 래퍼 GainNode 생성
      const wrapper = _ctx.createGain();
      wrapper.gain.setValueAtTime(1, t);
      wrapper.connect(dest);
      _soloNodes[id] = wrapper;
      def(_ctx, wrapper, t, ...args);
    } else {
      // 멀티 채널: 그냥 재생
      def(_ctx, dest, t, ...args);
    }
  }

  // ================================================================
  //  루프 효과음
  // ================================================================

  const _loopDefs = {

    sonar_charge: (ctx, dest) => {
      // 차징 중 윙~ 음 — 볼륨/피치 외부에서 조절
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(dest);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(180, ctx.currentTime);
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.22, ctx.currentTime + 0.1);
      osc.start();
      return { osc, gain };
    },

    oxygen_warn: (ctx, dest) => {
      // 낮고 반복되는 경보 — 볼륨은 setLoopVolume으로 실시간 제어
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(dest);
      osc.type = 'square';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      gain.gain.setValueAtTime(0, ctx.currentTime);
      osc.start();

      // 맥동 (LFO로 볼륨 주기적 변화)
      const lfo   = ctx.createOscillator();
      const lGain = ctx.createGain();
      lfo.connect(lGain); lGain.connect(gain.gain);
      lfo.frequency.value  = 1.8;
      lGain.gain.value     = 0.12;
      lfo.start();
      return { osc, gain, lfo, lGain };
    },

  };

  function startLoop(id) {
    if (!_ensureCtx()) return;
    // 이미 재생 중이면 기존 정지 후 새로 시작
    if (_loopActive[id]) stopLoop(id);

    const def = _loopDefs[id];
    if (!def) return;
    _loopNodes[id]  = def(_ctx, _sfxGain);
    _loopActive[id] = true;
  }

  function stopLoop(id) {
    if (!_loopActive[id]) return;
    const node = _loopNodes[id];
    if (node) {
      try {
        if (node.gain) {
          node.gain.gain.cancelScheduledValues(_ctx.currentTime);
          node.gain.gain.setValueAtTime(node.gain.gain.value, _ctx.currentTime);
          node.gain.gain.linearRampToValueAtTime(0, _ctx.currentTime + 0.08);
        }
        setTimeout(() => {
          try { node.osc?.stop(); } catch(e) {}
          try { node.lfo?.stop(); } catch(e) {}
        }, 100);
      } catch(e) {}
    }
    _loopNodes[id]  = null;
    _loopActive[id] = false;
  }

  // 루프 볼륨 실시간 조절 (oxygen_warn — 산소 수치 연동용)
  function setLoopVolume(id, vol) {
    if (!_loopActive[id] || !_loopNodes[id]) return;
    const node = _loopNodes[id];
    if (node.gain) {
      node.gain.gain.cancelScheduledValues(_ctx.currentTime);
      node.gain.gain.setValueAtTime(Math.max(0, vol), _ctx.currentTime);
    }
  }

  // 소나 차징 피치 업데이트 (차징 비율 0~1)
  function setSonarChargeRatio(ratio) {
    if (!_loopActive['sonar_charge'] || !_loopNodes['sonar_charge']) return;
    const node = _loopNodes['sonar_charge'];
    if (node.osc) {
      node.osc.frequency.setValueAtTime(180 + ratio * 280, _ctx.currentTime);
    }
    if (node.gain) {
      node.gain.gain.setValueAtTime(0.1 + ratio * 0.2, _ctx.currentTime);
    }
  }

  // ================================================================
  //  BGM 관리
  // ================================================================

  async function loadBGM(id, url) {
    if (!_ensureCtx()) return;
    try {
      const res  = await fetch(url);
      const arr  = await res.arrayBuffer();
      _bgmBuffer[id] = await _ctx.decodeAudioData(arr);
    } catch(e) {
      console.warn(`[Sound] BGM 로드 실패 [${id}]:`, e);
    }
  }

  function playBGM(id, fadeIn = 1.0) {
    if (!_ensureCtx()) return;
    if (_bgmCurrent === id) return;
    if (!_bgmBuffer[id]) return; // 버퍼 없으면 무시

    _stopBGMSource();

    const source = _ctx.createBufferSource();
    source.buffer = _bgmBuffer[id];
    source.loop   = true;
    source.connect(_bgmGain);

    const t = _ctx.currentTime;
    _bgmGain.gain.cancelScheduledValues(t);
    _bgmGain.gain.setValueAtTime(0, t);
    _bgmGain.gain.linearRampToValueAtTime(VOL.bgm, t + fadeIn);

    source.start(t);
    _bgmSource  = source;
    _bgmCurrent = id;
  }

  function stopBGM(fadeOut = 1.0) {
    if (!_bgmSource) return;
    const t = _ctx.currentTime;
    _bgmGain.gain.cancelScheduledValues(t);
    _bgmGain.gain.setValueAtTime(_bgmGain.gain.value, t);
    _bgmGain.gain.linearRampToValueAtTime(0, t + fadeOut);
    const src = _bgmSource;
    setTimeout(() => { try { src.stop(); } catch(e) {} }, (fadeOut + 0.1) * 1000);
    _bgmSource  = null;
    _bgmCurrent = null;
  }

  function stopBGMImmediate() {
    // 게임오버 등 즉시 컷
    if (!_bgmSource) return;
    _bgmGain.gain.cancelScheduledValues(_ctx.currentTime);
    _bgmGain.gain.setValueAtTime(0, _ctx.currentTime);
    try { _bgmSource.stop(); } catch(e) {}
    _bgmSource  = null;
    _bgmCurrent = null;
  }

  function crossfadeBGM(id, duration = 0.8) {
    if (!_ensureCtx()) return;
    if (_bgmCurrent === id) return;
    if (!_bgmBuffer[id]) { playBGM(id); return; }

    // 현재 BGM 페이드아웃
    const t = _ctx.currentTime;
    if (_bgmSource) {
      _bgmGain.gain.cancelScheduledValues(t);
      _bgmGain.gain.setValueAtTime(_bgmGain.gain.value, t);
      _bgmGain.gain.linearRampToValueAtTime(0, t + duration * 0.6);
      const old = _bgmSource;
      setTimeout(() => { try { old.stop(); } catch(e) {} }, duration * 700);
    }

    // 새 BGM 페이드인
    const source = _ctx.createBufferSource();
    source.buffer = _bgmBuffer[id];
    source.loop   = true;
    source.connect(_bgmGain);
    _bgmGain.gain.setValueAtTime(0, t + duration * 0.4);
    _bgmGain.gain.linearRampToValueAtTime(VOL.bgm, t + duration);
    source.start(t + duration * 0.4);
    _bgmSource  = source;
    _bgmCurrent = id;
  }

  function _stopBGMSource() {
    if (!_bgmSource) return;
    try { _bgmSource.stop(); } catch(e) {}
    _bgmSource  = null;
    _bgmCurrent = null;
  }

  // ── 전체 볼륨 제어 ──────────────────────────────────────────
  function setMasterVolume(v) {
    if (!_ready) return;
    _masterGain.gain.setValueAtTime(Math.max(0, Math.min(1, v)), _ctx.currentTime);
  }
  function setBGMVolume(v) {
    if (!_ready) return;
    VOL.bgm = Math.max(0, Math.min(1, v));
    if (_bgmCurrent) _bgmGain.gain.setValueAtTime(VOL.bgm, _ctx.currentTime);
  }
  function setSFXVolume(v) {
    if (!_ready) return;
    _sfxGain.gain.setValueAtTime(Math.max(0, Math.min(1, v)), _ctx.currentTime);
  }

  // ── Public API ───────────────────────────────────────────────
  return {
    init,
    play,
    startLoop,
    stopLoop,
    setLoopVolume,
    setSonarChargeRatio,
    loadBGM,
    playBGM,
    stopBGM,
    stopBGMImmediate,
    crossfadeBGM,
    setMasterVolume,
    setBGMVolume,
    setSFXVolume,
  };

})();
