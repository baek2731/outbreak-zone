// ================================================================
//  sound.js — OUTBREAK ZONE 사운드 매니저 v2
//  파일 기반 효과음 + BGM 관리
//  효과음: /sounds/sfx/*.mp3
//  BGM:    /sounds/bgm/*.mp3
// ================================================================

const SoundManager = (() => {

  // ── 내부 상태 ────────────────────────────────────────────────
  let _ctx        = null;
  let _masterGain = null;
  let _bgmGain    = null;
  let _sfxGain    = null;
  let _ready      = false;

  const _sfxBuffers = {};
  const _bgmBuffers = {};
  const _soloSources = {};
  const _loopSources = {};
  const _loopGains   = {};
  const _loopActive  = {};

  let _bgmSource  = null;
  let _bgmCurrent = null;

  // ── 볼륨 설정 ────────────────────────────────────────────────
  const VOL = {
    master: 0.25,
    bgm:    0.30,
    sfx:    0.75,
  };

  // 개별 효과음 볼륨 — 게임 실행 후 DEV 슬라이더로 조절하고 값 확정
  const SFX_VOL = {
    sonar_fire:        0.70,
    sonar_precise:     0.65,
    sonar_ping_hit:    0.35,
    collect_success:   0.75,
    collect_fail:      0.85,
    collect_prompt:    0.75,
    combat_start:      0.85,
    combat_mash:       0.65,
    combat_win:        0.65,
    combat_lose:       0.85,
    patrol_phase1:     0.70,
    patrol_phase2:     0.80,
    patrol_phase3:     1.00,
    capsule_pickup:    0.65,
    exit_reach:        0.65,
    zombie_spawn:      0.75,
    oxygen_warn:       0.45,
    oxygen_critical:   0.90,
    infection_high:    0.75,
    gameover_death:    0.90,
    gameover_infected: 0.90,
    stage_clear:       0.75,
    all_clear:         0.85,
    upgrade_buy:       0.55,
    collect_key:       0.70,
    zombie_chase:      0.85,  // 볼륨 기준값 (1~3 공통)
  };

  // 개별 BGM 볼륨
  const BGM_VOL = {
    bgm_title:      0.38,
    bgm_base:       0.35,
    bgm_stage12:    0.38,
    bgm_stage34:    0.40,
    bgm_stage5:     0.42,
    bgm_ending:     0.38,
    sting_gameover: 0.60,
  };

  // 단일 채널 ID — 이전 것 정지 후 새로 재생
  const _SOLO_IDS = new Set([
    'sonar_fire', 'sonar_precise',
    'collect_success', 'collect_fail',
    'combat_start', 'combat_mash', 'combat_win', 'combat_lose',
    'gameover_death', 'gameover_infected',
    'stage_clear', 'all_clear',
    'exit_reach', 'infection_high', 'zombie_spawn',
    'oxygen_critical', 'patrol_phase1', 'patrol_phase2', 'patrol_phase3',
  ]);

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
      _loadAll();
    } catch(e) {
      console.warn('[Sound] AudioContext 초기화 실패:', e);
    }
  }

  function _ensureCtx() {
    if (!_ready) init();
    if (_ctx && _ctx.state === 'suspended') _ctx.resume();
    return _ready;
  }

  // ── 파일 로드 ─────────────────────────────────────────────────
  async function _loadSFX(id) {
    try {
      const res = await fetch(`./sounds/sfx/${id}.mp3`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const arr = await res.arrayBuffer();
      _sfxBuffers[id] = await _ctx.decodeAudioData(arr);
    } catch(e) {
      console.warn(`[Sound] SFX 로드 실패 [${id}]:`, e);
    }
  }

  async function _loadBGMFile(id) {
    try {
      const res = await fetch(`./sounds/bgm/${id}.mp3`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const arr = await res.arrayBuffer();
      _bgmBuffers[id] = await _ctx.decodeAudioData(arr);
    } catch(e) {
      console.warn(`[Sound] BGM 로드 실패 [${id}]:`, e);
    }
  }

  function _loadAll() {
    Object.keys(SFX_VOL).forEach(id => {
      if (id === 'zombie_chase') return; // 아래서 별도 처리
      _loadSFX(id);
    });
    // zombie_chase 1~3 별도 로드
    [1, 2, 3].forEach(n => _loadSFX(`zombie_chase_${n}`));
    Object.keys(BGM_VOL).forEach(id => _loadBGMFile(id));
  }

  // ── 효과음 재생 ──────────────────────────────────────────────
  function play(id) {
    if (!_ensureCtx()) return;
    const buf = _sfxBuffers[id];
    if (!buf) { console.warn(`[Sound] 버퍼 없음 [${id}] — 로드 중이거나 파일 없음`); return; }

    const vol = SFX_VOL[id] ?? 0.7;
    const t   = _ctx.currentTime + 0.01;

    if (_SOLO_IDS.has(id)) {
      // 단일 채널: 이전 소스 즉시 정지
      if (_soloSources[id]) {
        try {
          _soloSources[id].gain.cancelScheduledValues(_ctx.currentTime);
          _soloSources[id].gain.setValueAtTime(0, _ctx.currentTime);
        } catch(e) {}
      }
      const gainNode = _ctx.createGain();
      gainNode.gain.setValueAtTime(vol, t);
      gainNode.connect(_sfxGain);
      const source = _ctx.createBufferSource();
      source.buffer = buf;
      source.connect(gainNode);
      source.start(t);
      _soloSources[id] = gainNode;
    } else {
      // 멀티 채널: 동시 재생 허용
      const gainNode = _ctx.createGain();
      gainNode.gain.setValueAtTime(vol, t);
      gainNode.connect(_sfxGain);
      const source = _ctx.createBufferSource();
      source.buffer = buf;
      source.connect(gainNode);
      source.start(t);
    }
  }

  // ── 루프 효과음 (oxygen_warn) ────────────────────────────────
  function startLoop(id) {
    if (!_ensureCtx()) return;
    if (_loopActive[id]) stopLoop(id);
    const buf = _sfxBuffers[id];
    if (!buf) { console.warn(`[Sound] 루프 버퍼 없음 [${id}]`); return; }

    const vol      = SFX_VOL[id] ?? 0.4;
    const gainNode = _ctx.createGain();
    gainNode.gain.setValueAtTime(0, _ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(vol, _ctx.currentTime + 0.3);
    gainNode.connect(_sfxGain);

    const source  = _ctx.createBufferSource();
    source.buffer = buf;
    source.loop   = true;
    source.connect(gainNode);
    source.start();

    _loopSources[id] = source;
    _loopGains[id]   = gainNode;
    _loopActive[id]  = true;
  }

  function stopLoop(id) {
    if (!_loopActive[id]) return;
    const gainNode = _loopGains[id];
    const source   = _loopSources[id];
    if (gainNode) {
      gainNode.gain.cancelScheduledValues(_ctx.currentTime);
      gainNode.gain.setValueAtTime(gainNode.gain.value, _ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0, _ctx.currentTime + 0.15);
    }
    setTimeout(() => { try { source?.stop(); } catch(e) {} }, 200);
    _loopSources[id] = null;
    _loopGains[id]   = null;
    _loopActive[id]  = false;
  }

  function setLoopVolume(id, vol) {
    if (!_loopActive[id] || !_loopGains[id]) return;
    const gainNode = _loopGains[id];
    gainNode.gain.cancelScheduledValues(_ctx.currentTime);
    gainNode.gain.setValueAtTime(Math.max(0, vol), _ctx.currentTime);
  }

  // zombie_chase 1~3 중 랜덤 재생
  function playZombieChase() {
    if (!_ensureCtx()) return;
    const n   = Math.floor(Math.random() * 3) + 1;
    const id  = `zombie_chase_${n}`;
    const buf = _sfxBuffers[id];
    if (!buf) { console.warn(`[Sound] 버퍼 없음 [${id}]`); return; }

    const vol = SFX_VOL['zombie_chase'] ?? 0.85;
    const t   = _ctx.currentTime + 0.01;

    // 단일 채널 — 이전 chase 소리 정지 후 새로
    if (_soloSources['zombie_chase']) {
      try {
        _soloSources['zombie_chase'].gain.cancelScheduledValues(_ctx.currentTime);
        _soloSources['zombie_chase'].gain.setValueAtTime(0, _ctx.currentTime);
      } catch(e) {}
    }
    const gainNode = _ctx.createGain();
    gainNode.gain.setValueAtTime(vol, t);
    gainNode.connect(_sfxGain);
    const source = _ctx.createBufferSource();
    source.buffer = buf;
    source.connect(gainNode);
    source.start(t);
    _soloSources['zombie_chase'] = gainNode;
  }

  // 방향별 피치로 재생 (병원체 채집 키 입력)
  // W: 높음 / D: 중간높음 / A: 중간낮음 / S: 낮음
  function playKeyed(dir) {
    if (!_ensureCtx()) return;
    const buf = _sfxBuffers['collect_key'];
    if (!buf) { console.warn('[Sound] 버퍼 없음 [collect_key]'); return; }

    const vol = SFX_VOL['collect_key'] ?? 0.7;
    const t   = _ctx.currentTime + 0.01;

    const gainNode = _ctx.createGain();
    gainNode.gain.setValueAtTime(vol, t);
    gainNode.connect(_sfxGain);

    const source  = _ctx.createBufferSource();
    source.buffer = buf;
    source.connect(gainNode);
    source.start(t);
  }

  // ── BGM 관리 ─────────────────────────────────────────────────
  function playBGM(id, fadeIn = 1.2) {
    if (!_ensureCtx()) return;
    if (_bgmCurrent === id) return;
    const buf = _bgmBuffers[id];
    if (!buf) { console.warn(`[Sound] BGM 버퍼 없음 [${id}]`); return; }

    _stopBGMSource();

    const vol    = BGM_VOL[id] ?? VOL.bgm;
    const source = _ctx.createBufferSource();
    source.buffer = buf;
    source.loop   = true;
    source.connect(_bgmGain);

    const t = _ctx.currentTime;
    _bgmGain.gain.cancelScheduledValues(t);
    _bgmGain.gain.setValueAtTime(0, t);
    _bgmGain.gain.linearRampToValueAtTime(vol, t + fadeIn);

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
    setTimeout(() => { try { src.stop(); } catch(e) {} }, (fadeOut + 0.15) * 1000);
    _bgmSource  = null;
    _bgmCurrent = null;
  }

  function stopBGMImmediate() {
    if (!_bgmSource) return;
    _bgmGain.gain.cancelScheduledValues(_ctx.currentTime);
    _bgmGain.gain.setValueAtTime(0, _ctx.currentTime);
    try { _bgmSource.stop(); } catch(e) {}
    _bgmSource  = null;
    _bgmCurrent = null;
  }

  function crossfadeBGM(id, duration = 1.0) {
    if (!_ensureCtx()) return;
    if (_bgmCurrent === id) return;
    const buf = _bgmBuffers[id];
    if (!buf) { playBGM(id); return; }

    const t   = _ctx.currentTime;
    const vol = BGM_VOL[id] ?? VOL.bgm;

    if (_bgmSource) {
      _bgmGain.gain.cancelScheduledValues(t);
      _bgmGain.gain.setValueAtTime(_bgmGain.gain.value, t);
      _bgmGain.gain.linearRampToValueAtTime(0, t + duration * 0.55);
      const old = _bgmSource;
      setTimeout(() => { try { old.stop(); } catch(e) {} }, duration * 650);
    }

    const source  = _ctx.createBufferSource();
    source.buffer = buf;
    source.loop   = true;
    source.connect(_bgmGain);
    _bgmGain.gain.setValueAtTime(0, t + duration * 0.45);
    _bgmGain.gain.linearRampToValueAtTime(vol, t + duration);
    source.start(t + duration * 0.45);
    _bgmSource  = source;
    _bgmCurrent = id;
  }

  function _stopBGMSource() {
    if (!_bgmSource) return;
    try { _bgmSource.stop(); } catch(e) {}
    _bgmSource  = null;
    _bgmCurrent = null;
  }

  // ── 볼륨 제어 API ────────────────────────────────────────────
  function setMasterVolume(v) {
    if (!_ready) return;
    VOL.master = Math.max(0, Math.min(1, v));
    _masterGain.gain.setValueAtTime(VOL.master, _ctx.currentTime);
  }

  function setBGMVolume(v) {
    if (!_ready) return;
    VOL.bgm = Math.max(0, Math.min(1, v));
    if (_bgmCurrent) _bgmGain.gain.setValueAtTime(VOL.bgm, _ctx.currentTime);
  }

  function setSFXVolume(v) {
    if (!_ready) return;
    VOL.sfx = Math.max(0, Math.min(1, v));
    _sfxGain.gain.setValueAtTime(VOL.sfx, _ctx.currentTime);
  }

  // 개별 볼륨 실시간 조절 (DEV 패널용)
  function setSFXIndividualVolume(id, v) {
    SFX_VOL[id] = Math.max(0, Math.min(1, v));
  }

  function setBGMIndividualVolume(id, v) {
    BGM_VOL[id] = Math.max(0, Math.min(1, v));
    if (_bgmCurrent === id) {
      _bgmGain.gain.setValueAtTime(v, _ctx.currentTime);
    }
  }

  // 현재 볼륨 값 콘솔 출력 — 조절 완료 후 복붙용
  function printVolumes() {
    console.log('=== SFX_VOL (sound.js에 붙여넣기) ===');
    console.log(JSON.stringify(SFX_VOL, null, 2));
    console.log('=== BGM_VOL (sound.js에 붙여넣기) ===');
    console.log(JSON.stringify(BGM_VOL, null, 2));
  }

  // ── Public API ───────────────────────────────────────────────
  return {
    init,
    play,
    playKeyed,
    playZombieChase,
    startLoop,
    stopLoop,
    setLoopVolume,
    playBGM,
    stopBGM,
    stopBGMImmediate,
    crossfadeBGM,
    setMasterVolume,
    setBGMVolume,
    setSFXVolume,
    setSFXIndividualVolume,
    setBGMIndividualVolume,
    printVolumes,
    SFX_VOL,
    BGM_VOL,
    VOL,
  };

})();
