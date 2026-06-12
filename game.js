// ================================================================
//  game.js — OUTBREAK ZONE 게임 로직 전체
// ================================================================

// ================================================================
//  OUTBREAK ZONE — Step 3
//  좀비 스폰 + CHASE + 접촉 피해
// ================================================================

// ── 타일 타입 ────────────────────────────────────────────────────
const T = { WALL:0, FLOOR:1, MINE:2, ITEM:3, EXIT:4 };

// ── 방향 배열 상수 ───────────────────────────────────────────────
const DIR4  = [[0,-1],[1,0],[0,1],[-1,0]];
const DMAZE = [[0,-2],[2,0],[0,2],[-2,0]];

// ================================================================
//  RESOURCE LAYER — 스프라이트 교체 시 이 섹션만 수정
//  모든 draw 함수는 ctx.translate(-camX,-camY) 적용 상태에서 호출
//  → 월드 좌표 그대로 사용 (camX/Y 빼지 않음)
// ================================================================

function drawPlayer(ts) {
  const cx = player.px + ts / 2;
  const cy = player.py + ts / 2;
  const r  = ts * 0.34;
  ctx.save();
  ctx.globalAlpha = 0.12; ctx.beginPath(); ctx.arc(cx, cy, r * 1.8, 0, Math.PI * 2);
  ctx.fillStyle = '#00ff88'; ctx.fill();
  ctx.globalAlpha = 0.06;  ctx.beginPath(); ctx.arc(cx, cy, r * 2.4, 0, Math.PI * 2);
  ctx.fill(); ctx.restore();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = '#00ff88'; ctx.fill();
  const a = { up:-Math.PI/2, down:Math.PI/2, left:Math.PI, right:0 }[player.facing] ?? Math.PI/2;
  ctx.beginPath();
  ctx.arc(cx + Math.cos(a) * r * 0.52, cy + Math.sin(a) * r * 0.52, r * 0.22, 0, Math.PI * 2);
  ctx.fillStyle = '#003322'; ctx.fill();
}

function drawZombie(z, ts) {
  // 좀비 스프라이트 — 교체 시 이 함수만 수정
  const cx = z.px + ts / 2;
  const cy = z.py + ts / 2;
  const r  = ts * 0.30;

  // DEV 시야 원 표시
  if (devZombieFov) {
    ctx.save();
    const fovR   = CONFIG.zombie.fovRange * ts;
    const fovHalf = (CONFIG.zombie.fovAngle / 2) * Math.PI / 180;
    ctx.globalAlpha = 0.15;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, fovR, z.facingAngle - fovHalf, z.facingAngle + fovHalf);
    ctx.closePath();
    ctx.fillStyle = z.state === 'CHASE' ? '#ff3333' : z.state === 'SEARCH' ? '#ff8800' : '#888888';
    ctx.fill();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = z.state === 'CHASE' ? '#ff6666' : z.state === 'SEARCH' ? '#ffaa44' : '#444444';
    ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();
  }

  // 후광
  ctx.save();
  ctx.globalAlpha = 0.10; ctx.beginPath(); ctx.arc(cx, cy, r * 1.8, 0, Math.PI * 2);
  ctx.fillStyle = '#ff3333'; ctx.fill();
  ctx.globalAlpha = 1;
  // 몸통
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
  const bodyCol = z.state === 'CHASE' ? '#cc2222' : z.state === 'SEARCH' ? '#884422' : '#553333';
  ctx.fillStyle = bodyCol; ctx.fill();
  // 방향 도트 (좀비가 실제 바라보는 방향 = 시야 방향)
  const ang = z.facingAngle;
  ctx.beginPath();
  ctx.arc(cx + Math.cos(ang) * r * 0.52, cy + Math.sin(ang) * r * 0.52, r * 0.22, 0, Math.PI * 2);
  ctx.fillStyle = '#330000'; ctx.fill();
  ctx.restore();
}

function drawItem(tx, ty, ts) {
  // 🔑 부품 타일 — 교체 시 이 함수만 수정
  const sx = tx * ts, sy = ty * ts;
  const cx = sx + ts / 2, cy = sy + ts / 2;
  // 배경 펄스 (노란 마름모)
  ctx.save();
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = '#ffdd00';
  ctx.beginPath();
  ctx.moveTo(cx,       sy + ts * 0.18);
  ctx.lineTo(sx + ts * 0.82, cy);
  ctx.lineTo(cx,       sy + ts * 0.82);
  ctx.lineTo(sx + ts * 0.18, cy);
  ctx.closePath(); ctx.fill();
  ctx.globalAlpha = 1;
  // 마름모 테두리
  ctx.strokeStyle = '#ffdd00'; ctx.lineWidth = 1.5;
  ctx.stroke();
  // 중앙 점
  ctx.beginPath(); ctx.arc(cx, cy, ts * 0.1, 0, Math.PI * 2);
  ctx.fillStyle = '#ffdd00'; ctx.fill();
  ctx.restore();
}

function drawExit(tx, ty, ts, unlocked) {
  // 🚪 출구 타일 — 교체 시 이 함수만 수정
  const sx = tx * ts, sy = ty * ts;
  const pad = ts * 0.1;
  ctx.save();
  if (unlocked) {
    // 잠금 해제: 밝은 초록 테두리 + 내부 강조
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#00ff88';
    ctx.fillRect(sx + pad, sy + pad, ts - pad * 2, ts - pad * 2);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#00ff88'; ctx.lineWidth = 2.5;
    ctx.strokeRect(sx + pad, sy + pad, ts - pad * 2, ts - pad * 2);
    // 화살표
    const ax = sx + ts / 2, ay = sy + ts / 2;
    ctx.strokeStyle = '#00ff88'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ax - ts * 0.2, ay);
    ctx.lineTo(ax + ts * 0.2, ay);
    ctx.lineTo(ax + ts * 0.08, ay - ts * 0.12);
    ctx.moveTo(ax + ts * 0.2, ay);
    ctx.lineTo(ax + ts * 0.08, ay + ts * 0.12);
    ctx.stroke();
  } else {
    // 잠금 상태: 어두운 테두리
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = '#00ff88';
    ctx.fillRect(sx + pad, sy + pad, ts - pad * 2, ts - pad * 2);
    ctx.globalAlpha = 0.4;
    ctx.strokeStyle = '#006644'; ctx.lineWidth = 1.5;
    ctx.strokeRect(sx + pad, sy + pad, ts - pad * 2, ts - pad * 2);
    // 자물쇠 아이콘 (간단한 사각형+반원)
    const lx = sx + ts / 2, ly = sy + ts / 2 + ts * 0.04;
    const lw = ts * 0.22, lh = ts * 0.18;
    ctx.fillStyle = '#006644';
    ctx.fillRect(lx - lw / 2, ly - lh * 0.3, lw, lh);
    ctx.beginPath();
    ctx.arc(lx, ly - lh * 0.3, lw * 0.5, Math.PI, 0);
    ctx.strokeStyle = '#006644'; ctx.lineWidth = 2; ctx.stroke();
  }
  ctx.restore();
}

function drawSonarCharging(ts) {
  const cx = player.px + ts / 2, cy = player.py + ts / 2;
  if (sonar.charging) {
    const ratio = Math.min(sonar.chargeTime / CONFIG.sonar.maxCharge, 1);
    const col = ratio > 0.8 ? '#ffaa00' : '#00ff88';
    const bw = 36, bh = 5, bx = cx - bw / 2, by = cy - ts * 0.75;
    ctx.fillStyle = '#222'; ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = col;    ctx.fillRect(bx, by, bw * ratio, bh);
    ctx.strokeStyle = '#555'; ctx.lineWidth = 0.5; ctx.strokeRect(bx, by, bw, bh);
  }
  if (sonar.chargingPrecise) {
    const ratio = Math.min(sonar.chargeTimePrecise / CONFIG.sonar.maxCharge, 1);
    const bw = 36, bh = 5, bx = cx - bw / 2, by = cy - ts * 0.75 + 8;
    ctx.fillStyle = '#222'; ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = '#ff4444'; ctx.fillRect(bx, by, bw * ratio, bh);
    ctx.strokeStyle = '#555'; ctx.lineWidth = 0.5; ctx.strokeRect(bx, by, bw, bh);
  }
}

function drawSonarPulse() {
  if (sonar.pulseR <= 0 || sonar.pulseMaxR <= 0) return;
  const progress = Math.min(sonar.pulseR / sonar.pulseMaxR, 1);
  const alpha = Math.max(0, 0.5 * (1 - progress));
  ctx.save();
  ctx.beginPath(); ctx.arc(sonar.pulseWx, sonar.pulseWy, sonar.pulseR, 0, Math.PI * 2);
  ctx.strokeStyle = '#00ff88'; ctx.lineWidth = 2.5; ctx.globalAlpha = alpha; ctx.stroke();
  ctx.globalAlpha = alpha * 0.1; ctx.fillStyle = '#00ff88'; ctx.fill();
  ctx.restore();
}

function drawSonarPings() {
  const ts = CONFIG.map.tileSize;
  const dangerColors = ['', '#ffee44', '#ff8800', '#ff3333'];
  for (const p of sonar.pings) {
    if (!p.lit || p.alpha <= 0) continue;
    const wx = p.tx * ts, wy = p.ty * ts;
    const danger = Math.min(p.danger, 3);
    const col = dangerColors[danger];
    const pr = ts * 0.18;
    ctx.save();
    ctx.globalAlpha = p.alpha * 0.2;
    ctx.beginPath(); ctx.arc(wx + ts / 2, wy + ts / 2, pr * 1.6, 0, Math.PI * 2);
    ctx.fillStyle = col; ctx.fill();
    ctx.globalAlpha = p.alpha * 0.85;
    ctx.beginPath(); ctx.arc(wx + ts / 2, wy + ts / 2, pr, 0, Math.PI * 2);
    ctx.fillStyle = col; ctx.fill();
    ctx.restore();
  }
}

function drawSonarPreciseMarks() {
  const ts = CONFIG.map.tileSize;
  for (const m of sonar.preciseMarks) {
    if (!m.lit || m.alpha <= 0) continue;
    const wx = m.tx * ts, wy = m.ty * ts;
    ctx.save();
    ctx.globalAlpha = m.alpha;

    if (m.kind === 'mine') {
      // 병원체: 빨간 X 표시
      ctx.fillStyle = 'rgba(255,50,50,0.15)'; ctx.fillRect(wx, wy, ts, ts);
      ctx.strokeStyle = '#ff4444'; ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(wx + 10, wy + 10); ctx.lineTo(wx + ts - 10, wy + ts - 10);
      ctx.moveTo(wx + ts - 10, wy + 10); ctx.lineTo(wx + 10, wy + ts - 10);
      ctx.stroke();
    } else {
      // 좀비: 주황 눈 아이콘 (타원 + 동공)
      const cx = wx + ts / 2, cy = wy + ts / 2;
      ctx.fillStyle = 'rgba(255,140,0,0.12)'; ctx.fillRect(wx, wy, ts, ts);
      ctx.strokeStyle = '#ff8c00'; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, ts * 0.28, ts * 0.18, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, ts * 0.08, 0, Math.PI * 2);
      ctx.fillStyle = '#ff8c00'; ctx.fill();
    }

    ctx.restore();
  }
}

function drawMinigame(ts) {
  if (!minigame.active) return;
  const cx = player.px + ts / 2 - camX;
  const cy = player.py - camX * 0 - camY;  // camX/Y는 ctx.translate로 이미 적용됨

  // ctx는 이미 translate(-camX,-camY) 상태 → 월드 좌표 사용
  const wx = player.px + ts / 2;
  const wy = player.py - ts * 0.3;

  const boxW = minigame.pattern.length * 28 + 12;
  const boxH = 36;
  const bx   = wx - boxW / 2;
  const by   = wy - boxH - 8;

  // 배경
  ctx.save();
  ctx.globalAlpha = 0.88;
  ctx.fillStyle = minigame.flashTimer > 0 ? '#3a0000' : '#0d0d0d';
  ctx.strokeStyle = minigame.type === 'mine' ? '#ff4444' : '#ff8800';
  ctx.lineWidth = 1.5;
  roundRect(ctx, bx, by, boxW, boxH, 4);
  ctx.fill(); ctx.stroke();
  ctx.globalAlpha = 1;

  // 타입 레이블
  const label = minigame.type === 'mine' ? '회수' : '전투';
  ctx.fillStyle = minigame.type === 'mine' ? '#ff4444' : '#ff8800';
  ctx.font = `bold ${ts * 0.22}px monospace`;
  ctx.textAlign = 'center';
  ctx.fillText(label, wx, by + 11);

  // 결과 표시
  if (minigame.result) {
    ctx.fillStyle = minigame.result === 'success' ? '#00ff88' : '#ff3333';
    ctx.font = `bold ${ts * 0.3}px monospace`;
    ctx.fillText(minigame.result === 'success' ? '✓ OK' : '✗ FAIL', wx, by + boxH * 0.72);
    ctx.restore();
    return;
  }

  // 방향 아이콘 키캡
  const dirSymbol = { up:'▲', down:'▼', left:'◀', right:'▶' };
  const startX = bx + 8;
  const iconY  = by + boxH - 10;
  for (let i = 0; i < minigame.pattern.length; i++) {
    const ix = startX + i * 28;
    const iy = by + 14;
    const done    = i < minigame.current;
    const current = i === minigame.current;

    // 키캡 배경
    ctx.fillStyle = done ? '#003322' : current ? '#223300' : '#1a1a1a';
    ctx.strokeStyle = done ? '#00ff88' : current ? '#aaff00' : '#333';
    ctx.lineWidth = 1;
    roundRect(ctx, ix, iy, 22, 18, 3);
    ctx.fill(); ctx.stroke();

    // 방향 심볼
    ctx.fillStyle = done ? '#00ff88' : current ? '#ccff44' : '#444';
    ctx.font = `${ts * 0.18}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(dirSymbol[minigame.pattern[i]], ix + 11, iy + 13);
  }

  // [E키 프롬프트는 병원체 위 서 있을 때 별도 표시]
  ctx.restore();
}

// E키 프롬프트 — 병원체 위에 서 있을 때
function drawMinePrompt(ts) {
  const tileIdx = player.ty * MAP.width + player.tx;
  if (MAP.tiles[tileIdx] !== T.MINE) return;
  if (minigame.active) return;

  const wx = player.px + ts / 2;
  const wy = player.py - ts * 0.1;
  ctx.save();
  ctx.fillStyle = '#ffdd00';
  ctx.font = `bold ${ts * 0.22}px monospace`;
  ctx.textAlign = 'center';
  ctx.globalAlpha = 0.9;
  ctx.fillText('[E] 회수', wx, wy - ts * 0.6);
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ================================================================
//  END RESOURCE LAYER
// ================================================================

// ── 맵 생성 ──────────────────────────────────────────────────────
function generateMap() {
  let sz = CONFIG.map.size;
  if (sz % 2 === 0) sz++;
  const W = sz, H = sz;
  for (let i = 0; i < 10; i++) {
    const r = _buildMap(W, H);
    if (r) return r;
  }
  return _buildMap(W, H, true);
}

function _buildMap(W, H, force = false) {
  const tiles   = new Uint8Array(W * H).fill(T.WALL);
  const numbers = new Uint8Array(W * H);
  const idx = (x, y) => y * W + x;
  const get = (x, y) => tiles[idx(x, y)];
  const set = (x, y, v) => { tiles[idx(x, y)] = v; };

  // 미로 생성
  function carve(x, y) {
    set(x, y, T.FLOOR);
    for (const [dx, dy] of shuffle(DMAZE)) {
      const nx = x + dx, ny = y + dy;
      if (nx <= 0 || nx >= W - 1 || ny <= 0 || ny >= H - 1) continue;
      if (get(nx, ny) !== T.WALL) continue;
      set(x + dx / 2, y + dy / 2, T.FLOOR);
      carve(nx, ny);
    }
  }
  carve(1, 1);

  // 루프 경로
  let added = 0, tries = 0;
  while (added < CONFIG.map.loopPaths && tries < 400) {
    tries++;
    const x = 1 + Math.floor(Math.random() * Math.floor((W - 2) / 2)) * 2;
    const y = 1 + Math.floor(Math.random() * Math.floor((H - 2) / 2)) * 2;
    const [dx, dy] = [[1,0],[0,1]][Math.floor(Math.random() * 2)];
    const mx = x + dx, my = y + dy, nx = x + dx * 2, ny = y + dy * 2;
    if (nx <= 0 || nx >= W - 1 || ny <= 0 || ny >= H - 1) continue;
    if (get(mx, my) !== T.WALL || get(nx, ny) !== T.FLOOR) continue;
    set(mx, my, T.FLOOR);
    added++;
  }

  // 막다른 길 체크
  let floorCount = 0, deadEndCount = 0;
  const floorTiles = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (get(x, y) !== T.FLOOR) continue;
    floorCount++;
    floorTiles.push([x, y]);
    let n = 0;
    for (const [dx, dy] of DIR4) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && nx < W && ny >= 0 && ny < H && get(nx, ny) === T.FLOOR) n++;
    }
    if (n === 1) deadEndCount++;
  }
  const deadEndRatio = deadEndCount / (floorCount || 1);
  if (!force && deadEndRatio > CONFIG.map.deadEndMax) return null;

  // 스폰 안전 반경 Set
  const safeSet = new Set();
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) safeSet.add(`${1+dx},${1+dy}`);

  // 지뢰 배치
  let mineCount = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (get(x, y) !== T.FLOOR || safeSet.has(`${x},${y}`)) continue;
    if (Math.random() * 100 < CONFIG.mine.density) { set(x, y, T.MINE); mineCount++; }
  }

  // 아이템 배치 — 스폰 거리 기준 구간 분할, 각 구간에서 1개씩
  const itemCandidates = floorTiles.filter(([x, y]) => !safeSet.has(`${x},${y}`) && get(x, y) === T.FLOOR);
  const needed = Math.min(CONFIG.escape.itemCount, itemCandidates.length);
  // 각 후보의 스폰 거리 계산
  const withDist = itemCandidates.map(([x, y]) => ({ x, y, d: Math.hypot(x - 1, y - 1) }));
  withDist.sort((a, b) => a.d - b.d);
  const zoneSize = Math.floor(withDist.length / needed);
  for (let i = 0; i < needed; i++) {
    const zoneStart = i * zoneSize;
    const zoneEnd   = i === needed - 1 ? withDist.length : (i + 1) * zoneSize;
    const zone      = withDist.slice(zoneStart, zoneEnd).filter(({ x, y }) => get(x, y) === T.FLOOR);
    if (zone.length === 0) continue;
    const pick = zone[Math.floor(Math.random() * zone.length)];
    set(pick.x, pick.y, T.ITEM);
  }

  // 출구 배치 — 스폰(1,1)에서 최대한 먼 바닥 타일 1개
  // 아이템/지뢰 배치 후 남은 FLOOR 타일 중 선택
  let exitTile = null, maxDist = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (get(x, y) !== T.FLOOR) continue;
    const d = Math.hypot(x - 1, y - 1);
    if (d > maxDist) { maxDist = d; exitTile = [x, y]; }
  }
  if (exitTile) set(exitTile[0], exitTile[1], T.EXIT);

  // 인접 지뢰 수 계산 (ITEM/EXIT 타일도 포함해서 계산)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (get(x, y) === T.WALL) continue;
    let cnt = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && nx < W && ny >= 0 && ny < H && get(nx, ny) === T.MINE) cnt++;
    }
    numbers[idx(x, y)] = cnt;
  }

  return { tiles, numbers, width:W, height:H, floorCount, mineCount, deadEndCount, deadEndRatio };
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── 게임 상태 ────────────────────────────────────────────────────
let MAP = null, VISITED = null, VISIBLE = null;
let vignetteGradient = null;

const player = {
  tx:1, ty:1, px:0, py:0, targetX:0, targetY:0,
  moving:false, facing:'down',
  dead:false,
  itemsFound: 0,
  damageCooldown: 0,
  noiseRadius: 0,
  noiseX: 0, noiseY: 0,
  // 산소 / 감염 시스템
  oxygen:    100,
  infection:   0,
  stage:       0,
};

const sonar = {
  charging: false, chargeTime: 0,
  chargingPrecise: false, chargeTimePrecise: 0,
  firing: false, pulseR: 0, pulseMaxR: 0, pulseWx: 0, pulseWy: 0,
  pings: [], preciseMarks: [],
  precise: 2,
  radarTimer: 0,   // 소나 발동 후 미니맵 좀비 표시 잔여 시간
  radarRadius: 0,  // 탐지된 소나 반경 (타일) — 미니맵 범위 필터용
};

let camX = 0, camY = 0, moveTimer = 0;
let devRevealMines = false;
let devInvincible  = false;
let devRevealAll   = false;
let devNoiseMarker = null;   // DEV 소음 발원지 마커 {wx, wy, timer}
let devZombieFov   = false;

// ── 미니게임 상태 ────────────────────────────────────────────────
// type: 'mine' (병원체 회수) | 'combat' (좀비 전투) | null
const minigame = {
  active:       false,
  type:         null,       // 'mine' | 'combat'
  pattern:      [],         // 입력해야 할 방향 시퀀스 ['up','down','left','right',...]
  current:      0,          // 현재 입력 인덱스
  result:       null,       // null | 'success' | 'fail'
  resultTimer:  0,          // 결과 표시 후 자동 종료 타이머
  flashTimer:   0,          // 틀렸을 때 빨간 플래시
  mineTileIdx:  -1,         // 회수 대상 병원체 타일 인덱스
  combatZombie: null,       // 전투 대상 좀비 참조
  interruptedMine: false,   // 회수 중 급습 여부
  postCooldown: 0,          // 전투 종료 후 무적 쿨타임
};

// 미니게임 config (game.js 내부 상수)
const MG = {
  patternLengthByStage: [3, 4, 5],  // 스테이지별 패턴 길이
  dirs: ['up','down','left','right'],
  keyToDir: { KeyW:'up', KeyS:'down', KeyA:'left', KeyD:'right',
              ArrowUp:'up', ArrowDown:'down', ArrowLeft:'left', ArrowRight:'right' },
  // 병원체 회수
  mineSuccessInfect:  3,    // 성공 시 감염도 증가
  mineFailInfect:    15,    // 실패 시 감염도 증가
  // 좀비 전투
  combatSuccessOxy: -10,   // 성공 시 산소 소모
  combatFailOxy:    -25,   // 실패 시 산소 소모
  combatFailInfect:   8,   // 실패 시 감염도 증가
  // 기타
  postCooldown:     1.8,   // 전투 후 무적 시간 (초)
  resultShowTime:   1.0,   // 결과 표시 후 자동 닫힘 (초)
  visionRadMine:    2,     // 회수 중 시야 반경
};

// ── DEV 이벤트 로그 ──────────────────────────────────────────────
const DEV_LOG_MAX = 30;
const devLogEntries = [];   // { time, msg, cls }

function devLog(msg, cls = '') {
  const elapsed = ((Date.now() - (stats.startTime || Date.now())) / 1000).toFixed(1);
  devLogEntries.unshift({ time: elapsed, msg, cls });
  if (devLogEntries.length > DEV_LOG_MAX) devLogEntries.pop();
  _renderDevLog();
}

function _renderDevLog() {
  const el = document.getElementById('log-body');
  if (!el) return;
  el.innerHTML = devLogEntries.map(e =>
    `<div class="log-entry ${e.cls}">[${e.time}s] ${e.msg}</div>`
  ).join('');
}
let zombies = [];
const stats = { minesHit: 0, startTime: 0 };

// ── 캔버스 ───────────────────────────────────────────────────────
const canvas   = document.getElementById('canvas');
const ctx      = canvas.getContext('2d');
const mmCanvas = document.getElementById('minimap');
const mmCtx    = mmCanvas.getContext('2d');
let W_px, H_px;

function resize() {
  const area = document.getElementById('game-area');
  W_px = canvas.width  = area.clientWidth;
  H_px = canvas.height = area.clientHeight;
  mmCanvas.width = mmCanvas.height = CONFIG.minimap.size;
  vignetteGradient = ctx.createRadialGradient(W_px/2, H_px/2, H_px*0.18, W_px/2, H_px/2, H_px*0.78);
  vignetteGradient.addColorStop(0, 'rgba(0,0,0,0)');
  vignetteGradient.addColorStop(1, 'rgba(0,0,0,0.72)');
}
window.addEventListener('resize', resize);

// ── 초기화 ───────────────────────────────────────────────────────
function init() {
  MAP = generateMap();
  VISITED = new Uint8Array(MAP.width * MAP.height);
  VISIBLE  = new Uint8Array(MAP.width * MAP.height);

  Object.assign(player, {
    tx:1, ty:1,
    px: CONFIG.map.tileSize, py: CONFIG.map.tileSize,
    targetX: CONFIG.map.tileSize, targetY: CONFIG.map.tileSize,
    moving: false, facing: 'down',
    dead: false, itemsFound: 0, damageCooldown: 0, noiseRadius: 0,
    noiseX: 0, noiseY: 0,
    oxygen: CONFIG.oxygen.max, infection: 0, stage: 0,
  });

  Object.assign(sonar, {
    charging:false, chargeTime:0,
    chargingPrecise:false, chargeTimePrecise:0,
    firing:false, pulseR:0, pulseMaxR:0,
    pings:[], preciseMarks:[],
    precise: CONFIG.sonar.preciseCount,
    radarTimer: 0, radarRadius: 0,
  });

  stats.minesHit = 0; stats.startTime = Date.now();
  moveTimer = 0;
  _prevOxyZone = 'safe'; _prevInfZone = 'low';
  devLogEntries.length = 0; _renderDevLog();
  Object.assign(minigame, {
    active:false, type:null, pattern:[], current:0, result:null,
    resultTimer:0, flashTimer:0, mineTileIdx:-1, combatZombie:null,
    interruptedMine:false, postCooldown:0,
  });
  revealAround(1, 1, CONFIG.player.visionRad);
  camX = player.px + CONFIG.map.tileSize / 2 - W_px / 2;
  camY = player.py + CONFIG.map.tileSize / 2 - H_px / 2;
  spawnZombies();
  document.getElementById('gameover').classList.remove('show');
  document.getElementById('escaped').classList.remove('show');
}

// ── 시야 ─────────────────────────────────────────────────────────
function revealAround(tx, ty, radius) {
  VISIBLE.fill(0);
  const { width, height } = MAP;
  for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
    const nx = tx + dx, ny = ty + dy;
    if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
    if (Math.hypot(dx, dy) > radius + 0.5) continue;
    if (hasLOS(tx, ty, nx, ny)) { VISITED[ny * width + nx] = 1; VISIBLE[ny * width + nx] = 1; }
  }
  if (devRevealAll) { VISITED.fill(1); VISIBLE.fill(1); }
}

function hasLOS(x0, y0, x1, y1) {
  const { tiles, width } = MAP;
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  let x = x0, y = y0;
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  while (x !== x1 || y !== y1) {
    if (tiles[y * width + x] === T.WALL) return false;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 <  dx) { err += dx; y += sy; }
  }
  return true;
}

// ── 입력 ─────────────────────────────────────────────────────────
const KEYS = {};
const GAME_KEYS = new Set([
  'ArrowUp','ArrowDown','ArrowLeft','ArrowRight',
  'KeyW','KeyA','KeyS','KeyD','KeyF','KeyG','KeyE','Space',
]);

window.addEventListener('keydown', e => {
  if (GAME_KEYS.has(e.code)) e.preventDefault();

  // 미니게임 진행 중 입력 처리
  if (minigame.active && !minigame.result) {
    const dir = MG.keyToDir[e.code];
    if (dir) { minigameInput(dir); return; }
    return; // 미니게임 중 다른 키 차단
  }

  if (e.code === 'KeyE') {
    // 병원체 위에 서 있을 때 회수 시도
    if (!e.repeat && !player.dead && !minigame.active) {
      const tileIdx = player.ty * MAP.width + player.tx;
      if (MAP.tiles[tileIdx] === T.MINE) startMinigame('mine', tileIdx);
    }
    return;
  }
  if (e.code === 'KeyF') {
    if (!e.repeat && !sonar.charging && !player.dead && !minigame.active) {
      sonar.charging = true; sonar.chargeTime = 0;
    }
    return;
  }
  if (e.code === 'KeyG') {
    if (!e.repeat && !sonar.chargingPrecise && sonar.precise > 0 && !player.dead && !minigame.active) {
      sonar.chargingPrecise = true; sonar.chargeTimePrecise = 0;
    }
    return;
  }
  KEYS[e.code] = true;
});

window.addEventListener('keyup', e => {
  if (e.code === 'KeyF') { if (sonar.charging)        fireSonar(false); return; }
  if (e.code === 'KeyG') { if (sonar.chargingPrecise) fireSonar(true);  return; }
  KEYS[e.code] = false;
});

function processKeys() {
  if (player.dead) { sonar.charging = false; sonar.chargingPrecise = false; }
}

function getHeldDir() {
  if (KEYS['KeyW'] || KEYS['ArrowUp'])    return { dx:0,  dy:-1 };
  if (KEYS['KeyS'] || KEYS['ArrowDown'])  return { dx:0,  dy: 1 };
  if (KEYS['KeyA'] || KEYS['ArrowLeft'])  return { dx:-1, dy: 0 };
  if (KEYS['KeyD'] || KEYS['ArrowRight']) return { dx: 1, dy: 0 };
  return null;
}

function updateFacing(dx, dy) {
  if      (dy < 0) player.facing = 'up';
  else if (dy > 0) player.facing = 'down';
  else if (dx < 0) player.facing = 'left';
  else if (dx > 0) player.facing = 'right';
}

function tryMove(dx, dy) {
  const nx = player.tx + dx, ny = player.ty + dy;
  if (nx < 0 || nx >= MAP.width || ny < 0 || ny >= MAP.height) return false;
  if (MAP.tiles[ny * MAP.width + nx] === T.WALL) return false;
  updateFacing(dx, dy);
  player.tx = nx; player.ty = ny;
  player.targetX = nx * CONFIG.map.tileSize;
  player.targetY = ny * CONFIG.map.tileSize;
  player.moving  = true;
  moveTimer = CONFIG.player.moveDelay;
  revealAround(nx, ny, CONFIG.player.visionRad);
  onStep(nx, ny);
  return true;
}

function handleInput(dt) {
  moveTimer = Math.max(0, moveTimer - dt);
  processKeys();
  if (player.moving || moveTimer > 0 || player.dead || minigame.active) return;
  const dir = getHeldDir();
  if (dir) { updateFacing(dir.dx, dir.dy); tryMove(dir.dx, dir.dy); }
}

// ── 타일 효과 ────────────────────────────────────────────────────
function onStep(tx, ty) {
  const tileIdx = ty * MAP.width + tx;
  const tile    = MAP.tiles[tileIdx];

  if (tile === T.MINE) {
    // 병원체 위에 섬 — 타일 유지, E키로 선택적 회수
    devLog('병원체 위에 섬 — [E] 회수 시도', '');
    return;
  }

  if (tile === T.ITEM) {
    MAP.tiles[tileIdx] = T.FLOOR;
    player.itemsFound++;
    // 산소 캡슐: 산소 33% 보충
    const prevOxy = player.oxygen;
    player.oxygen = Math.min(CONFIG.oxygen.max, player.oxygen + CONFIG.oxygen.capsuleHeal);
    devLog(`캡슐 수집 — 산소 +${(player.oxygen - prevOxy).toFixed(1)}% (${prevOxy.toFixed(1)}% → ${player.oxygen.toFixed(1)}%)`, 'good');
    triggerFlash('item');
    triggerFlash('oxygen');
    return;
  }

  if (tile === T.EXIT) {
    // TODO: 스테이지 시스템 추가 시 병원체 전부 회수 조건으로 교체
    if (player.itemsFound >= CONFIG.escape.itemCount) {
      showEscaped();
    }
  }
}

function triggerFlash(color) {
  if (color === 'red') {
    const fl = document.getElementById('flash');
    fl.style.opacity = '1';
    setTimeout(() => { fl.style.opacity = '0'; }, 150);
  } else if (color === 'item') {
    const fl = document.getElementById('item-flash');
    fl.style.opacity = '1';
    setTimeout(() => { fl.style.opacity = '0'; }, 220);
    const el = document.getElementById('hud-items');
    el.style.transform = 'scale(1.6)';
    el.style.color = '#ffffff';
    el.style.transition = 'transform 0.12s, color 0.12s';
    setTimeout(() => {
      el.style.transform = 'scale(1)';
      el.style.color = '';
      el.style.transition = 'transform 0.2s, color 0.2s';
    }, 200);
  } else if (color === 'oxygen') {
    // 산소 캡슐 수집: 파란 HUD 산소 팝
    const el = document.getElementById('hud-oxygen');
    if (el) {
      el.style.transform = 'scale(1.5)';
      el.style.transition = 'transform 0.12s';
      setTimeout(() => {
        el.style.transform = 'scale(1)';
        el.style.transition = 'transform 0.2s';
      }, 200);
    }
  }
}

function showGameOver(reason) {
  player.dead = true;
  const elapsed = Math.floor((Date.now() - stats.startTime) / 1000);
  document.getElementById('go-mines').textContent  = stats.minesHit;
  document.getElementById('go-time').textContent   = elapsed + '초';
  const reasonEl = document.getElementById('go-reason');
  if (reasonEl) reasonEl.textContent = reason === 'infected' ? '☣ 감염 전환' : '☠ 사망';
  document.getElementById('gameover').classList.add('show');
}

// 산소 감소 공통 함수
function applyOxygenDamage(amount) {
  player.oxygen = Math.max(0, player.oxygen - amount);
}

// ================================================================
//  미니게임 시스템
// ================================================================

function makePattern(len) {
  return Array.from({ length: len }, () => MG.dirs[Math.floor(Math.random() * 4)]);
}

function startMinigame(type, mineTileIdx, zombieRef, interrupted) {
  // 회수 중 급습이면 기존 mine 미니게임 강제 종료
  if (minigame.active && type === 'combat') {
    minigame.interruptedMine = interrupted || false;
  }
  const stageIdx = Math.min(player.stage, MG.patternLengthByStage.length - 1);
  const len = MG.patternLengthByStage[stageIdx];
  Object.assign(minigame, {
    active: true, type, pattern: makePattern(len), current: 0,
    result: null, resultTimer: 0, flashTimer: 0,
    mineTileIdx: mineTileIdx ?? -1,
    combatZombie: zombieRef ?? null,
    interruptedMine: interrupted || false,
    postCooldown: 0,
  });
  // 회수 중 시야 축소
  if (type === 'mine') revealAround(player.tx, player.ty, MG.visionRadMine);
  triggerFlash('red');
  devLog(`미니게임 시작 [${type}] 패턴: ${minigame.pattern.join('-')}`, 'warn');
}

function minigameInput(dir) {
  if (!minigame.active || minigame.result) return;
  const expected = minigame.pattern[minigame.current];
  if (dir === expected) {
    minigame.current++;
    if (minigame.current >= minigame.pattern.length) {
      endMinigame(true);
    }
  } else {
    // 틀림 → 즉시 실패
    minigame.flashTimer = 0.3;
    endMinigame(false);
  }
}

function endMinigame(success) {
  minigame.result = success ? 'success' : 'fail';
  minigame.resultTimer = MG.resultShowTime;

  if (minigame.type === 'mine') {
    if (success) {
      // 병원체 회수 성공
      if (minigame.mineTileIdx >= 0) {
        MAP.tiles[minigame.mineTileIdx] = T.FLOOR;
        // 주변 numbers 재계산
        const tx = minigame.mineTileIdx % MAP.width;
        const ty = Math.floor(minigame.mineTileIdx / MAP.width);
        recalcNumbers(tx, ty);
      }
      player.infection = Math.min(100, player.infection + MG.mineSuccessInfect);
      devLog(`병원체 회수 성공 — 감염 +${MG.mineSuccessInfect}%`, 'good');
    } else {
      // 실패 — 감염 대폭 증가 + 소음
      player.infection = Math.min(100, player.infection + MG.mineFailInfect);
      triggerNoise(player.px + CONFIG.map.tileSize / 2,
                   player.py + CONFIG.map.tileSize / 2, CONFIG.zombie.hearRange);
      devLog(`병원체 회수 실패 — 감염 +${MG.mineFailInfect}%`, 'danger');
    }
  } else {
    // 전투
    const interrupted = minigame.interruptedMine;
    if (success) {
      const oxyLoss = Math.abs(MG.combatSuccessOxy) + (interrupted ? 5 : 0);
      applyOxygenDamage(oxyLoss);
      if (interrupted) player.infection = Math.min(100, player.infection + 5);
      devLog(`전투 성공 — 산소 -${oxyLoss}%${interrupted ? ' (급습 패널티)' : ''}`, 'warn');
    } else {
      applyOxygenDamage(Math.abs(MG.combatFailOxy) + (interrupted ? 10 : 0));
      player.infection = Math.min(100, player.infection + MG.combatFailInfect + (interrupted ? 5 : 0));
      devLog(`전투 실패 — 산소 대량 소모, 감염 증가${interrupted ? ' (급습 패널티)' : ''}`, 'danger');
    }
    triggerFlash('red');
    minigame.postCooldown = MG.postCooldown;
    devLog('방호복 재밀봉 중... 무적 1.8초', '');
  }

  // 감염 100% 체크
  if (player.infection >= 100 && !player.dead) showGameOver('infected');
}

function updateMinigame(dt) {
  if (!minigame.active) return;
  if (minigame.flashTimer > 0) minigame.flashTimer -= dt;
  if (minigame.postCooldown > 0) minigame.postCooldown -= dt;

  if (minigame.result) {
    minigame.resultTimer -= dt;
    if (minigame.resultTimer <= 0) {
      // 미니게임 종료 — 시야 복구
      minigame.active = false;
      minigame.type   = null;
      if (!minigame.active) revealAround(player.tx, player.ty, CONFIG.player.visionRad);
    }
  }
}

// 주변 numbers 재계산 (병원체 제거 후)
function recalcNumbers(tx, ty) {
  const { tiles, numbers, width, height } = MAP;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const nx = tx + dx, ny = ty + dy;
    if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
    if (tiles[ny * width + nx] === T.WALL) continue;
    let cnt = 0;
    for (let dy2 = -1; dy2 <= 1; dy2++) for (let dx2 = -1; dx2 <= 1; dx2++) {
      if (dx2 === 0 && dy2 === 0) continue;
      const mx = nx + dx2, my = ny + dy2;
      if (mx >= 0 && mx < width && my >= 0 && my < height && tiles[my * width + mx] === T.MINE) cnt++;
    }
    numbers[ny * width + nx] = cnt;
  }
}

function showEscaped() {
  player.dead = true; // 입력 차단
  const elapsed = Math.floor((Date.now() - stats.startTime) / 1000);
  document.getElementById('esc-items').textContent = player.itemsFound;
  document.getElementById('esc-mines').textContent = stats.minesHit;
  document.getElementById('esc-time').textContent  = elapsed + '초';
  document.getElementById('escaped').classList.add('show');
}

// ── 소나 ─────────────────────────────────────────────────────────
function fireSonar(isPrecise) {
  const cfg = CONFIG.sonar;
  const chargeTime = isPrecise ? sonar.chargeTimePrecise : sonar.chargeTime;
  const ratio  = Math.min(chargeTime, cfg.maxCharge) / cfg.maxCharge;
  const radius = Math.round(cfg.minRadius + (cfg.maxRadius - cfg.minRadius) * ratio);
  const ts = CONFIG.map.tileSize;

  if (isPrecise) { sonar.chargingPrecise = false; sonar.chargeTimePrecise = 0; sonar.precise--; }
  else           { sonar.charging = false; sonar.chargeTime = 0; }

  // 소나 발동 소음 — 소나 반경과 좀비 청력 중 작은 값
  const noiseWx = player.px + ts / 2, noiseWy = player.py + ts / 2;
  player.noiseX = noiseWx; player.noiseY = noiseWy;
  triggerNoise(noiseWx, noiseWy, Math.min(radius, CONFIG.zombie.hearRange));

  sonar.pulseWx   = player.px + ts / 2;
  sonar.pulseWy   = player.py + ts / 2;
  sonar.pulseR    = 0;
  sonar.pulseMaxR = radius * ts;
  sonar.firing    = true;
  sonar.radarTimer  = CONFIG.sonar.radarDuration;  // 미니맵 레이더 활성화
  sonar.radarRadius = radius;                       // 탐지 반경 저장

  const { tiles, numbers, width, height } = MAP;
  const newPings = [], newMarks = [];

  // ── 기본 소나: 병원체 + 좀비 통합 탐지 (종류 구분 없음) ─────────
  // 핑 위험도: 인접 병원체 수 기반 (기존) + 좀비 근접 시 추가
  if (!isPrecise) {
    // 타일 기반 병원체 핑
    for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = player.tx + dx, ny = player.ty + dy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      if (Math.hypot(dx, dy) > radius + 0.5) continue;
      const tile = tiles[ny * width + nx];
      if (tile === T.WALL) continue;
      const dist = Math.hypot(dx, dy) * ts;
      // 병원체 인접 타일은 위험도 핑 (기존 동일)
      if (tile !== T.MINE) {
        const danger = numbers[ny * width + nx];
        if (danger > 0)
          newPings.push({ tx:nx, ty:ny, dist, danger, lit:false, alpha:0, timer:cfg.pingDuration });
      }
    }

    // 좀비 위치 핑 — 좀비를 병원체와 구분 불가능한 동일한 핑으로 표시
    for (const z of zombies) {
      const zdx = z.tx - player.tx, zdy = z.ty - player.ty;
      if (Math.hypot(zdx, zdy) > radius + 0.5) continue;
      const dist = Math.hypot(zdx, zdy) * ts;
      // 좀비 자체를 위험도 3 (최고) 핑으로 표시 — 병원체 인접 핑과 구별 불가
      // 단, 이미 같은 타일에 핑이 있으면 위험도만 올림
      const existing = newPings.find(p => p.tx === z.tx && p.ty === z.ty);
      if (existing) {
        existing.danger = Math.max(existing.danger, 3);
      } else {
        newPings.push({ tx:z.tx, ty:z.ty, dist, danger:3, lit:false, alpha:0, timer:cfg.pingDuration });
      }
    }

  // ── 정밀 소나: 병원체 X 표시 + 좀비 눈 표시 (종류 구분) ────────
  } else {
    for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = player.tx + dx, ny = player.ty + dy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      if (Math.hypot(dx, dy) > radius + 0.5) continue;
      const tile = tiles[ny * width + nx];
      if (tile === T.WALL) continue;
      const dist = Math.hypot(dx, dy) * ts;
      if (tile === T.MINE)
        newMarks.push({ tx:nx, ty:ny, dist, kind:'mine', lit:false, alpha:0, timer:cfg.pingDuration * 1.5 });
    }
    // 정밀 소나: 좀비 위치 눈 표시
    for (const z of zombies) {
      const zdx = z.tx - player.tx, zdy = z.ty - player.ty;
      if (Math.hypot(zdx, zdy) > radius + 0.5) continue;
      const dist = Math.hypot(zdx, zdy) * ts;
      const existing = newMarks.find(m => m.tx === z.tx && m.ty === z.ty);
      if (!existing)
        newMarks.push({ tx:z.tx, ty:z.ty, dist, kind:'zombie', lit:false, alpha:0, timer:cfg.pingDuration * 1.5 });
    }
  }

  sonar.pings        = [...sonar.pings.filter(p => p.alpha > 0), ...newPings];
  sonar.preciseMarks = [...sonar.preciseMarks.filter(m => m.alpha > 0), ...newMarks];
}

function updateSonar(dt) {
  const cfg = CONFIG.sonar;
  if (sonar.charging)        sonar.chargeTime        = Math.min(sonar.chargeTime + dt, cfg.maxCharge);
  if (sonar.chargingPrecise) sonar.chargeTimePrecise = Math.min(sonar.chargeTimePrecise + dt, cfg.maxCharge);
  if (sonar.radarTimer > 0)  sonar.radarTimer        = Math.max(0, sonar.radarTimer - dt);

  if (sonar.firing) {
    sonar.pulseR += cfg.pulseSpeed * dt;
    for (const p of sonar.pings)        if (!p.lit && sonar.pulseR >= p.dist) { p.lit = true; p.alpha = 1.0; }
    for (const m of sonar.preciseMarks) if (!m.lit && sonar.pulseR >= m.dist) { m.lit = true; m.alpha = 1.0; }
    if (sonar.pulseR >= sonar.pulseMaxR) sonar.firing = false;
  }
  if (!sonar.firing && sonar.pulseR > 0 && sonar.pulseMaxR > 0) {
    sonar.pulseR += cfg.pulseSpeed * dt * 0.5;
    if (sonar.pulseR > sonar.pulseMaxR * 1.5) { sonar.pulseR = 0; sonar.pulseMaxR = 0; }
  }

  for (const p of sonar.pings) {
    if (!p.lit) continue;
    p.timer -= dt;
    p.alpha  = Math.max(0, p.timer / cfg.pingDuration);
  }
  sonar.pings = sonar.pings.filter(p => !p.lit || p.alpha > 0);

  const markDur = cfg.pingDuration * 1.5;
  for (const m of sonar.preciseMarks) {
    if (!m.lit) continue;
    m.timer -= dt;
    m.alpha  = Math.max(0, m.timer / markDur);
  }
  sonar.preciseMarks = sonar.preciseMarks.filter(m => !m.lit || m.alpha > 0);
}

// ── 좀비 ─────────────────────────────────────────────────────────
function spawnZombies() {
  zombies = [];
  const { tiles, width, height } = MAP;
  const ts    = CONFIG.map.tileSize;
  const count = CONFIG.zombie.count;
  const minD  = CONFIG.zombie.spawnDist;

  // 후보: 바닥 타일, 스폰 거리 이상
  const candidates = [];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (tiles[y * width + x] !== T.FLOOR) continue;
    if (Math.hypot(x - 1, y - 1) < minD) continue;
    candidates.push({ x, y, d: Math.hypot(x - 1, y - 1) });
  }
  // 거리 순 정렬 후 count개 구간으로 분산 배치
  candidates.sort((a, b) => a.d - b.d);
  const zoneSize = Math.floor(candidates.length / Math.max(count, 1));
  for (let i = 0; i < Math.min(count, candidates.length); i++) {
    const zStart = i * zoneSize;
    const zEnd   = i === count - 1 ? candidates.length : (i + 1) * zoneSize;
    const zone   = candidates.slice(zStart, zEnd);
    const pick   = zone[Math.floor(Math.random() * zone.length)];
    zombies.push({
      tx: pick.x, ty: pick.y,
      px: pick.x * ts, py: pick.y * ts,
      state: 'WANDER',          // WANDER / SEARCH / CHASE
      facingAngle: Math.random() * Math.PI * 2,
      // 목표 좌표 (SEARCH/CHASE 공통, 월드 px)
      targetWx: 0, targetWy: 0,
      hasTarget: false,
      // 타이머
      wanderTimer: Math.random() * 2,
      memoryTimer: 0,           // 목표 기억 잔여 시간 (0 되면 WANDER 복귀)
    });
  }
}

// ════════════════════════════════════════════════════════════════
//  좀비 시스템 (재설계) — 단일 책임 구조
//  원칙: ① 상태 전환은 zombieSense 한 곳 ② 이동은 BFS방향+픽셀
//        ③ 끼임은 충돌단계 슬라이딩으로만 (상태 안 건드림)
// ════════════════════════════════════════════════════════════════

// 좀비 충돌 반경 (렌더링과 일치)
const ZOMBIE_RADIUS = 0.40;   // 타일 비율
const ZOMBIE_FOV_RANGE_PAD = 0;

function updateZombies(dt) {
  if (player.dead) return;
  const ts  = CONFIG.map.tileSize;
  const pcx = player.px + ts / 2;
  const pcy = player.py + ts / 2;

  if (player.damageCooldown > 0) player.damageCooldown -= dt;

  const c = {
    dt, ts, pcx, pcy,
    spd:        (ts / CONFIG.player.moveDelay) * CONFIG.zombie.speed * dt,
    wSpd:       (ts / CONFIG.player.moveDelay) * CONFIG.zombie.speed * dt * 0.5,
    fovHalf:    (CONFIG.zombie.fovAngle / 2) * Math.PI / 180,
    sightTiles: CONFIG.zombie.fovRange,
    r:          ts * ZOMBIE_RADIUS,
  };

  for (const z of zombies) {
    const zcx = z.px + ts / 2;
    const zcy = z.py + ts / 2;
    const distTiles = Math.hypot(pcx - zcx, pcy - zcy) / ts;

    zombieSense(z, c, zcx, zcy, distTiles);  // ① 상태 결정
    zombieStep(z, c, zcx, zcy);              // ② 이동
    zombieSeparate(z, c);                    // ③ 좀비 간 분리
    zombieContact(z, c, zcx, zcy);           // ④ 접촉 피해
  }
}

// 좀비 간 분리 — 순수 밀어내기 벡터만 (wanderAngle 없음, 이동 방향 간섭 안 함)
function zombieSeparate(z, c) {
  const ts = c.ts;
  const sepRadius = ts * 1.1;
  let sepX = 0, sepY = 0;

  for (const other of zombies) {
    if (other === z) continue;
    const zcx = z.px + ts / 2, zcy = z.py + ts / 2;
    const ocx = other.px + ts / 2, ocy = other.py + ts / 2;
    const dx = zcx - ocx, dy = zcy - ocy;
    const d  = Math.hypot(dx, dy);
    if (d < sepRadius && d > 0) {
      const force = (sepRadius - d) / sepRadius;
      sepX += (dx / d) * force;
      sepY += (dy / d) * force;
    }
  }

  if (sepX !== 0 || sepY !== 0) {
    const strength = c.spd * 1.2;
    zombieMoveWithSlide(z, c, sepX * strength, sepY * strength);
  }
}

// ── 소음 이벤트 ──────────────────────────────────────────────────
// 발생 시점에 호출. 범위 내 좀비에게 "목표 좌표"를 심어줌.
// 상태는 직접 바꾸지 않고, target만 세팅 → 다음 zombieSense가 처리.
function triggerNoise(sourceX, sourceY, radiusTiles) {
  devNoiseMarker = { wx: sourceX, wy: sourceY, timer: 3.0, r: radiusTiles };
  const ts = CONFIG.map.tileSize;
  for (const z of zombies) {
    if (z.state === 'CHASE') continue;  // 추격 중엔 소음 무시
    const zcx = z.px + ts / 2, zcy = z.py + ts / 2;
    const distToSource = Math.hypot(sourceX - zcx, sourceY - zcy) / ts;
    if (distToSource > radiusTiles) continue;

    // 이미 더 가까운 목표가 있으면 무시
    if (z.hasTarget) {
      const distToCur = Math.hypot(z.targetWx - zcx, z.targetWy - zcy) / ts;
      if (distToSource >= distToCur) continue;
    }
    z.targetWx = sourceX;
    z.targetWy = sourceY;
    z.hasTarget = true;
    z.memoryTimer = CONFIG.zombie.noiseMemory;
  }
}

// ── ① 인식 + 상태 전환 (유일한 상태 변경 지점) ───────────────────
function zombieSense(z, c, zcx, zcy, distTiles) {
  // 시야 판정: 거리 + FOV + LOS
  let inSight = false;
  if (distTiles <= c.sightTiles) {
    const ang = Math.atan2(c.pcy - zcy, c.pcx - zcx);
    let diff = Math.abs(ang - z.facingAngle);
    if (diff > Math.PI) diff = Math.PI * 2 - diff;
    inSight = diff <= c.fovHalf && hasLOS(z.tx, z.ty, player.tx, player.ty);
  }
  // 근접 판정: 0.7타일 이내 무조건
  const inProximity = distTiles <= 0.7;

  if (inSight || inProximity) {
    // 플레이어 직접 인지 → CHASE, 목표 = 플레이어 실시간 위치
    z.state = 'CHASE';
    z.targetWx = c.pcx;
    z.targetWy = c.pcy;
    z.hasTarget = true;
    z.memoryTimer = CONFIG.zombie.chaseMemory;
    return;
  }

  // 직접 인지 없음 → 목표 기억으로 SEARCH
  if (z.hasTarget) {
    z.memoryTimer -= c.dt;
    if (z.memoryTimer <= 0) {
      // 기억 소멸 → 배회
      z.hasTarget = false;
      z.state = 'WANDER';
    } else {
      // CHASE였으면 마지막 위치로 SEARCH 강등, 목표 좌표는 유지
      z.state = 'SEARCH';
    }
  } else {
    z.state = 'WANDER';
  }
}

// ── ② 이동: 목표로 BFS 방향 한 발 + 충돌 슬라이딩 ────────────────
function zombieStep(z, c, zcx, zcy) {
  let mvx = 0, mvy = 0;

  if (z.state === 'WANDER') {
    [mvx, mvy] = zombieWanderVec(z, c);
  } else {
    // SEARCH / CHASE 공통: 목표 좌표로 BFS
    const gx = Math.floor(z.targetWx / c.ts);
    const gy = Math.floor(z.targetWy / c.ts);

    // 목표 타일 도달 판정
    const distToTarget = Math.hypot(z.targetWx - zcx, z.targetWy - zcy);
    if (distToTarget <= c.ts * 0.5) {
      if (z.state === 'SEARCH') {
        // 발원지 도착했는데 플레이어 없음 → 기억 소멸 가속(두리번)
        z.facingAngle += c.dt * 2.0;
        z.memoryTimer = Math.min(z.memoryTimer, 1.2);
        return;
      }
      // CHASE면 플레이어와 겹친 것 → 직선으로 밀착
      const a = Math.atan2(c.pcy - zcy, c.pcx - zcx);
      mvx = Math.cos(a) * c.spd;
      mvy = Math.sin(a) * c.spd;
    } else {
      const next = zombieNextStepDir(z.tx, z.ty, gx, gy);
      let a;
      if (next) {
        a = Math.atan2(next[1] * c.ts + c.ts / 2 - zcy,
                       next[0] * c.ts + c.ts / 2 - zcx);
      } else {
        a = Math.atan2(z.targetWy - zcy, z.targetWx - zcx);
      }
      z.facingAngle = a;
      const sp = z.state === 'CHASE' ? c.spd : c.spd * 0.85;
      mvx = Math.cos(a) * sp;
      mvy = Math.sin(a) * sp;
    }
  }

  zombieMoveWithSlide(z, c, mvx, mvy);
}

// 배회 이동 벡터
function zombieWanderVec(z, c) {
  z.wanderTimer -= c.dt;
  if (z.wanderTimer <= 0) {
    const dirs = shuffle([...DIR4]);
    for (const [dx, dy] of dirs) {
      const nx = z.tx + dx, ny = z.ty + dy;
      if (nx >= 0 && ny >= 0 && nx < MAP.width && ny < MAP.height
          && MAP.tiles[ny * MAP.width + nx] !== T.WALL) {
        z.facingAngle = Math.atan2(dy, dx);
        z.wanderTimer = 1.5 + Math.random() * 2.0;
        break;
      }
    }
  }
  return [Math.cos(z.facingAngle) * c.wSpd, Math.sin(z.facingAngle) * c.wSpd];
}

// 원형 충돌 + 축별 슬라이딩 이동 + 타일 좌표 동기화(중심 기준)
function zombieMoveWithSlide(z, c, mvx, mvy) {
  const { tiles, width, height } = MAP;
  const ts = c.ts, r = c.r;

  if (mvx !== 0) {
    const nx = z.px + mvx;
    if (!circleWallCollide(nx + ts / 2, z.py + ts / 2, r, ts, width, height, tiles)) {
      z.px = nx;
    }
  }
  if (mvy !== 0) {
    const ny = z.py + mvy;
    if (!circleWallCollide(z.px + ts / 2, ny + ts / 2, r, ts, width, height, tiles)) {
      z.py = ny;
    }
  }

  z.tx = Math.floor((z.px + ts / 2) / ts);
  z.ty = Math.floor((z.py + ts / 2) / ts);
}

// ── BFS 길찾기 (고정배열 큐, O(1) dequeue) ───────────────────────
function zombieNextStepDir(fromTx, fromTy, goalTx, goalTy) {
  const { tiles, width, height } = MAP;

  function nearestFloor(tx, ty) {
    if (tx >= 0 && ty >= 0 && tx < width && ty < height
        && tiles[ty * width + tx] !== T.WALL) return [tx, ty];
    for (const [dx, dy] of DIR4) {
      const nx = tx + dx, ny = ty + dy;
      if (nx >= 0 && ny >= 0 && nx < width && ny < height
          && tiles[ny * width + nx] !== T.WALL) return [nx, ny];
    }
    return [tx, ty];
  }

  [fromTx, fromTy] = nearestFloor(fromTx, fromTy);
  [goalTx, goalTy] = nearestFloor(goalTx, goalTy);
  if (fromTx === goalTx && fromTy === goalTy) return null;

  const visited = new Uint8Array(width * height);
  const parent  = new Int32Array(width * height).fill(-1);
  const queue   = new Int32Array(width * height);
  let head = 0, tail = 0;
  const startIdx = fromTy * width + fromTx;
  const goalIdx  = goalTy * width + goalTx;
  queue[tail++] = startIdx;
  visited[startIdx] = 1;
  let found = false;

  outer: while (head < tail) {
    const cur = queue[head++];
    const cx = cur % width, cy = (cur / width) | 0;
    for (const [dx, dy] of DIR4) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const ni = ny * width + nx;
      if (visited[ni] || tiles[ni] === T.WALL) continue;
      visited[ni] = 1;
      parent[ni] = cur;
      if (ni === goalIdx) { found = true; break outer; }
      queue[tail++] = ni;
    }
  }
  if (!found) return null;

  let cur = goalIdx;
  while (parent[cur] !== startIdx) {
    cur = parent[cur];
    if (cur === -1) return null;
  }
  return [cur % width, (cur / width) | 0];
}

// 원형 충돌 판정
function circleWallCollide(cx, cy, r, ts, width, height, tiles) {
  const x0 = Math.floor((cx - r) / ts), x1 = Math.floor((cx + r) / ts);
  const y0 = Math.floor((cy - r) / ts), y1 = Math.floor((cy + r) / ts);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (tx < 0 || ty < 0 || tx >= width || ty >= height) { return true; }
      if (tiles[ty * width + tx] !== T.WALL) continue;
      const nearX = Math.max(tx * ts, Math.min(cx, tx * ts + ts));
      const nearY = Math.max(ty * ts, Math.min(cy, ty * ts + ts));
      if (Math.hypot(cx - nearX, cy - nearY) < r) return true;
    }
  }
  return false;
}

// ── ③ 접촉 → 전투 미니게임 진입 ───────────────────────────────
function zombieContact(z, c, zcx, zcy) {
  if (minigame.postCooldown > 0) return; // 무적 쿨타임 중
  if (minigame.active) return;           // 이미 미니게임 중
  const dist = Math.hypot(zcx - c.pcx, zcy - c.pcy);
  if (dist < c.ts * 0.6 && player.damageCooldown <= 0) {
    player.damageCooldown = CONFIG.zombie.damageCool;
    if (!devInvincible) {
      // 회수 중 급습이면 interruptedMine 플래그
      const interrupted = minigame.type === 'mine';
      startMinigame('combat', -1, z, interrupted);
    } else {
      triggerFlash('red');
    }
  }
}


function isWallAt(px, py, mapWidth, ts, tiles) {
  const tx = Math.floor(px / ts);
  const ty = Math.floor(py / ts);
  if (tx < 0 || ty < 0 || tx >= mapWidth || ty >= Math.floor(tiles.length / mapWidth)) return true;
  return tiles[ty * mapWidth + tx] === T.WALL;
}

// ── 업데이트 ─────────────────────────────────────────────────────
function update(dt) {
  if (player.moving) {
    const spd = CONFIG.map.tileSize / CONFIG.player.moveDelay * dt;
    const dx  = player.targetX - player.px, dy = player.targetY - player.py;
    const dist = Math.hypot(dx, dy);
    if (dist <= spd) { player.px = player.targetX; player.py = player.targetY; player.moving = false; }
    else { player.px += dx / dist * spd; player.py += dy / dist * spd; }
  }
  updateZombies(dt);
  updateMinigame(dt);
  updateOxygenInfection(dt);
  const ts = CONFIG.map.tileSize;
  camX += (player.px + ts / 2 - W_px / 2 - camX) * CONFIG.camera.smooth;
  camY += (player.py + ts / 2 - H_px / 2 - camY) * CONFIG.camera.smooth;
}

// ── 산소 / 감염 업데이트 ─────────────────────────────────────────
let _prevOxyZone = 'safe';   // 'safe' | 'warn' | 'empty' — 로그 중복 방지
let _prevInfZone = 'low';    // 'low' | 'mid' | 'high'

function updateOxygenInfection(dt) {
  if (player.dead) return;
  const cfg = CONFIG.oxygen;

  // 산소 자연 감소 (스테이지별 속도)
  if (!devInvincible) {
    const drainRate = cfg.drainPerStage[Math.min(player.stage, cfg.drainPerStage.length - 1)];
    player.oxygen = Math.max(0, player.oxygen - drainRate * dt);
  }

  // 산소 구간 진입 로그
  const oxyZone = player.oxygen <= 0 ? 'empty' : player.oxygen < cfg.infectThreshold ? 'warn' : 'safe';
  if (oxyZone !== _prevOxyZone) {
    if (oxyZone === 'warn')  devLog(`⚠ 산소 위험구간 진입 (${player.oxygen.toFixed(1)}%) — 감염 시작`, 'warn');
    if (oxyZone === 'empty') devLog(`🔴 산소 고갈 — 감염 가속 시작`, 'danger');
    if (oxyZone === 'safe')  devLog(`산소 안전구간 복귀 (${player.oxygen.toFixed(1)}%)`, 'good');
    _prevOxyZone = oxyZone;
  }

  // 감염 증가 — 산소 60% 이하부터 시작
  if (!devInvincible) {
    if (player.oxygen <= 0) {
      player.infection = Math.min(100, player.infection + cfg.infectRateEmpty * dt);
    } else if (player.oxygen < cfg.infectThreshold) {
      player.infection = Math.min(100, player.infection + cfg.infectRate * dt);
    }
  }

  // 감염 구간 진입 로그
  const infZone = player.infection >= 75 ? 'high' : player.infection >= 40 ? 'mid' : 'low';
  if (infZone !== _prevInfZone) {
    if (infZone === 'mid')  devLog(`⚠ 감염 40% 돌파 (${player.infection.toFixed(1)}%)`, 'warn');
    if (infZone === 'high') devLog(`🔴 감염 75% 위험 (${player.infection.toFixed(1)}%)`, 'danger');
    if (infZone === 'low')  devLog(`감염 감소 — 저위험 복귀`, 'good');
    _prevInfZone = infZone;
  }

  // 좀비화 판정
  if (player.infection >= 100 && !player.dead) {
    devLog('💀 감염 100% — 좀비화', 'danger');
    showGameOver('infected');
  }
}

// ── 렌더링 ───────────────────────────────────────────────────────
function render() {
  const ts = CONFIG.map.tileSize;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W_px, H_px);
  ctx.save();
  ctx.translate(-camX, -camY);

  const tx0 = Math.max(0, Math.floor(camX / ts) - 1);
  const ty0 = Math.max(0, Math.floor(camY / ts) - 1);
  const tx1 = Math.min(MAP.width,  Math.ceil((camX + W_px) / ts) + 1);
  const ty1 = Math.min(MAP.height, Math.ceil((camY + H_px) / ts) + 1);

  const unlocked = player.itemsFound >= CONFIG.escape.itemCount;

  for (let ty = ty0; ty < ty1; ty++) for (let tx = tx0; tx < tx1; tx++) {
    const sx   = tx * ts, sy = ty * ts;
    const vis  = VISITED[ty * MAP.width + tx];
    const vis2 = VISIBLE[ty * MAP.width + tx];
    const tile = MAP.tiles[ty * MAP.width + tx];

    if (!vis) { ctx.fillStyle = '#050505'; ctx.fillRect(sx, sy, ts, ts); continue; }

    if (tile === T.WALL) {
      if (vis2) {
        ctx.fillStyle = '#1c1c1c'; ctx.fillRect(sx, sy, ts, ts);
        ctx.fillStyle = '#141414'; ctx.fillRect(sx+1, sy+1, ts-2, ts-2);
        ctx.strokeStyle = '#242424'; ctx.lineWidth = 1;
        ctx.strokeRect(sx+0.5, sy+0.5, ts-1, ts-1);
      } else {
        ctx.fillStyle = '#0e0e0e'; ctx.fillRect(sx, sy, ts, ts);
        ctx.fillStyle = '#0a0a0a'; ctx.fillRect(sx+1, sy+1, ts-2, ts-2);
      }
    } else {
      // 바닥 (FLOOR / MINE / ITEM / EXIT 공통 바닥)
      ctx.fillStyle = vis2 ? '#1e1e1e' : '#0f0f0f'; ctx.fillRect(sx, sy, ts, ts);
      if (vis2) { ctx.strokeStyle = '#252525'; ctx.lineWidth = 0.5; ctx.strokeRect(sx, sy, ts, ts); }

      // DEV 지뢰 표시
      if (tile === T.MINE && vis2 && devRevealMines) {
        ctx.save(); ctx.globalAlpha = 0.4;
        ctx.fillStyle = 'rgba(255,50,50,0.15)'; ctx.fillRect(sx, sy, ts, ts);
        ctx.strokeStyle = '#ff3333'; ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(sx+8, sy+8); ctx.lineTo(sx+ts-8, sy+ts-8);
        ctx.moveTo(sx+ts-8, sy+8); ctx.lineTo(sx+8, sy+ts-8);
        ctx.stroke(); ctx.restore();
      }

      // 아이템 / 출구 (RESOURCE LAYER)
      if (tile === T.ITEM && vis2) drawItem(tx, ty, ts);
      if (tile === T.EXIT && vis2) drawExit(tx, ty, ts, unlocked);
    }
  }

  // RESOURCE LAYER
  drawSonarPings();
  drawSonarPreciseMarks();
  drawSonarPulse();
  drawSonarCharging(ts);

  // DEV 소음 발원지 마커
  if (devNoiseMarker) {
    devNoiseMarker.timer -= 1 / 60;
    if (devNoiseMarker.timer <= 0) {
      devNoiseMarker = null;
    } else {
      const { wx, wy } = devNoiseMarker;
      const alpha = Math.min(1, devNoiseMarker.timer);
      ctx.save();
      ctx.globalAlpha = alpha * 0.8;
      ctx.strokeStyle = '#ff8800';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(wx, wy, ts * devNoiseMarker.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = alpha * 0.5;
      ctx.fillStyle = '#ff8800';
      ctx.beginPath(); ctx.arc(wx, wy, ts * 0.18, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  for (const z of zombies) {
    if (VISIBLE[z.ty * MAP.width + z.tx]) drawZombie(z, ts);
  }
  drawPlayer(ts);
  drawMinePrompt(ts);
  drawMinigame(ts);
  // END RESOURCE LAYER

  ctx.restore();

  // 비네팅
  ctx.fillStyle = vignetteGradient; ctx.fillRect(0, 0, W_px, H_px);
}

// ── 미니맵 ───────────────────────────────────────────────────────
function renderMinimap() {
  const { tiles, width, height } = MAP;
  const sz = CONFIG.minimap.size;
  const s  = sz / Math.max(width, height);
  const unlocked = player.itemsFound >= CONFIG.escape.itemCount;

  mmCtx.fillStyle = '#000'; mmCtx.fillRect(0, 0, sz, sz);

  for (let ty = 0; ty < height; ty++) for (let tx = 0; tx < width; tx++) {
    const i = ty * width + tx;
    if (!VISITED[i]) continue;
    const tile = tiles[i];
    if (tile === T.WALL) {
      mmCtx.fillStyle = '#1a1a1a';
    } else if (tile === T.ITEM) {
      mmCtx.fillStyle = '#ccaa00'; // 발견한 아이템 — 노란 점
    } else if (tile === T.EXIT) {
      mmCtx.fillStyle = unlocked ? '#00ff88' : '#004422'; // 잠금 상태에 따라
    } else {
      mmCtx.fillStyle = '#303030';
    }
    mmCtx.fillRect(tx * s, ty * s, s + 0.5, s + 0.5);
  }

  // 플레이어
  const ps = Math.max(s, 3);
  mmCtx.fillStyle = '#00ff88';
  mmCtx.fillRect(player.tx * s - ps/2 + s/2, player.ty * s - ps/2 + s/2, ps, ps);

  // 레이더: 소나 발동 후 radarTimer 동안 — 소나 반경 안에 있던 좀비만 표시
  if (sonar.radarTimer > 0) {
    const alpha = Math.min(1, sonar.radarTimer / CONFIG.sonar.radarDuration);
    mmCtx.save();
    mmCtx.globalAlpha = alpha * 0.85;
    for (const z of zombies) {
      const distTiles = Math.hypot(z.tx - player.tx, z.ty - player.ty);
      if (distTiles > sonar.radarRadius + 0.5) continue;  // 반경 밖 좀비 제외
      const zs = Math.max(s, 2.5);
      const col = z.state === 'CHASE' ? '#ff3333' : z.state === 'SEARCH' ? '#ff8800' : '#ff6644';
      mmCtx.fillStyle = col;
      mmCtx.beginPath();
      mmCtx.arc(z.tx * s + s / 2, z.ty * s + s / 2, zs, 0, Math.PI * 2);
      mmCtx.fill();
    }
    mmCtx.restore();
  }
}

// ── HUD & DEV ────────────────────────────────────────────────────
function updateHUD() {
  const cfg    = CONFIG.oxygen;
  const needed = CONFIG.escape.itemCount;
  const oxy    = Math.max(0, player.oxygen);
  const inf    = Math.max(0, player.infection);

  document.getElementById('hud-pos').textContent     = `${player.tx},${player.ty}`;
  document.getElementById('hud-basic').textContent   = sonar.charging ? 'CHARGE' : 'READY';
  document.getElementById('hud-precise').textContent = '📡 ' + sonar.precise;

  // 산소 게이지
  const oxyFill = document.getElementById('hud-oxygen-fill');
  const oxyVal  = document.getElementById('hud-oxygen');
  if (oxyFill) {
    oxyFill.style.width = oxy + '%';
    // 색상: 안전(파랑) → 위험구간(주황) → 위급(빨강)
    if (oxy > cfg.infectThreshold)      oxyFill.style.background = '#44aaff';
    else if (oxy > cfg.infectThreshold * 0.4) oxyFill.style.background = '#ff8800';
    else                                 oxyFill.style.background = '#ff3333';
  }
  if (oxyVal) oxyVal.textContent = Math.ceil(oxy) + '%';

  // 감염 게이지
  const infFill = document.getElementById('hud-infection-fill');
  const infVal  = document.getElementById('hud-infection');
  if (infFill) {
    infFill.style.width = inf + '%';
    // 색상: 낮음(초록) → 중간(주황) → 위험(빨강)
    if (inf < 40)      infFill.style.background = '#00ff88';
    else if (inf < 75) infFill.style.background = '#ff8800';
    else               infFill.style.background = '#ff3333';
  }
  if (infVal) {
    infVal.textContent = Math.ceil(inf) + '%';
    infVal.style.color = inf >= 75 ? '#ff3333' : inf >= 40 ? '#ff8800' : '#00ff88';
  }

  // 산소 캡슐 카운터
  const itemEl = document.getElementById('hud-items');
  itemEl.textContent = `${player.itemsFound}/${needed}`;
  itemEl.style.color = player.itemsFound >= needed ? '#00ff88' : '#44aaff';

  let visited = 0;
  for (let i = 0; i < VISITED.length; i++) if (VISITED[i]) visited++;
  document.getElementById('hud-explored').textContent = Math.floor(visited / MAP.floorCount * 100) + '%';
}

function updateDevInfo() {
  if (!document.getElementById('dev-panel').classList.contains('open')) return;
  const t = MAP.tiles[player.ty * MAP.width + player.tx];
  document.getElementById('di-fps').textContent     = fps;
  document.getElementById('di-tile').textContent    = t === T.WALL ? 'WALL' : t === T.MINE ? 'MINE' : t === T.ITEM ? 'ITEM' : t === T.EXIT ? 'EXIT' : 'FLOOR';
  document.getElementById('di-mines').textContent   = MAP.mineCount;
  document.getElementById('di-items').textContent   = `${player.itemsFound}/${CONFIG.escape.itemCount}`;
  document.getElementById('di-zombies').textContent = zombies.length;
  document.getElementById('di-dead').textContent    = Math.floor(MAP.deadEndRatio * 100) + '%';
  document.getElementById('di-time').textContent    = Math.floor((Date.now() - stats.startTime) / 1000) + 's';
  document.getElementById('di-oxygen').textContent  = Math.ceil(player.oxygen) + '%';
  document.getElementById('di-infect').textContent  = Math.ceil(player.infection) + '%';
}

// ── DEV 패널 ─────────────────────────────────────────────────────
document.getElementById('dev-toggle').addEventListener('click', () => {
  document.getElementById('dev-panel').classList.toggle('open');
  document.getElementById('dev-toggle').classList.toggle('on');
  resize();
});

const SLIDERS = [
  ['d-mapsize',   v => CONFIG.map.size             = parseInt(v)],
  ['d-tilesize',  v => CONFIG.map.tileSize         = parseInt(v)],
  ['d-loops',     v => CONFIG.map.loopPaths        = parseInt(v)],
  ['d-delay',     v => CONFIG.player.moveDelay     = parseFloat(v)],
  ['d-vision',    v => CONFIG.player.visionRad     = parseInt(v)],
  ['d-mine',      v => CONFIG.mine.density         = parseInt(v)],
  ['d-maxcharge', v => CONFIG.sonar.maxCharge      = parseFloat(v)],
  ['d-radius',    v => CONFIG.sonar.maxRadius      = parseInt(v)],
  ['d-pingdur',   v => CONFIG.sonar.pingDuration   = parseFloat(v)],
  ['d-precise',   v => CONFIG.sonar.preciseCount   = parseInt(v)],
  ['d-items',     v => CONFIG.escape.itemCount     = parseInt(v)],
  ['d-zcount',    v => CONFIG.zombie.count         = parseInt(v)],
  ['d-zspeed',    v => CONFIG.zombie.speed         = parseFloat(v)],
  ['d-oxydrain',  v => { CONFIG.oxygen.drainPerStage[0] = parseFloat(v); }],
  ['d-infthresh', v => CONFIG.oxygen.infectThreshold = parseInt(v)],
];
SLIDERS.forEach(([id, fn]) => {
  const el  = document.getElementById(id);
  const vEl = document.getElementById(id + '-v');
  el.addEventListener('input', () => { fn(el.value); vEl.textContent = el.value; });
});

document.getElementById('d-regen').addEventListener('click', () => init());
document.getElementById('d-reveal').addEventListener('click', () => {
  devRevealMines = !devRevealMines;
  document.getElementById('d-reveal').textContent = '💣 지뢰 표시 ' + (devRevealMines ? 'ON' : 'OFF');
});
document.getElementById('d-fulloxy').addEventListener('click', () => {
  player.oxygen = CONFIG.oxygen.max; player.dead = false;
  document.getElementById('gameover').classList.remove('show');
  document.getElementById('escaped').classList.remove('show');
});
document.getElementById('d-clearinf').addEventListener('click', () => {
  player.infection = 0;
});
document.getElementById('d-addprecise').addEventListener('click', () => { sonar.precise++; });
document.getElementById('d-additem').addEventListener('click', () => {
  if (player.itemsFound < CONFIG.escape.itemCount) player.itemsFound++;
});
document.getElementById('d-invincible').addEventListener('click', () => {
  devInvincible = !devInvincible;
  document.getElementById('d-invincible').textContent = '🛡 무적 모드 ' + (devInvincible ? 'ON' : 'OFF');
});
document.getElementById('d-revealall').addEventListener('click', () => {
  devRevealAll = !devRevealAll;
  document.getElementById('d-revealall').textContent = '👁 전체 밝히기 ' + (devRevealAll ? 'ON' : 'OFF');
  if (devRevealAll) { VISITED.fill(1); VISIBLE.fill(1); }
});
document.getElementById('d-killzombies').addEventListener('click', () => { zombies = []; });
document.getElementById('d-zombiefov').addEventListener('click', () => {
  devZombieFov = !devZombieFov;
  document.getElementById('d-zombiefov').textContent = '👁 좀비 시야 표시 ' + (devZombieFov ? 'ON' : 'OFF');
});
document.getElementById('go-btn').addEventListener('click', () => init());
document.getElementById('esc-btn').addEventListener('click', () => init());
document.getElementById('log-clear').addEventListener('click', () => {
  devLogEntries.length = 0; _renderDevLog();
});

// ── 메인 루프 ────────────────────────────────────────────────────
let lastTs = 0, fps = 0, frameCount = 0, fpsTimer = 0;

function loop(ts) {
  const dt = Math.min((ts - lastTs) / 1000, 0.1); lastTs = ts;
  frameCount++; fpsTimer += dt;
  if (fpsTimer >= 1) { fps = frameCount; frameCount = 0; fpsTimer = 0; }
  handleInput(dt); updateSonar(dt); update(dt);
  render(); renderMinimap(); updateHUD(); updateDevInfo();
  requestAnimationFrame(loop);
}

resize(); init();

// 소나 JIT 워밍업 — 오프스크린에서 draw 함수 한 번 실행
(function warmupSonar() {
  const oc = document.createElement('canvas');
  oc.width = 64; oc.height = 64;
  const octx = oc.getContext('2d');
  const _ctx = ctx;
  // ctx를 임시 교체해서 실제 경로 컴파일 유도
  // eslint-disable-next-line no-global-assign
  const saved = { pulseR: sonar.pulseR, pulseMaxR: sonar.pulseMaxR,
                  pulseWx: sonar.pulseWx, pulseWy: sonar.pulseWy };
  sonar.pulseR = 1; sonar.pulseMaxR = 10; sonar.pulseWx = 32; sonar.pulseWy = 32;
  // ctx 직접 교체 없이 빈 arc/fill 경로만 실행
  octx.save(); octx.beginPath(); octx.arc(32, 32, 10, 0, Math.PI*2);
  octx.strokeStyle='#00ff88'; octx.lineWidth=2.5; octx.stroke();
  octx.beginPath(); octx.arc(32,32,5,0,Math.PI*2); octx.fillStyle='#ffee44'; octx.fill();
  octx.restore();
  Object.assign(sonar, saved);
})();
lastTs = performance.now();
requestAnimationFrame(loop);
