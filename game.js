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
  if (z.hidden) return;  // 워프 이펙트 재생 중 숨김
  const cx = z.px + ts / 2;
  const cy = z.py + ts / 2;
  const r  = ts * 0.30;
  const zt = CONFIG.zombieTypes[z.type] || CONFIG.zombieTypes.BASIC;
  const typeColor = zt.color;

  // DEV 시야 표시 — 시야각 삼각형 + 청각 범위 점선 원
  if (devZombieFov) {
    ctx.save();

    // 센서 감지 원 — SENSOR 타입만 표시 (소나 파동 + sensorRange)
    if (zt.sensorRange > 0) {
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = typeColor;
      ctx.lineWidth   = 2.5;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(cx, cy, zt.sensorRange * ts, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 시야각 삼각형
    const fovR    = zt.fovRange * ts;
    const fovHalf = (zt.fovAngle * patrol.fovMult / 2) * Math.PI / 180;
    ctx.globalAlpha = 0.15;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, fovR, z.facingAngle - fovHalf, z.facingAngle + fovHalf);
    ctx.closePath();
    ctx.fillStyle = z.state === 'CHASE' ? '#ff3333' : z.state === 'SEARCH' ? '#ff8800' : typeColor;
    ctx.fill();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = z.state === 'CHASE' ? '#ff6666' : z.state === 'SEARCH' ? '#ffaa44' : typeColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.restore();
  }

  ctx.save();

  // 후광 — 타입 색상
  ctx.globalAlpha = 0.12;
  ctx.beginPath(); ctx.arc(cx, cy, r * 1.9, 0, Math.PI * 2);
  ctx.fillStyle = typeColor; ctx.fill();
  ctx.globalAlpha = 1;

  // 몸통 — BASIC: 원, 나머지: 타입별 형태
  const stateCol = z.state === 'CHASE'  ? lightenHex(typeColor, 0.4)
                 : z.state === 'SEARCH' ? lightenHex(typeColor, 0.2)
                 : typeColor;

  if (z.type === 'BASIC') {
    // 기본: 원형
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = stateCol; ctx.fill();

  } else if (z.type === 'SENSOR') {
    // 청각형: 원 + 양쪽 귀 (타원)
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = stateCol; ctx.fill();
    ctx.save();
    ctx.fillStyle = typeColor;
    // 왼쪽 귀
    ctx.beginPath();
    ctx.ellipse(cx - r * 0.9, cy - r * 0.5, r * 0.18, r * 0.45, -0.4, 0, Math.PI * 2);
    ctx.fill();
    // 오른쪽 귀
    ctx.beginPath();
    ctx.ellipse(cx + r * 0.9, cy - r * 0.5, r * 0.18, r * 0.45, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

  } else if (z.type === 'GUARD') {
    // 순찰형: 방패 (사각형 + 아래 삼각)
    ctx.beginPath();
    ctx.moveTo(cx - r, cy - r * 0.8);
    ctx.lineTo(cx + r, cy - r * 0.8);
    ctx.lineTo(cx + r, cy + r * 0.2);
    ctx.lineTo(cx,     cy + r * 1.0);
    ctx.lineTo(cx - r, cy + r * 0.2);
    ctx.closePath();
    ctx.fillStyle = stateCol; ctx.fill();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.globalAlpha = 0.3;
    ctx.stroke(); ctx.globalAlpha = 1;

  } else if (z.type === 'STALKER') {
    // 추적형: 원 + 주변 가시 4개
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.85, 0, Math.PI * 2);
    ctx.fillStyle = stateCol; ctx.fill();
    ctx.fillStyle = typeColor;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + z.facingAngle;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r * 0.85, cy + Math.sin(a) * r * 0.85);
      ctx.lineTo(cx + Math.cos(a - 0.25) * r * 0.6, cy + Math.sin(a - 0.25) * r * 0.6);
      ctx.lineTo(cx + Math.cos(a + 0.25) * r * 0.6, cy + Math.sin(a + 0.25) * r * 0.6);
      ctx.closePath();
      ctx.fill();
    }

  } else if (z.type === 'RUSHER') {
    // 돌진형: 화살표 (앞이 뾰족)
    const a = z.facingAngle;
    const cos = Math.cos(a), sin = Math.sin(a);
    const perp = a + Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(cx + cos * r,                     cy + sin * r);
    ctx.lineTo(cx + Math.cos(perp) * r * 0.7,   cy + Math.sin(perp) * r * 0.7);
    ctx.lineTo(cx - cos * r * 0.5,               cy - sin * r * 0.5);
    ctx.lineTo(cx - Math.cos(perp) * r * 0.7,   cy - Math.sin(perp) * r * 0.7);
    ctx.closePath();
    ctx.fillStyle = stateCol; ctx.fill();
  }

  // 방향 도트 (공통)
  const ang = z.facingAngle;
  ctx.beginPath();
  ctx.arc(cx + Math.cos(ang) * r * 0.45, cy + Math.sin(ang) * r * 0.45, r * 0.18, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fill();

  // 타입 표시 텍스트 (그래픽 전까지 임시)
  if (z.type !== 'BASIC') {
    ctx.font = `bold ${ts * 0.18}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.85;
    const label = { SENSOR:'S', GUARD:'G', STALKER:'T', RUSHER:'R' }[z.type] || '';
    ctx.fillText(label, cx, cy + r * 1.6);
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

// 색상 밝히기 유틸
function lightenHex(hex, amount) {
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);
  const lr = Math.min(255, Math.floor(r + (255 - r) * amount));
  const lg = Math.min(255, Math.floor(g + (255 - g) * amount));
  const lb = Math.min(255, Math.floor(b + (255 - b) * amount));
  return `rgb(${lr},${lg},${lb})`;
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

function drawNoisePulses() {
  for (const p of noisePulses) {
    if (p.r <= 0) continue;
    const progress = Math.min(p.r / p.maxR, 1);
    const alpha = Math.max(0, 0.7 * (1 - progress));
    ctx.save();
    ctx.beginPath();
    ctx.arc(p.wx, p.wy, p.r, 0, Math.PI * 2);
    ctx.strokeStyle = p.color;
    ctx.lineWidth   = 2;
    ctx.globalAlpha = alpha;
    ctx.stroke();
    ctx.globalAlpha = alpha * 0.06;
    ctx.fillStyle = p.color;
    ctx.fill();
    ctx.restore();
  }
}

// ── 플로팅 텍스트 팝업 (캐릭터 주변) ────────────────────────────
// wx/wy는 delay 끝난 시점에 플레이어 위치로 확정
function addPopup(text, color = '#00ff88', delay = 0) {
  popups.push({
    text,
    wx:      null,   // delay 끝날 때 확정
    wy:      null,
    color,
    alpha:   1.0,
    life:    2.2,
    maxLife: 2.2,
    vy:      -24,
    delay,
    started: false,
  });
}

// ── 화면 중앙 상단 공지 팝업 (전부회수/패트롤) ──────────────────
const notices = [];  // { text, color, alpha, life, maxLife }

function addNotice(text, color = '#00ffcc', duration = 3.0) {
  // 기존 같은 텍스트 중복 방지
  notices.push({
    text,
    color,
    alpha:   1.0,
    life:    duration,
    maxLife: duration,
  });
}

// ── "그는 사람이었어" 연출 ────────────────────────────────────────
// 감염자(전사자)와 전투 패배 시 — 화면 중앙 하단에 보라빛 텍스트 표시
// ── 플레이어 대사 ────────────────────────────────────────────────
const VOICE = {
  // 감염자 안식 성공 (치료제 Y)
  restSuccess: {
    ko: ['잘 가', '쉬어'],
    en: ['Goodbye', 'Rest'],
  },
  // 감염자 전투 승리 (소멸 — 구하지 못한 것)
  infectedDown: {
    ko: ['미안', '어쩔 수 없었어'],
    en: ['Sorry', 'No choice'],
  },
  // 크리쳐 치료제 낭비
  serumWasted: {
    ko: ['사람이 아니야'],
    en: ['Not human'],
  },
  // 크리쳐 전투 승리 (워프 이탈)
  creatureWarp: {
    ko: ['사라졌어', '어디로…'],
    en: ['Gone', 'Where…'],
  },
};

function pickVoice(key) {
  const lang = 'ko';   // TODO: 다국어 전환 시 'en'으로 교체
  const arr  = VOICE[key]?.[lang];
  if (!arr || arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

function showRegretNotice(unitLabel) {
  const line1 = unitLabel ? `${unitLabel} — 그는 사람이었어.` : '그는 사람이었어.';
  addNotice(line1, '#cc88ff', 4.0);
}

// ── 대사 팝업 (플레이어 좌측 고정) ─────────────────────────────
// 수치 팝업(위로 올라감)과 분리된 채널
// fade-in 0.3s → 유지 → fade-out 0.5s
const voicePopups = [];  // { text, color, life, maxLife, alpha }

function addVoicePopup(text, color = '#ffffff') {
  // 기존 대사 즉시 제거 (한 번에 하나만)
  voicePopups.length = 0;
  voicePopups.push({
    text,
    color,
    life:    2.8,
    maxLife: 2.8,
    alpha:   0,
  });
}

function drawVoicePopup(dt) {
  if (voicePopups.length === 0) return;
  const ts  = CONFIG.map.tileSize;

  // 플레이어 화면 좌표 (줌 반영)
  const spx = worldToScreenX(player.px + ts / 2);
  const spy = worldToScreenY(player.py + ts / 2);

  // 좌측 오프셋 — 플레이어 반지름 + 여백 (줌 반영)
  const OFFSET_X = ts * 0.9 * ZOOM;
  const OFFSET_Y = 0;

  ctx.save();
  ctx.textAlign    = 'left';
  ctx.textBaseline = 'middle';
  ctx.font         = 'bold 12px monospace';

  for (let i = voicePopups.length - 1; i >= 0; i--) {
    const v = voicePopups[i];
    v.life -= dt;

    // fade-in 앞 10% / fade-out 뒤 18%
    const t = v.life / v.maxLife;          // 1→0
    const progress = 1 - t;               // 0→1
    v.alpha = progress < 0.10 ? progress / 0.10
            : t < 0.18        ? t / 0.18
            : 1.0;

    if (v.life <= 0) { voicePopups.splice(i, 1); continue; }

    const x = spx - OFFSET_X;
    const y = spy + OFFSET_Y;

    // 텍스트 그림자
    ctx.globalAlpha = v.alpha * 0.85;
    ctx.strokeStyle = 'rgba(0,0,0,0.9)';
    ctx.lineWidth   = 3.5;
    ctx.strokeText(v.text, x, y);

    // 텍스트 본체
    ctx.fillStyle   = v.color;
    ctx.fillText(v.text, x, y);
  }
  ctx.restore();
}

function drawPopups(dt) {
  // ctx.restore() 이후 화면 좌표계에서 호출됨 (줌 반영)
  const ts  = CONFIG.map.tileSize;
  const spx = worldToScreenX(player.px + ts / 2);  // 플레이어 화면 x 중앙
  const spy = worldToScreenY(player.py);            // 플레이어 화면 y 상단

  ctx.save();
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.font         = 'bold 11px monospace';

  for (let i = popups.length - 1; i >= 0; i--) {
    const p = popups[i];

    // 딜레이 처리 — 끝나는 순간 화면 좌표 확정
    if (p.delay > 0) {
      p.delay -= dt;
      if (p.delay <= 0 && !p.started) {
        const living = popups.filter(q => q.started && q.life > 0);
        p.sx      = spx;
        p.sy      = spy - 20 - living.length * 22;
        p.started = true;
      }
      continue;
    }

    // delay 없이 바로 시작
    if (!p.started) {
      const living = popups.filter(q => q.started && q.life > 0);
      p.sx      = spx;
      p.sy      = spy - 20 - living.length * 22;
      p.started = true;
    }

    // 업데이트 (화면 y 좌표로 올라감)
    p.sy   += p.vy * dt;
    p.life -= dt;
    p.alpha = Math.max(0, p.life / p.maxLife);
    if (p.life <= 0) { popups.splice(i, 1); continue; }

    // 렌더 (화면 좌표계)
    ctx.globalAlpha = p.alpha;
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.lineWidth   = 3;
    ctx.strokeText(p.text, p.sx, p.sy);
    ctx.fillStyle   = p.color;
    ctx.fillText(p.text, p.sx, p.sy);
  }
  ctx.restore();
}

function drawNotices(dt) {
  if (notices.length === 0) return;

  ctx.save();
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.font         = 'bold 14px monospace';  // 측정 전에 font 먼저 설정

  let offsetY = 60;

  for (let i = notices.length - 1; i >= 0; i--) {
    const n = notices[i];
    n.life -= dt;
    // 앞 30%는 페이드인, 뒤 30%는 페이드아웃
    const t = n.life / n.maxLife;
    n.alpha = t > 0.7 ? Math.min(1, (1 - t) / 0.3)
            : t < 0.3 ? t / 0.3
            : 1.0;
    if (n.life <= 0) { notices.splice(i, 1); continue; }

    const x  = W_px / 2;
    const y  = offsetY;
    const tw = ctx.measureText(n.text).width + 32;  // font 설정 후 측정
    const th = 30;

    // 배경 박스
    ctx.globalAlpha = n.alpha * 0.75;
    ctx.fillStyle   = 'rgba(0,0,0,0.80)';
    ctx.fillRect(x - tw / 2, y - th / 2, tw, th);
    ctx.strokeStyle = n.color;
    ctx.lineWidth   = 1.5;
    ctx.strokeRect(x - tw / 2, y - th / 2, tw, th);

    // 텍스트
    ctx.globalAlpha = n.alpha;
    ctx.strokeStyle = 'rgba(0,0,0,0.9)';
    ctx.lineWidth   = 3;
    ctx.strokeText(n.text, x, y);
    ctx.fillStyle   = n.color;
    ctx.fillText(n.text, x, y);

    offsetY += th + 8;
  }
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
      // 좀비: 진영별 색상 + 알파벳
      const isInfected = m.faction === 'INFECTED';
      const mainCol  = isInfected ? '#bb44ff' : '#ff4444';
      const bgCol    = isInfected ? 'rgba(140,0,220,0.12)' : 'rgba(255,50,50,0.12)';
      const label    = isInfected ? 'I' : 'C';
      const cx = wx + ts / 2, cy = wy + ts / 2;

      // 배경
      ctx.fillStyle = bgCol; ctx.fillRect(wx, wy, ts, ts);

      // 눈 타원
      ctx.strokeStyle = mainCol; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, ts * 0.28, ts * 0.18, 0, 0, Math.PI * 2);
      ctx.stroke();

      // 동공
      ctx.beginPath();
      ctx.arc(cx, cy, ts * 0.08, 0, Math.PI * 2);
      ctx.fillStyle = mainCol; ctx.fill();

      // [C] / [I] 레이블
      ctx.font = `bold ${ts * 0.18}px monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = mainCol;
      ctx.fillText(`[${label}]`, cx, cy + ts * 0.38);

      // INFECTED + fallenUnit 인식표
      if (isInfected && m.fallenUnit !== null) {
        ctx.font = `${ts * 0.13}px monospace`;
        ctx.fillStyle = 'rgba(187,68,255,0.8)';
        ctx.fillText(`U-${String(m.fallenUnit).padStart(2,'0')}`, cx, cy + ts * 0.55);
      }
    }

    ctx.restore();
  }
}

function drawMinigame(ts) {
  if (!minigame.active) return;

  // ctx는 이미 translate(-camX,-camY) 상태 → 월드 좌표 사용
  const wx = player.px + ts / 2;
  const wy = player.py - ts * 0.3;

  drawMinigameContent(wx, wy, ts);
}

function drawMinigameContent(wx, wy, ts) {

  // 타입별 박스 크기
  const boxW = minigame.type === 'mine'
    ? Math.max(minigame.pattern.length * 28 + 16, 80)
    : 120; // 전투는 고정 너비
  const boxH = 44;
  const bx   = wx - boxW / 2;
  const by   = wy - boxH - 8;

  // 배경
  ctx.save();
  ctx.globalAlpha = 0.88;
  ctx.fillStyle   = minigame.flashTimer > 0 ? '#3a0000' : '#0d0d0d';
  ctx.strokeStyle = minigame.type === 'mine' ? '#ff4444' : '#ff8800';
  ctx.lineWidth   = 1.5;
  roundRect(ctx, bx, by, boxW, boxH, 4);
  ctx.fill(); ctx.stroke();
  ctx.restore();

  // 타입 레이블
  ctx.save();
  ctx.fillStyle    = minigame.type === 'mine' ? '#ff4444' : '#ff8800';
  ctx.font         = `bold ${ts * 0.2}px monospace`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(minigame.type === 'mine' ? '회수' : '전투', wx, by + 4);
  ctx.restore();

  // 결과 표시
  if (minigame.result) {
    ctx.save();
    ctx.fillStyle    = minigame.result === 'success' ? '#00ff88' : '#ff3333';
    ctx.font         = `bold ${ts * 0.3}px monospace`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(minigame.result === 'success' ? '✓ OK' : '✗ FAIL', wx, by + boxH * 0.6);
    ctx.restore();
    return;
  }

  // ── 병원체 회수: WASD 키캡 패턴 ──
  if (minigame.type === 'mine') {
    const dirSymbol = { up:'▲', down:'▼', left:'◀', right:'▶' };
    const startX = bx + 8;
    for (let i = 0; i < minigame.pattern.length; i++) {
      const ix = startX + i * 28;
      const iy = by + 14;
      const done    = i < minigame.current;
      const isCur   = i === minigame.current;
      // 키캡 배경
      ctx.save();
      ctx.fillStyle   = done ? '#003322' : isCur ? '#223300' : '#1a1a1a';
      ctx.strokeStyle = done ? '#00ff88'  : isCur ? '#aaff00' : '#333';
      ctx.lineWidth = 1;
      roundRect(ctx, ix, iy, 22, 18, 3);
      ctx.fill(); ctx.stroke();
      ctx.restore();
      // 방향 심볼
      ctx.save();
      ctx.fillStyle  = done ? '#00ff88' : isCur ? '#ccff44' : '#444';
      ctx.font       = `${ts * 0.18}px monospace`;
      ctx.textAlign  = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(dirSymbol[minigame.pattern[i]], ix + 11, iy + 10);
      ctx.restore();
    }
  }

  // ── 전투: 게이지 힘싸움 ──
  if (minigame.type === 'combat') {
    const gw = boxW - 16, gh = 14;
    const gx = bx + 8, gy = by + 15;
    const gaugeRatio = Math.min(1, minigame.combatGauge / MG.combatGaugeMax);
    const mashTotal  = (TUT_ACTIVE) ? MG.combatMashTime * TUT_COMBAT_TIME_MULT : MG.combatMashTime;
    const timeRatio  = Math.max(0, minigame.mashTimer / mashTotal);

    // 배경
    ctx.save();
    ctx.fillStyle = '#1a0000';
    roundRect(ctx, gx, gy, gw, gh, 3);
    ctx.fill();
    ctx.restore();

    // 플레이어 게이지
    if (gaugeRatio > 0) {
      ctx.save();
      ctx.fillStyle = gaugeRatio > 0.7 ? '#00ff88' : gaugeRatio > 0.4 ? '#ffaa00' : '#ff4400';
      roundRect(ctx, gx, gy, gw * gaugeRatio, gh, 3);
      ctx.fill();
      ctx.restore();
    }

    // 시간 게이지 (하단 2px)
    ctx.save();
    ctx.fillStyle = `hsl(${timeRatio * 30},90%,40%)`;
    ctx.fillRect(gx, gy + gh - 2, gw * timeRatio, 2);
    ctx.restore();

    // 테두리
    ctx.save();
    ctx.strokeStyle = '#ff8800';
    ctx.lineWidth = 1.5;
    roundRect(ctx, gx, gy, gw, gh, 3);
    ctx.stroke();
    ctx.restore();

    // F키 힌트 텍스트
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = `bold ${ts * 0.17}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('< F 연타 >', wx, gy + gh / 2);
    ctx.restore();

    // ── 치료제 선택지 오버레이 (본게임 전용 — 튜토리얼은 화면 정중앙 오버레이가 전담) ──
    if (minigame.serumChoice && !TUT_ACTIVE) {
      const z        = minigame.combatZombie;
      const faction  = z ? z.faction : null;
      const identified = z ? z.identified : false;
      let identLabel, identCol;
      if (!identified) {
        identLabel = '정체 불명'; identCol = '#aaaaaa';
      } else if (faction === 'INFECTED') {
        identLabel = '감염자 확인됨'; identCol = '#bb44ff';
      } else {
        identLabel = '크리쳐 확인됨'; identCol = '#ff4444';
      }

      if (_touchControlsActive) {
        // 모바일 — Y/N은 하단 터치 버튼(#touch-serum-choice)이 전담. 캔버스에는 식별 정보만 작게 표시해
        // 화면 하단의 터치 버튼과 겹치지 않게 함 (기존엔 Y/N 텍스트까지 포함된 큰 박스가 플레이어 위치에 따라 겹쳤음)
        const cw = 150, ch = 28;
        const cx2 = wx - cw / 2, cy2 = by - ch - 6;
        ctx.save();
        ctx.globalAlpha = 0.95;
        ctx.fillStyle   = '#0d0d1a';
        ctx.strokeStyle = '#bb44ff';
        ctx.lineWidth   = 1.5;
        roundRect(ctx, cx2, cy2, cw, ch, 5);
        ctx.fill(); ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.textAlign   = 'center';
        ctx.textBaseline = 'middle';
        ctx.font        = `bold ${ts * 0.16}px monospace`;
        ctx.fillStyle   = identCol;
        ctx.fillText(identLabel, wx, cy2 + ch / 2 + 1);
        ctx.restore();
      } else {
        // 배경 박스 (더 넓게)
        const cw = 160, ch = 62;
        const cx2 = wx - cw / 2, cy2 = by - ch - 6;
        ctx.save();
        ctx.globalAlpha = 0.95;
        ctx.fillStyle   = '#0d0d1a';
        ctx.strokeStyle = '#bb44ff';
        ctx.lineWidth   = 1.5;
        roundRect(ctx, cx2, cy2, cw, ch, 5);
        ctx.fill(); ctx.stroke();

        // 식별 상태 텍스트
        ctx.globalAlpha = 1;
        ctx.textAlign   = 'center';
        ctx.font        = `bold ${ts * 0.16}px monospace`;
        ctx.fillStyle = identCol;
        ctx.fillText(identLabel, wx, cy2 + 12);

        // Y/N 버튼
        ctx.font      = `bold ${ts * 0.17}px monospace`;
        ctx.fillStyle = '#bb44ff';
        ctx.fillText('[Y] 치료제 투여', wx, cy2 + 30);
        ctx.fillStyle = '#888888';
        ctx.fillText('[N] 계속 싸우기', wx, cy2 + 46);

        // 남은 시간 바
        const choiceTotal = TUT_ACTIVE ? TUT_SERUM_CHOICE_TIME : CONFIG.serum.choiceTime;
        const tr = minigame.serumChoiceTimer / choiceTotal;
        ctx.fillStyle = '#bb44ff';
        ctx.globalAlpha = 0.4;
        ctx.fillRect(cx2 + 4, cy2 + ch - 4, (cw - 8) * tr, 3);

        ctx.restore();
      }
    }
  }

}

// E키 프롬프트 — 병원체 위에 서 있을 때
function drawMinePrompt(ts) {
  const tileIdx = player.ty * MAP.width + player.tx;
  if (MAP.tiles[tileIdx] !== T.MINE) return;
  if (!MAP.detected[tileIdx]) return; // 미탐지 병원체는 프롬프트 없음
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

// ── 튜토리얼 평시 치료제 선택 UI — 플레이어 머리 위, 본게임 전투선택지와 비슷한 톤 ──
function drawTutorialSerumPrompt(ts) {
  if (!TUT_ACTIVE) return;
  if (TUT_STEP !== 'serum_prompt' && TUT_STEP !== 'serum_use_wait') return;
  // serum_prompt(Y/N) 단계는 화면 정중앙 오버레이가 전담 — 캔버스 힌트 불필요(PC/모바일 공통)
  if (TUT_STEP === 'serum_prompt') return;

  const wx = player.px + ts / 2;
  const wy = player.py - ts * 0.3;
  const cw = 150, ch = TUT_STEP === 'serum_prompt' ? 44 : 28;
  const cx = wx - cw / 2, cy = wy - ts * 1.1 - ch;

  ctx.save();
  ctx.globalAlpha = 0.95;
  ctx.fillStyle   = '#0d0d1a';
  ctx.strokeStyle = '#bb44ff';
  ctx.lineWidth   = 1.5;
  roundRect(ctx, cx, cy, cw, ch, 5);
  ctx.fill(); ctx.stroke();

  ctx.globalAlpha = 1;
  ctx.textAlign   = 'center';
  ctx.font        = `bold ${ts * 0.16}px monospace`;
  if (TUT_STEP === 'serum_prompt') {
    ctx.fillStyle = '#bb44ff';
    ctx.fillText('[Y] 치료제 사용', wx, cy + 16);
    ctx.fillStyle = '#888888';
    ctx.fillText('[N] 보류', wx, cy + 32);
    // 남은 시간 바
    if (TUT_SERUM_PROMPT_TIMER > 0) {
      const tr = TUT_SERUM_PROMPT_TIMER / 5.0;
      ctx.fillStyle = '#bb44ff';
      ctx.globalAlpha = 0.4;
      ctx.fillRect(cx + 4, cy + ch - 4, (cw - 8) * tr, 3);
    }
  } else {
    ctx.fillStyle = '#bb44ff';
    ctx.fillText('[D] 치료제 사용', wx, cy + 18);
  }
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
  const sIdx = Math.min(player.stage, CONFIG.stages.length - 1);
  let sz = CONFIG.stages[sIdx].mapSize;
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

  // 병원체 배치 — 스테이지별 고정 개수, 격자 구역 분산 배치
  const stageIdx = Math.min(player.stage, CONFIG.stages.length - 1);
  const targetMineCount = CONFIG.stages[stageIdx].mineCount;
  const mineCandidates = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (get(x, y) === T.FLOOR && !safeSet.has(`${x},${y}`)) mineCandidates.push([x, y]);
  }

  // 맵을 NxN 구역으로 나눠 각 구역에서 1개씩 배치 → 고른 분산
  const gridN = Math.ceil(Math.sqrt(targetMineCount * 1.5)); // 여유있게 구역 수 설정
  const cellW = W / gridN, cellH = H / gridN;
  const zones = Array.from({ length: gridN * gridN }, () => []);
  for (const [x, y] of mineCandidates) {
    const zi = Math.min(Math.floor(x / cellW), gridN - 1);
    const zj = Math.min(Math.floor(y / cellH), gridN - 1);
    zones[zj * gridN + zi].push([x, y]);
  }
  // 각 구역 셔플 후 비어있지 않은 구역부터 순환하며 배치
  const zoneOrder = shuffle(zones.map((_, i) => i).filter(i => zones[i].length > 0));
  let mineCount = 0;
  for (let attempt = 0; mineCount < targetMineCount && attempt < targetMineCount * 3; attempt++) {
    const zi = zoneOrder[mineCount % zoneOrder.length];
    const zone = zones[zi];
    if (zone.length === 0) continue;
    const pick = zone.splice(Math.floor(Math.random() * zone.length), 1)[0];
    set(pick[0], pick[1], T.MINE); mineCount++;
  }

  // 아이템 배치 — 스폰 거리 기준 구간 분할, 각 구간에서 1개씩
  const itemCandidates = floorTiles.filter(([x, y]) => !safeSet.has(`${x},${y}`) && get(x, y) === T.FLOOR);
  const sIdxItem = Math.min(player.stage, CONFIG.stages.length - 1);
  const needed = Math.min(CONFIG.stages[sIdxItem].capsuleCount, itemCandidates.length);
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

  // 출구 배치 — 시작점에서 먼 상위 30% 타일 중 랜덤 선택
  const exitCandidates = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (get(x, y) !== T.FLOOR) continue;
    exitCandidates.push({ x, y, d: Math.hypot(x - 1, y - 1) });
  }
  exitCandidates.sort((a, b) => b.d - a.d);
  const exitPool = exitCandidates.slice(0, Math.max(1, Math.floor(exitCandidates.length * 0.3)));
  const exitPick = exitPool[Math.floor(Math.random() * exitPool.length)];
  if (exitPick) set(exitPick.x, exitPick.y, T.EXIT);

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

  const detected = new Uint8Array(W * H); // 소나 탐지 여부 (0=미탐지, 1=탐지됨)
  return { tiles, numbers, detected, width:W, height:H, floorCount, mineCount, deadEndCount, deadEndRatio };
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

// ── 튜토리얼 전용 동적 비네팅(터널비전) ──────────────────────────
// radius: 0(완전 안 보임)~1(정상 시야) 비율. mode: null | 'mild'(채집중,약) | 'aftermath'(전투후,강)
const TUT_VIGNETTE = { active: false, mode: null, radius: 1, pulseT: 0 };

function drawTutorialVignette() {
  if (!TUT_VIGNETTE.active) return;
  const ts = CONFIG.map.tileSize;
  const cx = W_px / 2, cy = H_px / 2;
  // radius 0~1을 실제 픽셀 반경으로 변환 — mild는 2.2칸, aftermath는 0.5칸을 "정상 시야"로 간주
  const maxR = ts * (TUT_VIGNETTE.mode === 'aftermath' ? 0.5 : 2.2) * ZOOM;
  const innerR = Math.max(4, maxR * TUT_VIGNETTE.radius);
  const outerR = innerR + ts * 0.9 * ZOOM;
  const grad = ctx.createRadialGradient(cx, cy, innerR, cx, cy, outerR);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.96)');
  ctx.save();
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W_px, H_px);
  ctx.restore();
}

function updateTutorialVignette(dt) {
  if (!TUT_VIGNETTE.active) return;
  if (TUT_VIGNETTE.mode === 'aftermath') {
    // 펄스: 0.5칸 이하를 중심으로 2~3초 주기로 천천히 줄었다 늘었다
    TUT_VIGNETTE.pulseT += dt;
    const period = 2.6;
    const t = (TUT_VIGNETTE.pulseT % period) / period;
    TUT_VIGNETTE.radius = 0.15 + 0.20 * (0.5 - 0.5 * Math.cos(t * Math.PI * 2)); // 0.15~0.35 사이 숨쉬듯
  } else if (TUT_VIGNETTE.mode === 'precise_release') {
    // 정밀소나 핑이 퍼지는 진행률(sonar.pulseR/pulseMaxR)에 비네팅 반경을 그대로 매핑
    // — 핑이 퍼지는 것과 정확히 같은 속도로 시야가 풀림
    const progress = sonar.pulseMaxR > 0 ? Math.min(1, sonar.pulseR / sonar.pulseMaxR) : 1;
    TUT_VIGNETTE.radius = 0.30 + (1 - 0.30) * progress; // aftermath 펄스(약 0.30)에서 정상(1)까지
    if (progress >= 1) TUT_VIGNETTE.active = false; // 다 풀리면 비네팅 종료
  }
}

// 급속 수렴 — 현재 radius(보통 1)에서 목표(aftermath 펄스 시작값)까지 빠르게 좁혀짐
function collapseVignetteTo(mode, durationMs, targetRadius, onDone) {
  TUT_VIGNETTE.active = true;
  TUT_VIGNETTE.mode = mode;
  const startR = TUT_VIGNETTE.radius;
  const t0 = performance.now();
  function step() {
    const t = Math.min(1, (performance.now() - t0) / durationMs);
    TUT_VIGNETTE.radius = startR + (targetRadius - startR) * t;
    if (t < 1) requestAnimationFrame(step);
    else if (onDone) onDone();
  }
  requestAnimationFrame(step);
}

const player = {
  tx:1, ty:1, px:0, py:0, targetX:0, targetY:0,
  moving:false, facing:'down',
  dead:false,
  itemsFound:     0,
  totalCollected: 0,
  exitCooldown:   0,
  recordSaved:    false,
  lastFinalCollected: 0,
  oxygen:    100,
  infection:   0,
  stage:       0,
  serum:       1,   // 치료제 보유량 (초기 1개)
};

const sonar = {
  charging: false, chargeTime: 0,
  chargingPrecise: false, chargeTimePrecise: 0,
  firing: false, pulseR: 0, pulseMaxR: 0, pulseWx: 0, pulseWy: 0,
  pings: [], preciseMarks: [],
  precise: 2,
  radarTimer: 0,
  radarRadius: 0,
};

// 소음 파동 풀 — { wx, wy, r, maxR, color } 배열
const noisePulses = [];
const popups = [];   // 플로팅 텍스트 팝업 { text, wx, wy, color, alpha, life, maxLife, vy, delay }

// ── 좀비 소멸/워프 이펙트 ────────────────────────────────────────
// type: 'dissolve' (감염자 소멸) | 'warp' (크리쳐 워프 out) | 'warpIn' (크리쳐 워프 재출현)
const zombieFX = [];  // { type, wx, wy, life, maxLife, color, scale, unitLabel }

function addZombieFX(type, wx, wy, color = '#bb44ff', unitLabel = null) {
  const dur = type === 'warpIn' ? 0.5 : 0.6;
  zombieFX.push({ type, wx, wy, life: dur, maxLife: dur, color, scale: 1.0, unitLabel });
}

function updateZombieFX(dt) {
  for (const fx of zombieFX) fx.life -= dt;
  for (let i = zombieFX.length - 1; i >= 0; i--) {
    if (zombieFX[i].life <= 0) zombieFX.splice(i, 1);
  }
}



function drawZombieFX(ts) {
  for (const fx of zombieFX) {
    const t     = Math.max(0, fx.life / fx.maxLife); // 1→0
    const cx    = fx.wx, cy = fx.wy;
    const r     = ts * 0.30;
    ctx.save();

    if (fx.type === 'dissolve') {
      // 감염자 소멸: 아래로 가라앉으며 페이드
      const sinkY = cy + (1 - t) * ts * 0.25;
      ctx.globalAlpha = t * t;
      ctx.fillStyle   = fx.color;
      // 몸통 원
      ctx.beginPath();
      ctx.arc(cx, sinkY, r * (0.5 + t * 0.5), 0, Math.PI * 2);
      ctx.fill();
      // 인식표 텍스트 (fallenUnit 있을 때)
      if (fx.unitLabel && t > 0.4) {
        ctx.globalAlpha = (t - 0.4) / 0.6;
        ctx.fillStyle   = '#cc88ff';
        ctx.font        = `bold ${Math.round(ts * 0.22)}px monospace`;
        ctx.textAlign   = 'center';
        ctx.fillText(fx.unitLabel, cx, sinkY - r * 1.6);
      }

    } else if (fx.type === 'warp') {
      // 크리쳐 워프 아웃: 중심으로 수축하며 사라짐
      const shrink = t * t;          // 빠르게 작아짐
      const spin   = (1 - t) * 3.0; // 약간 회전
      ctx.translate(cx, cy);
      ctx.rotate(spin);
      ctx.globalAlpha = t;
      // 수축 링
      ctx.strokeStyle = fx.color;
      ctx.lineWidth   = 2 * t;
      ctx.beginPath();
      ctx.arc(0, 0, r * (shrink * 1.4 + 0.1), 0, Math.PI * 2);
      ctx.stroke();
      // 중심 코어
      ctx.fillStyle = fx.color;
      ctx.globalAlpha = t * 0.8;
      ctx.beginPath();
      ctx.arc(0, 0, r * shrink, 0, Math.PI * 2);
      ctx.fill();
      // 보라빛 파티클 방사 (4개)
      ctx.globalAlpha = t * 0.6;
      for (let i = 0; i < 4; i++) {
        const a  = (i / 4) * Math.PI * 2 + spin;
        const pr = r * (1 - t) * 1.5;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * pr, Math.sin(a) * pr, r * 0.12 * t, 0, Math.PI * 2);
        ctx.fill();
      }

    } else if (fx.type === 'warpIn') {
      // 크리쳐 재출현: 바깥에서 안으로 수렴하며 등장
      const grow = 1 - t;          // 0→1
      ctx.translate(cx, cy);
      ctx.globalAlpha = grow * 0.9;
      ctx.strokeStyle = fx.color;
      ctx.lineWidth   = 1.5 * (1 - grow);
      ctx.beginPath();
      ctx.arc(0, 0, r * (0.3 + grow * 0.7), 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = fx.color;
      ctx.globalAlpha = grow * 0.4;
      ctx.beginPath();
      ctx.arc(0, 0, r * grow * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}

let camX = 0, camY = 0, moveTimer = 0;

// 카메라 줌 — 플레이어를 더 크게, 시야를 더 폐쇄적으로
// PC 기준(960px 폭)에서 줌 1.5일 때 보이는 타일 개수를 기준으로,
// 화면 폭이 달라져도(모바일) 동일한 시야(타일 개수)를 유지하도록 동적 계산
const BASE_ZOOM = 1.5;
const BASE_W_PX = 960;
let ZOOM = BASE_ZOOM;

function updateZoom() {
  // 화면 폭이 PC 기준보다 크면 줌도 비례해서 키워 같은 타일 개수 유지
  // (W_px가 클수록 1타일이 차지하는 픽셀도 커지므로 ZOOM도 같이 커져야 "보이는 타일 수"가 동일해짐)
  ZOOM = BASE_ZOOM * (W_px / BASE_W_PX);
  ZOOM = Math.max(0.9, Math.min(2.4, ZOOM)); // 극단적 화면비 방지
}

// 줌 반영 뷰포트 크기 (월드 단위)
function viewW() { return W_px / ZOOM; }
function viewH() { return H_px / ZOOM; }
// 월드 좌표 → 화면(스크린) 좌표 — restore 이후 오버레이용
function worldToScreenX(wx) { return (wx - camX) * ZOOM; }
function worldToScreenY(wy) { return (wy - camY) * ZOOM; }

let devRevealMines = false;
let devInvincible  = false;
let devRevealAll   = false;
let devNoiseMarker = null;   // DEV 소음 발원지 마커 {wx, wy, timer}
let devZombieFov   = false;

// ── 미니게임 상태 ────────────────────────────────────────────────
// type: 'mine' (병원체 회수) | 'combat' (좀비 전투) | null
const minigame = {
  active:       false,
  type:         null,
  pattern:      [],
  current:      0,
  result:       null,
  resultTimer:  0,
  flashTimer:   0,
  mineTileIdx:  -1,
  combatZombie: null,
  interruptedMine: false,
  postCooldown: 0,
  combatGauge:  0,
  combatDrain:  0,
  mashTimer:    0,
  // 치료제 선택지
  serumChoice:      false,  // 선택지 표시 중 여부
  serumChoiceTimer: 0,      // 선택지 남은 시간
  serumChosen:      false,  // 이미 선택했는지 (중복 방지)
};

// 미니게임 config (game.js 내부 상수)
const MG = {
  dirs: ['up','down','left','right'],
  keyToDir: { ArrowUp:'up', ArrowDown:'down', ArrowLeft:'left', ArrowRight:'right' },
  // 병원체 회수
  mineSuccessInfect:  3,
  mineFailInfect:    15,
  // 좀비 전투
  combatSuccessOxy: -10,
  combatFailOxy:    -25,
  combatFailInfect:   8,
  // 기타
  postCooldown:     3.0,
  resultShowTime:   1.0,
  visionRadMine:    2,
  // 전투 게이지
  combatGaugeMax:      100,
  combatPlayerPower:    18,
  combatZombieDrainByState: { CHASE: 12, SEARCH: 7, WANDER: 4 },
  combatMashTime:      4.0,
  combatWinThreshold: 100,
  combatChoiceGauge:   80,   // 치료제 선택지 등장 게이지 임계값 (%)
};

// ── 튜토리얼 진입 시 CONFIG를 깨끗한 기본값으로 복원하기 위한 백업 ──
// (applyUpgradeEffects가 CONFIG를 전역으로 직접 수정하는 구조라, 본게임 특성 영향을 받지 않게 함)
const _CONFIG_DEFAULTS = {
  oxygenMax: CONFIG.oxygen.max,
  oxygenDrainMult: CONFIG.oxygen._drainMult ?? 1.0,
  infectThreshold: CONFIG.oxygen.infectThreshold,
  combatPlayerPower: MG.combatPlayerPower,
  postCooldown: MG.postCooldown,
  capsuleHeal: CONFIG.oxygen.capsuleHeal,
  sonarMaxRadius: CONFIG.sonar.maxRadius,
};

function resetConfigToDefaults() {
  CONFIG.oxygen.max             = _CONFIG_DEFAULTS.oxygenMax;
  CONFIG.oxygen._drainMult      = _CONFIG_DEFAULTS.oxygenDrainMult;
  CONFIG.oxygen.infectThreshold = _CONFIG_DEFAULTS.infectThreshold;
  MG.combatPlayerPower          = _CONFIG_DEFAULTS.combatPlayerPower;
  MG.postCooldown               = _CONFIG_DEFAULTS.postCooldown;
  CONFIG.oxygen.capsuleHeal     = _CONFIG_DEFAULTS.capsuleHeal;
  CONFIG.sonar.maxRadius        = _CONFIG_DEFAULTS.sonarMaxRadius;
}

// ── 패트롤 강화 상태 ─────────────────────────────────────────────
const patrol = {
  phase:       0,     // 0=초기 1=33% 2=66% 3=100%
  speedMult:   1.0,   // 현재 속도 배율
  fovMult:     1.0,   // 현재 시야각 배율
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
  const isMobile = document.body.classList.contains('mobile-ui');
  if (isMobile) {
    // 모바일: 실제 화면 크기로 캔버스 해상도 동기화 (비율 왜곡 방지)
    W_px = canvas.width  = window.innerWidth;
    H_px = canvas.height = window.innerHeight;
  } else {
    // PC: 960×540 (16:9) 고정 — CrazyGames 권장 비율
    const GAME_W = 960, GAME_H = 540;
    W_px = canvas.width  = GAME_W;
    H_px = canvas.height = GAME_H;
  }
  mmCanvas.width = mmCanvas.height = CONFIG.minimap.size;
  if (W_px > 0 && H_px > 0) {
    vignetteGradient = ctx.createRadialGradient(W_px/2, H_px/2, H_px*0.18, W_px/2, H_px/2, H_px*0.78);
    vignetteGradient.addColorStop(0, 'rgba(0,0,0,0)');
    vignetteGradient.addColorStop(1, 'rgba(0,0,0,0.72)');
  }
  updateZoom(); // 화면 폭에 맞춰 줌 재계산 — PC/모바일 동일 시야 유지
  console.log('[RESIZE]', 'mobile:', isMobile, '| W_px:', W_px, '| H_px:', H_px, '| ZOOM:', ZOOM.toFixed(3), '| innerWidth:', window.innerWidth, '| innerHeight:', window.innerHeight);
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => {
  // 회전 직후 브라우저가 innerWidth/Height를 갱신하는 타이밍이 늦을 수 있어 약간의 딜레이 후 재계산
  setTimeout(resize, 50);
  setTimeout(resize, 300);
});

// ================================================================
//  튜토리얼 전용 고정 맵
//  구조: 시작점(십자 1칸) + 통로(4칸,소나트리거) + 병원체 A/B(인접배치,오렌지시연)
//        + 통로 연장 + 병원체 C(단독, 치료제선택 후 회수 — 좀비 습격 트리거)
//  좌표 원점은 (0,0)=벽 테두리, 시작점은 (3,4)로 둬서 사방 1칸 여유 확보
// ================================================================
const TUT_MAP_W = 18, TUT_MAP_H = 9;
const TUT_START_TX = 3, TUT_START_TY = 4;          // 시작 타일
const TUT_SONAR_TRIGGER_TX = TUT_START_TX + 4;     // 오른쪽 4칸 지점 — 소나 안내 트리거
// 병원체 A/B를 메인 통로 위/아래 한 칸씩에 인접 배치 → danger=2(오렌지) 시연
// 소나트리거 지점에서 거리 2 — 소나 최소반경(minRadius=2)으로 짧게 눌러도 반드시 핑이 도달하도록
const TUT_MINE_TX   = TUT_SONAR_TRIGGER_TX + 2;
const TUT_MINE_TY_A = TUT_START_TY - 1;            // 병원체 A (통로 위) — 1번째 회수
const TUT_MINE_TY_B = TUT_START_TY + 1;            // 병원체 B (통로 아래) — 2번째 회수
// A+B 회수 완료 후 치료제 선택 → 통로를 더 연장해 병원체 C(단독) 배치 — 3번째 회수=좀비 습격 트리거
const TUT_MINE_C_TX  = TUT_MINE_TX + 3;
const TUT_MINE_C_TY  = TUT_START_TY;               // 메인 통로 위에 직접 배치(단독 — 인접 병원체 없음)
const TUT_CORRIDOR_END_TX = TUT_MINE_C_TX + 1;     // 통로 끝
const TUT_AMBUSH_SPAWN_TY = TUT_MINE_C_TY + 3;     // 습격 좀비 출발지 — 병원체C에서 3칸 아래(멀리서 달려옴)

function generateTutorialMap() {
  const W = TUT_MAP_W, H = TUT_MAP_H;
  const tiles   = new Uint8Array(W * H).fill(T.WALL);
  const numbers = new Uint8Array(W * H);
  const detected = new Uint8Array(W * H);
  const idx = (x, y) => y * W + x;

  // 시작점 십자 (상하좌우 1칸씩 개방, 그 외 사방은 벽)
  tiles[idx(TUT_START_TX, TUT_START_TY)]     = T.FLOOR;
  tiles[idx(TUT_START_TX, TUT_START_TY - 1)] = T.FLOOR; // 위 1칸
  tiles[idx(TUT_START_TX, TUT_START_TY + 1)] = T.FLOOR; // 아래 1칸
  tiles[idx(TUT_START_TX - 1, TUT_START_TY)] = T.FLOOR; // 왼쪽 1칸

  // 오른쪽 메인 통로 — 시작점부터 병원체 C 너머까지 일자로 개방
  for (let x = TUT_START_TX; x <= TUT_CORRIDOR_END_TX; x++) {
    tiles[idx(x, TUT_START_TY)] = T.FLOOR;
  }

  // 병원체 A/B — 통로 위/아래로 분리 배치 (통로 타일에서 danger=2 주황 핑 시연)
  tiles[idx(TUT_MINE_TX, TUT_MINE_TY_A)] = T.MINE;
  tiles[idx(TUT_MINE_TX, TUT_MINE_TY_B)] = T.MINE;
  tiles[idx(TUT_MINE_TX - 1, TUT_MINE_TY_A)] = T.FLOOR; // A로 꺾어 들어가는 분기
  tiles[idx(TUT_MINE_TX - 1, TUT_MINE_TY_B)] = T.FLOOR; // B로 꺾어 들어가는 분기

  // 병원체 C — 메인 통로 위에 단독 배치(주변 다른 병원체 없음). 회수 시작이 좀비 습격 트리거
  tiles[idx(TUT_MINE_C_TX, TUT_MINE_C_TY)] = T.MINE;
  for (let y = TUT_MINE_C_TY + 1; y <= TUT_AMBUSH_SPAWN_TY; y++) {
    tiles[idx(TUT_MINE_C_TX, y)] = T.FLOOR; // C에서 아래로 길게 뚫린 습격 통로 (C 타일 자체는 보존)
  }

  // 인접 병원체 수 계산 (본게임과 동일한 규칙 — 3x3 인접 MINE 개수)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (tiles[idx(x, y)] === T.WALL) continue;
    let cnt = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && nx < W && ny >= 0 && ny < H && tiles[idx(nx, ny)] === T.MINE) cnt++;
    }
    numbers[idx(x, y)] = cnt;
  }

  return { tiles, numbers, detected, width: W, height: H,
           floorCount: 0, mineCount: 3, deadEndCount: 0, deadEndRatio: 0 };
}

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
    dead: false, itemsFound: 0, exitCooldown: 0,
    // totalCollected는 런 전체 누적이라 init에서 리셋 안 함
    // oxygen/infection은 init 밖에서 관리 (스테이지 전환 시 유지, 신규/재시작 시만 초기화)
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
  Object.assign(patrol, { phase:0, speedMult:1.0, fovMult:1.0 });
  noisePulses.length = 0;
  popups.length = 0;
  notices.length = 0;
  devLogEntries.length = 0; _renderDevLog();
  Object.assign(minigame, {
    active:false, type:null, pattern:[], current:0, result:null,
    resultTimer:0, flashTimer:0, mineTileIdx:-1, combatZombie:null,
    interruptedMine:false, postCooldown:0,
    combatGauge:0, combatDrain:0, playerPower: MG.combatPlayerPower, mashTimer:0,
  });
  revealAround(1, 1, CONFIG.player.visionRad);
  camX = player.px + CONFIG.map.tileSize / 2 - viewW() / 2;
  camY = player.py + CONFIG.map.tileSize / 2 - viewH() / 2;
  spawnZombies();
  document.getElementById('gameover').classList.remove('show');
  document.getElementById('gameover').classList.remove('infected');
  document.getElementById('escaped').classList.remove('show');
  document.getElementById('early-exit').classList.remove('show');
  document.getElementById('stage-intro').classList.remove('show');
  document.getElementById('ending-screen').classList.remove('show');
  document.getElementById('tbc-screen').classList.remove('show');
  document.getElementById('origin-eyes').classList.remove('show');
  const infectFlash = document.getElementById('infect-flash');
  infectFlash.style.opacity = '0';
  infectFlash.style.display = 'none';
  showStageIntro();
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
  'KeyF','KeyG','KeyE','Space','Enter',
]);

// ── 게임 상태 머신 ──────────────────────────────────────────────
// 'TITLE' | 'LOBBY' | 'INTRO' | 'PLAYING' | 'PAUSED' | 'ESCAPED' | 'GAMEOVER'
let GAME_STATE = 'TITLE';

window.addEventListener('keydown', e => {
  if (GAME_KEYS.has(e.code)) e.preventDefault();

  // ── ESC: 일시정지 토글 (PLAYING ↔ PAUSED) ────────────────────
  if (e.code === 'Escape') {
    if (GAME_STATE === 'PLAYING') {
      pauseGame();
    } else if (GAME_STATE === 'PAUSED') {
      resumeGame();
    }
    return;
  }

  // ── PAUSED: ESC 외 입력 차단 ─────────────────────────────────
  if (GAME_STATE === 'PAUSED') return;

  // ── TUTORIAL_INTRO: 풀스크린 암전 세계관 설명 — Space/F로 진행(탭도 별도로 동작) ──
  if (GAME_STATE === 'TUTORIAL_INTRO') {
    if (e.code === 'Space' || e.code === 'KeyF') tutorialAdvanceKey();
    return;
  }

  // ── TITLE 상태: 스페이스/엔터로 시작 ──────────────────────────
  if (GAME_STATE === 'TITLE') {
    if (e.code === 'Space' || e.code === 'Enter') showLobby();
    return;
  }

  // ── LOBBY(기지) 상태: 스페이스로 작전 개시 ───────────────────
  if (GAME_STATE === 'LOBBY') {
    if (e.code === 'Space') startGame();
    return;
  }

  // ── INTRO 상태: 스페이스/엔터만 허용 ──────────────────────────
  if (GAME_STATE === 'INTRO') {
    if (e.code === 'Space' || e.code === 'Enter') closeIntro();
    return;
  }

  // ── ESCAPED — 출구 팝업 키 처리 ──────────────────────────────
  if (GAME_STATE === 'ESCAPED') {
    const earlyEl = document.getElementById('early-exit');
    if (earlyEl.classList.contains('show')) {
      // Enter → 기지 복귀 (집에 간다)
      if (e.code === 'Enter') {
        earlyEl.classList.remove('show');
        showEscaped('early');
        return;
      }
      // 스페이스 → 재탐사(미회수) or 다음 층(전부회수) — 진행
      if (e.code === 'Space') {
        const nextBtn  = document.getElementById('exit-next-btn');
        const rescanBtn = document.getElementById('exit-rescan-btn');
        if (nextBtn.style.display !== 'none') {
          // 전부 회수 — 다음 층
          nextBtn.click();
        } else if (rescanBtn.style.display !== 'none') {
          // 미회수 — 재탐사
          rescanBtn.click();
        }
        return;
      }
    }
    return;
  }

  // ── GAMEOVER 상태: Space/Enter → 기지 복귀 ──────────────────
  if (GAME_STATE === 'GAMEOVER') {
    if (e.code === 'Space' || e.code === 'Enter') {
      document.getElementById('go-base-btn').click();
    }
    return;
  }

  // ── PLAYING 상태 ──────────────────────────────────────────────
  // 튜토리얼 대화창 보는 중(TUT_LOCKED) — Space 또는 F로 진행(모바일은 기존 touch-f 버튼 재사용), 다른 입력 무시
  // precise_prompt 단계는 G키, serum_prompt/serum_use_wait 단계는 Y/N/D키 예외로 통과
  if (TUT_ACTIVE && TUT_LOCKED) {
    if (e.code === 'Space' || e.code === 'KeyF') tutorialAdvanceKey();
    if (TUT_STEP === 'precise_prompt' && e.code === 'KeyG') { /* 아래로 통과 */ }
    else if (TUT_STEP === 'serum_prompt' && (e.code === 'KeyY' || e.code === 'KeyN')) { /* 아래로 통과 */ }
    else if (TUT_STEP === 'serum_use_wait' && e.code === 'KeyD') { /* 아래로 통과 */ }
    else return;
  }
  // 미니게임 중 입력
  if (minigame.active && !minigame.result) {
    // 치료제 선택지 중 Y/N은 통과
    if (minigame.serumChoice) {
      if (e.code === 'KeyY' || e.code === 'KeyN') { /* 아래서 처리 */ }
      else return;
    } else {
      const dir = MG.keyToDir[e.code];
      if (dir) { minigameInput(dir); return; }
      if (e.code !== 'KeyF') return; // F키만 통과
    }
  }

  if (e.code === 'KeyE') {
    if (!e.repeat && !player.dead && !minigame.active) {
      if (TUT_ACTIVE && TUT_STEP !== 'mine_collect' && TUT_STEP !== 'mine_collect_2' && TUT_STEP !== 'mine_collect_3') return; // 튜토리얼 — 소나 사용 전엔 회수 불가
      const tileIdx = player.ty * MAP.width + player.tx;
      if (MAP.tiles[tileIdx] === T.MINE && MAP.detected[tileIdx]) {
        startMinigame('mine', tileIdx);
      }
    }
    return;
  }
  if (e.code === 'KeyF') {
    if (minigame.active && minigame.type === 'combat' && !minigame.result) {
      if (e.repeat) return;
      // 선택지 표시 중이면 F 연타 차단
      if (minigame.serumChoice) return;
      minigame.combatGauge = Math.min(MG.combatGaugeMax,
        minigame.combatGauge + minigame.playerPower);
      SoundManager.play('combat_mash');

      // 80% 도달 + 치료제 보유 + 아직 선택 안 했으면 → 게이지 80에 고정 + 선택지 강제 표시
      if (!minigame.serumChosen && player.serum > 0
          && minigame.combatGauge >= MG.combatChoiceGauge) {
        minigame.combatGauge      = MG.combatChoiceGauge;  // 80에서 멈춤
        minigame.serumChoice      = true;
        minigame.serumChoiceTimer = TUT_ACTIVE ? TUT_SERUM_CHOICE_TIME : CONFIG.serum.choiceTime; // 튜토리얼은 결정할 여유를 더 줌
        // 튜토리얼은 화면 정중앙 오버레이로 표시 (PC/모바일 공용) — 본게임은 기존 방식(캔버스+하단 터치) 유지
        if (TUT_ACTIVE) showTutChoiceCenter('치료제 투여', '계속 싸우기');
        if (window._updateTouchUI) window._updateTouchUI();
        return;
      }

      // 선택지 이미 거부한 상태에서만 100% 승리 체크
      if (minigame.combatGauge >= MG.combatWinThreshold) endMinigame(true);
      return;
    }
    if (!e.repeat && !sonar.charging && !player.dead && !minigame.active) {
      if (TUT_ACTIVE && TUT_STEP !== 'sonar_prompt' && TUT_STEP !== 'sonar_prompt_2') return; // 튜토리얼 — 안내 전엔 소나 비활성
      if (TUT_ACTIVE && (TUT_STEP === 'sonar_prompt' || TUT_STEP === 'sonar_prompt_2')) hideTutorialBox(); // F 차징 시작 — 대화창 숨김
      sonar.charging = true; sonar.chargeTime = 0;
    }
    return;
  }
  // Y — 치료제 투여
  if (e.code === 'KeyY') {
    if (TUT_ACTIVE && TUT_STEP === 'serum_prompt') { onTutorialSerumChoice(true); return; }
    if (minigame.active && minigame.type === 'combat' && minigame.serumChoice && !minigame.result) {
      useSerumInCombat();
    }
    return;
  }
  // N — 계속 싸우기 (선택지 닫기) / 튜토리얼 평시에는 치료제 보류
  if (e.code === 'KeyN') {
    if (TUT_ACTIVE && TUT_STEP === 'serum_prompt') { onTutorialSerumChoice(false); return; }
    if (minigame.active && minigame.type === 'combat' && minigame.serumChoice) {
      minigame.serumChoice  = false;
      minigame.serumChosen  = true;
      hideTutChoiceCenter();
      if (window._updateTouchUI) window._updateTouchUI();
    }
    return;
  }
  // D — 자가 치료제 사용 (전투 외)
  if (e.code === 'KeyD') {
    if (TUT_ACTIVE && TUT_STEP === 'serum_use_wait') { onTutorialSerumUseConfirmed(); return; }
    if (TUT_ACTIVE) return; // 그 외 튜토리얼 단계에서는 비활성
    if (!minigame.active && !player.dead && GAME_STATE === 'PLAYING') {
      useSerumSelf();
    }
    return;
  }
  if (e.code === 'KeyG') {
    if (TUT_ACTIVE && (TUT_STEP !== 'precise_prompt' || !TUT_PRECISE_READY)) return; // 정밀소나는 습격 직후 연출 단계 + 텍스트 타이핑 완료 후에만 사용
    if (!e.repeat && !sonar.chargingPrecise && sonar.precise > 0 && !player.dead && !minigame.active) {
      sonar.chargingPrecise = true; sonar.chargeTimePrecise = 0;
    }
    return;
  }
  KEYS[e.code] = true;
});

window.addEventListener('keyup', e => {
  if (GAME_STATE !== 'PLAYING') { KEYS[e.code] = false; return; }
  if (e.code === 'KeyF') { if (sonar.charging)        fireSonar(false); return; }
  if (e.code === 'KeyG') { if (sonar.chargingPrecise) fireSonar(true);  return; }
  KEYS[e.code] = false;
});

function getHeldDir() {
  if (KEYS['ArrowUp'])    return { dx:0,  dy:-1 };
  if (KEYS['ArrowDown'])  return { dx:0,  dy: 1 };
  if (KEYS['ArrowLeft'])  return { dx:-1, dy: 0 };
  if (KEYS['ArrowRight']) return { dx: 1, dy: 0 };
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
  if (player.dead) { sonar.charging = false; sonar.chargingPrecise = false; }
  if (GAME_STATE !== 'PLAYING') return;
  if (TUT_ACTIVE && TUT_LOCKED) return; // 튜토리얼 대화창 보는 중 — 이동 차단
  if (TUT_ACTIVE && (TUT_STEP === 'precise_prompt' || TUT_STEP === 'precise_revealed' || TUT_STEP === 'aftermath')) return; // 정밀소나 연출 단계 — 이동 차단(G키만 허용)
  if (player.moving || moveTimer > 0 || player.dead || minigame.active) return;
  const dir = getHeldDir();
  if (dir) { updateFacing(dir.dx, dir.dy); tryMove(dir.dx, dir.dy); }
}

// ── 타일 효과 ────────────────────────────────────────────────────
function onStep(tx, ty) {
  const tileIdx = ty * MAP.width + tx;
  const tile    = MAP.tiles[tileIdx];

  checkTutorialMoveProgress();

  if (tile === T.MINE) {
    const tileIdx2 = ty * MAP.width + tx;
    if (MAP.detected[tileIdx2]) {
      // 탐지된 병원체 — E키 프롬프트 (타일 유지)
      SoundManager.play('collect_prompt');
      devLog('병원체 위에 섬 — [E] 회수 시도', '');
    } else {
      // 미탐지 병원체 — 아무 일도 없음 (소나로 탐지해야 회수 가능)
      devLog('미탐지 병원체 위에 섬 — 소나로 탐지하세요', '');
    }
    return;
  }

  if (tile === T.ITEM) {
    MAP.tiles[tileIdx] = T.FLOOR;
    player.itemsFound++;
    // 산소 캡슐: 산소 보충만, 탈출 조건 아님
    const prevOxy = player.oxygen;
    player.oxygen = Math.min(CONFIG.oxygen.max, player.oxygen + CONFIG.oxygen.capsuleHeal);
    devLog(`캡슐 수집 — 산소 +${(player.oxygen - prevOxy).toFixed(1)}% (${prevOxy.toFixed(1)}% → ${player.oxygen.toFixed(1)}%)`, 'good');
    SoundManager.play('capsule_pickup');
    addPopup(`산소 +${(player.oxygen - prevOxy).toFixed(0)}%`, '#44ddff', 0);
    triggerFlash('item');
    triggerFlash('oxygen');
    return;
  }

  if (tile === T.EXIT) {
    if (player.exitCooldown > 0) return; // 재탐사 쿨타임 중 — 출구 무시
    let remaining = 0;
    for (let i = 0; i < MAP.tiles.length; i++) if (MAP.tiles[i] === T.MINE) remaining++;
    if (remaining === 0) {
      // 전부 회수 → 복귀 or 다음 스테이지 선택
      showExitChoice('full');
    } else {
      // 미회수 → 조기복귀 or 재탐사 선택
      showExitChoice('partial', remaining);
    }
  }
}

// ── ORIGIN 암전 연출 ─────────────────────────────────────────────
// 크리쳐 워프 시 층별 확률로 발동, 층당 1회 상한
const originFlash = { usedThisStage: false };

function triggerOriginFlash() {
  if (originFlash.usedThisStage) return;

  // [DEV] 테스트용 무조건 발동 — 확인 후 아래 확률 코드로 교체
  // const stageIdx = Math.min(player.stage, CONFIG.stages.length - 1);
  // const chance   = 0.10 + stageIdx * 0.125;
  // if (Math.random() > chance) return;

  originFlash.usedThisStage = true;

  const overlay = document.getElementById('origin-flash');
  if (!overlay) return;

  // ① 급격한 암전
  overlay.style.transition       = 'opacity 0.06s ease, background-color 0.05s ease';
  overlay.style.backgroundColor  = '#000000';
  overlay.style.opacity          = '1';

  // ② 화이트아웃 충격
  setTimeout(() => {
    overlay.style.backgroundColor = '#ffffff';
  }, 160);

  // ③ 복귀
  setTimeout(() => {
    overlay.style.transition = 'opacity 0.25s ease';
    overlay.style.opacity    = '0';
    setTimeout(() => {
      overlay.style.backgroundColor = '#000000';
    }, 280);
  }, 280);
}

function resetOriginFlash() {
  originFlash.usedThisStage = false;
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

// ── 일시정지 / 재개 ─────────────────────────────────────────────
function pauseGame() {
  if (GAME_STATE !== 'PLAYING') return;
  GAME_STATE = 'PAUSED';
  document.getElementById('settings-menu')?.classList.add('show');
  // 이동 입력 정리 — 재개 시 잔류 입력 방지
  for (const k in KEYS) KEYS[k] = false;
}

function resumeGame() {
  if (GAME_STATE !== 'PAUSED') return;
  GAME_STATE = 'PLAYING';
  document.getElementById('settings-menu')?.classList.remove('show');
}

function showGameOver(reason) {
  player.dead = true;
  GAME_STATE = 'GAMEOVER';
  SoundManager.stopBGMImmediate();
  SoundManager.stopLoop('oxygen_warn');

  const isInfected = reason === 'infected';
  // elapsed를 여기서 계산 — setTimeout 안에서 하면 딜레이만큼 오차 발생
  const elapsed = Math.floor((Date.now() - stats.startTime) / 1000);
  const got     = saveRunRecord(isInfected ? 'infected' : 'death');

  if (isInfected) {
    // 감염(좀비화) — 보라 오버레이 서서히 물들고 패널 등장
    const infectFlash = document.getElementById('infect-flash');
    infectFlash.style.opacity = '0';
    infectFlash.style.display = 'block';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => { infectFlash.style.opacity = '1'; });
    });
    setTimeout(() => {
      SoundManager.play('gameover_infected');
      const panel = document.getElementById('gameover');
      panel.classList.add('infected');
      const reasonEl = document.getElementById('go-reason');
      if (reasonEl) {
        reasonEl.className = 'ov-title purple';
        reasonEl.textContent = '☣ 좀비 전환';
      }
      document.getElementById('go-mines').textContent = stats.minesHit;
      document.getElementById('go-time').textContent  = elapsed + '초';
      const gotEl = document.getElementById('go-got');
      if (gotEl) gotEl.textContent = got;
      panel.classList.add('show');
    }, 700);
  } else {
    // 일반 사망
    SoundManager.play('gameover_death');
    document.getElementById('go-mines').textContent  = stats.minesHit;
    document.getElementById('go-time').textContent   = elapsed + '초';
    const reasonEl = document.getElementById('go-reason');
    if (reasonEl) {
      reasonEl.className   = 'ov-title red';
      reasonEl.textContent = '☠ 사망';
    }
    const gotEl = document.getElementById('go-got');
    if (gotEl) gotEl.textContent = got;
    document.getElementById('gameover').classList.add('show');
  }
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

// ── 치료제 시스템 ────────────────────────────────────────────────
function useSerumSelf() {
  if (player.serum <= 0) return;
  player.serum--;
  const heal = CONFIG.serum.selfHealAmount;
  player.infection = Math.max(0, player.infection - heal);
  addPopup(`💉 감염 -${heal}%`, '#bb44ff', 0);
  addPopup(`치료제 잔여 ${player.serum}개`, '#888888', 0.2);
  updateSerumHUD();
  devLog(`치료제 자가 사용 — 감염 -${heal}% (잔여 ${player.serum}개)`, 'good');
}

function useSerumInCombat() {
  if (!minigame.combatZombie || player.serum <= 0) {
    if (TUT_ACTIVE) onTutorialAmbushResolved(); // 엣지케이스 — 그래도 시퀀스는 이어가야 함
    return;
  }
  player.serum--;
  minigame.serumChoice = false;
  minigame.serumChosen = true;
  hideTutChoiceCenter();
  if (window._updateTouchUI) window._updateTouchUI();

  const z       = minigame.combatZombie;
  const faction = z.faction;

  if (faction === 'INFECTED') {
    const dnaBonus = CONFIG.serum.infectedDnaBonus;
    try {
      const prevDna = parseInt(localStorage.getItem(DNA_KEY) || '0');
      localStorage.setItem(DNA_KEY, String(prevDna + dnaBonus));
    } catch(e) {}
    const idx = zombies.indexOf(z);
    if (idx !== -1) zombies.splice(idx, 1);
    minigame.result      = 'success';
    minigame.resultTimer = MG.resultShowTime;
    minigame.postCooldown = MG.postCooldown;
    addPopup('안식 성공 ✦', '#bb44ff', 0);
    addPopup(`DNA +${dnaBonus}`, '#cc66ff', 0.2);
    addNotice('그는 마침내 안식에 들었다', '#bb44ff', 3.0);
    const voiceRest = pickVoice('restSuccess');
    if (voiceRest) addVoicePopup(voiceRest);
    SoundManager.play('combat_win');
    // ── 전사자 풀 청소 ──────────────────────────────────────────
    if (z.fallenUnit != null) {
      const cleaned = removeFromFallenPool(z.fallenUnit);
      if (cleaned) {
        const unitLabel = `UNIT-${String(z.fallenUnit).padStart(2, '0')}`;
        devLog(`${unitLabel} 안식 완료 — 전사자 풀에서 제거`, 'good');
      }
      logUnitAction(z.fallenUnit, 'rested', player.stage + 1);
    }
    devLog(`치료제 투여 성공 — 감염자 안식 + DNA +${dnaBonus}`, 'good');
  } else {
    const idx = zombies.indexOf(z);
    if (idx !== -1) zombies.splice(idx, 1);
    if (TUT_ACTIVE) {
      // 튜토리얼 — 페널티 없이 크리쳐만 사라짐 (본게임 룰과 분리, 합의사항)
      minigame.result      = 'fail';
      minigame.resultTimer = MG.resultShowTime;
      minigame.postCooldown = MG.postCooldown;
      addPopup('치료제 무효', '#ff4444', 0);
      SoundManager.play('combat_lose');
      devLog('치료제 투여 — 크리쳐 무효 (튜토리얼: 페널티 없음)', 'warn');
    } else {
      const oxyLoss = Math.abs(MG.combatFailOxy);
      const infGain = MG.combatFailInfect;
      applyOxygenDamage(oxyLoss);
      player.infection = Math.min(100, player.infection + infGain);
      spawnExtraZombie(true); // 크리쳐 치료제 무효 → 새 크리쳐 강제 스폰
      minigame.result      = 'fail';
      minigame.resultTimer = MG.resultShowTime;
      minigame.postCooldown = MG.postCooldown;
      addPopup('치료제 무효', '#ff4444', 0);
      addPopup(`산소 -${oxyLoss}%`, '#ff3333', 0.2);
      addPopup(`오염 +${infGain}%`, '#ff3333', 0.4);
      const voiceWasted = pickVoice('serumWasted');
      if (voiceWasted) addVoicePopup(voiceWasted);
      SoundManager.play('combat_lose');
      triggerFlash('red');
      devLog('치료제 투여 — 크리쳐 무효, 전투 실패 처리', 'danger');
    }
  }
  updateSerumHUD();
  if (player.infection >= 100 && !player.dead) showGameOver('infected');
  if (TUT_ACTIVE) onTutorialAmbushResolved();
}

function updateSerumHUD() {
  const el = document.getElementById('hud-serum');
  if (el) el.textContent = '💉 ' + player.serum;
  // D 버튼 표시는 _updateTouchUI에서 통합 관리
  if (window._updateTouchUI) window._updateTouchUI();
}

function startMinigame(type, mineTileIdx, zombieRef, interrupted) {
  // 회수 중 급습이면 기존 mine 미니게임 강제 종료
  if (minigame.active && type === 'combat') {
    minigame.interruptedMine = interrupted || false;
  }
  const stageIdx = Math.min(player.stage, CONFIG.stages.length - 1);
  const fxLen = getUpgradeEffects();
  const len = TUT_ACTIVE
    ? 3 // 튜토리얼 — 특성 효과 무관하게 항상 고정 길이로 시연
    : Math.max(2, CONFIG.stages[stageIdx].patternLen - fxLen.patternLenMinus);

  const zState = zombieRef ? zombieRef.state : 'WANDER';
  // 전투 drain — 상태 기반 + 특수 좀비 보정
  let drain = 0;
  if (type === 'combat') {
    const baseDrain = MG.combatZombieDrainByState[zState] ?? 7;
    const zType = zombieRef ? zombieRef.type : 'BASIC';
    const typeBonus = { BASIC:1.0, SENSOR:0.9, GUARD:1.2, STALKER:1.3, RUSHER:1.5 }[zType] || 1.0;
    drain = baseDrain * typeBonus;
  }
  // 스테이지별 전투 연타 게이지 증가량 보정
  const stageCombatMash = CONFIG.stages[Math.min(player.stage, CONFIG.stages.length - 1)].combatMash;
  const stagePlayerPower = Math.max(8, MG.combatPlayerPower - (player.stage * 1.5)); // 스테이지 오를수록 연타당 게이지 소폭 감소

  Object.assign(minigame, {
    active: true, type,
    pattern: type === 'mine' ? makePattern(len) : [],
    current: 0,
    result: null, resultTimer: 0, flashTimer: 0,
    mineTileIdx: mineTileIdx ?? -1,
    combatZombie: zombieRef ?? null,
    interruptedMine: interrupted || false,
    postCooldown: 0,
    combatGauge: 0, combatDrain: drain, // 튜토리얼도 본게임과 동일한 드레인 — 위기감 유지(연타횟수는 playerPower로 조정)
    playerPower: (TUT_ACTIVE && type === 'combat') ? TUT_COMBAT_PLAYER_POWER : stagePlayerPower,
    mashTimer: (TUT_ACTIVE && type === 'combat') ? MG.combatMashTime * TUT_COMBAT_TIME_MULT : MG.combatMashTime, // 튜토리얼은 시간도 넉넉하게 — 텍스트를 읽을 여유 보장
    serumChoice: false, serumChoiceTimer: 0, serumChosen: false,
  });
  if (type === 'mine') revealAround(player.tx, player.ty, MG.visionRadMine);
  triggerFlash('red');
  if (type === 'combat') SoundManager.play('combat_start');
  if (type === 'mine') devLog(`병원체 회수 시작 — 패턴: ${minigame.pattern.join('-')}`, 'warn');
  else devLog(`전투 시작 [${zState}] — F키 연타로 게이지 채우기 (좀비 drain: ${drain}/s)`, 'warn');
  if (window._updateTouchUI) window._updateTouchUI();

  if (type === 'mine') {
    onTutorialMineCollectStart(mineTileIdx);
    if (TUT_ACTIVE) collapseVignetteTo('mild', 280, 0.55, null);
  }
  if (type === 'combat') onTutorialCombatStart();
}

function minigameInput(dir) {
  if (!minigame.active || minigame.result) return;
  if (minigame.type !== 'mine') return; // WASD는 병원체 회수만
  const expected = minigame.pattern[minigame.current];
  if (dir === expected) {
    SoundManager.playKeyed(dir);  // 맞는 키 — 방향별 피치
    minigame.current++;
    if (minigame.current >= minigame.pattern.length) {
      endMinigame(true);
    }
  } else if (TUT_ACTIVE) {
    // 튜토리얼 — 오입력은 실패 처리하지 않고 그냥 무시 (학습 중 실수해도 패널티 없이 재시도)
    SoundManager.play('collect_fail');
  } else {
    // 틀림 → 즉시 실패 (실패음은 endMinigame에서 처리)
    minigame.flashTimer = 0.3;
    endMinigame(false);
  }
}

function endMinigame(success) {
  // 안전장치 — D-PAD 터치가 비정상 종료(touchcancel 누락 등)되어 방향키가 눌린 채로 남는 경우를 대비해 강제 해제
  if (minigame.type === 'mine') {
    KEYS['ArrowUp'] = KEYS['ArrowDown'] = KEYS['ArrowLeft'] = KEYS['ArrowRight'] = false;
  }
  minigame.result = success ? 'success' : 'fail';
  minigame.resultTimer = MG.resultShowTime;

  if (minigame.type === 'mine') {
    if (success) {
      SoundManager.play('collect_success');
      // 병원체 회수 성공
      if (minigame.mineTileIdx >= 0) {
        MAP.tiles[minigame.mineTileIdx] = T.FLOOR;
        const tx = minigame.mineTileIdx % MAP.width;
        const ty = Math.floor(minigame.mineTileIdx / MAP.width);
        recalcNumbers(tx, ty);
        player.totalCollected++; // 런 전체 누적
        if (!TUT_ACTIVE) {
          // 마지막 병원체였는지 확인
          let remain = 0;
          for (let i = 0; i < MAP.tiles.length; i++) if (MAP.tiles[i] === T.MINE) remain++;
          if (remain === 0) devLog('✓ 모든 병원체 회수 완료 — 출구로 이동하세요!', 'good');
          checkPatrolPhase();
          // GUARD 홈 포인트 갱신 (회수된 병원체가 홈이었을 경우)
          updateGuardHomePoints();
        }
      }
      const fx = getUpgradeEffects();
      const resistRate = Math.min(1, fx.infectResistRate || 0);
      const infectAmt  = Math.floor(MG.mineSuccessInfect * (1 - resistRate));
      if (infectAmt > 0) {
        player.infection = Math.min(100, player.infection + infectAmt);
        addPopup('병원체 +1', '#00ff88', 0);
        addPopup(`오염 +${infectAmt}%`, '#ff8800', 0.18);
      } else {
        addPopup('병원체 +1', '#00ff88', 0);
        addPopup('오염 저항', '#bb88ff', 0.18);
      }
      if (!TUT_ACTIVE) {
        // 마지막 병원체 회수 완료 알림
        let remain2 = 0;
        for (let i = 0; i < MAP.tiles.length; i++) if (MAP.tiles[i] === T.MINE) remain2++;
        if (remain2 === 0) addNotice('전 병원체 회수 완료 — 출구로', '#00ffcc', 3.5);
      }
      revealAround(player.tx, player.ty, CONFIG.player.visionRad);
      devLog(`병원체 회수 성공 — 감염 +${infectAmt}% (저항 ${Math.round(resistRate*100)}%)`, 'good');
      onTutorialMineCollected();
    } else {
      SoundManager.play('collect_fail');
      // 실패 — 감염 대폭 증가 + 소음
      player.infection = Math.min(100, player.infection + MG.mineFailInfect);
      addPopup(`오염 +${MG.mineFailInfect}%`, '#ff3333', 0);
      const fxNoise = getUpgradeEffects();
      const noiseR = Math.max(1, CONFIG.zombie.noiseRadius - fxNoise.noiseRadiusMinus);
      triggerNoise(player.px + CONFIG.map.tileSize / 2,
                   player.py + CONFIG.map.tileSize / 2,
                   noiseR, 'noise');
      devLog(`병원체 회수 실패 — 감염 +${MG.mineFailInfect}%`, 'danger');
    }
  } else {
    // 전투
    const interrupted = minigame.interruptedMine;
    if (success) {
      SoundManager.play('combat_win');
      let oxyLoss = 0;
      if (!TUT_ACTIVE) {
        oxyLoss = Math.abs(MG.combatSuccessOxy) + (interrupted ? 5 : 0);
        applyOxygenDamage(oxyLoss);
        if (interrupted) player.infection = Math.min(100, player.infection + 5);
        addPopup(`산소 -${oxyLoss}%`, '#ffaa00', 0);
        if (interrupted) addPopup('오염 +5%', '#ff8800', 0.18);
      }

      const cz = minigame.combatZombie;
      if (cz) {
        if (cz.faction === 'INFECTED') {
          // ── 감염자: 소멸 ───────────────────────────────────────
          setTimeout(() => {
            if (!zombies.includes(cz)) return;
            dissolveInfected(cz);
          }, 180);
          showRegretNotice(
            cz.fallenUnit != null
              ? `UNIT-${String(cz.fallenUnit).padStart(2, '0')}`
              : null
          );
          const voiceDown = pickVoice('infectedDown');
          if (voiceDown) addVoicePopup(voiceDown);
        } else {
          // ── 크리쳐: 워프 이탈 ─────────────────────────────────
          setTimeout(() => {
            if (TUT_ACTIVE) {
              // 튜토리얼 맵은 좁아서 워프 후보지가 없어 스턴만 걸리고 다시 인식하는 문제가 있음
              // → 본게임과 달리 그냥 제거(눈앞에서 사라짐, 합의된 연출)
              // cz가 이미 사라졌어도(좀비 정리 등) 시퀀스는 반드시 이어가야 함
              const idx = zombies.indexOf(cz);
              if (idx !== -1) zombies.splice(idx, 1);
              onTutorialAmbushResolved();
              return;
            }
            if (!zombies.includes(cz)) return;
            warpZombie(cz);
          }, 220);
          const voiceWarp = pickVoice('creatureWarp');
          if (voiceWarp) addVoicePopup(voiceWarp);
        }
      } else if (TUT_ACTIVE) {
        // cz가 null인 엣지 케이스 — 그래도 튜토리얼 시퀀스는 반드시 이어가야 함
        onTutorialAmbushResolved();
      }
      devLog(`전투 성공${TUT_ACTIVE ? ' (튜토리얼)' : ` — 산소 -${oxyLoss}%${interrupted ? ' (급습 패널티)' : ''}`}`, 'warn');
    } else {
      SoundManager.play('combat_lose');
      const oxyLoss2 = Math.abs(MG.combatFailOxy) + (interrupted ? 10 : 0);
      const infGain2 = MG.combatFailInfect + (interrupted ? 5 : 0);
      applyOxygenDamage(oxyLoss2);
      player.infection = Math.min(100, player.infection + infGain2);
      addPopup(`산소 -${oxyLoss2}%`, '#ff3333', 0);
      addPopup(`오염 +${infGain2}%`, '#ff3333', 0.18);
      // ── "그는 사람이었어" 연출 — 감염자(전사자)와 전투 패배 시 ──
      const cz = minigame.combatZombie;
      if (cz && cz.faction === 'INFECTED') {
        const unitLabel = cz.fallenUnit != null
          ? `UNIT-${String(cz.fallenUnit).padStart(2, '0')}`
          : null;
        showRegretNotice(unitLabel);
      }
      devLog(`전투 실패 — 산소 대량 소모, 감염 증가${interrupted ? ' (급습 패널티)' : ''}`, 'danger');
    }
    triggerFlash('red');
    minigame.postCooldown = MG.postCooldown;
    devLog(`방호복 재밀봉 중... 무적 ${MG.postCooldown}초`, '');
  }

  // 감염 100% 체크
  if (player.infection >= 100 && !player.dead) showGameOver('infected');
}

function updateMinigame(dt) {
  // postCooldown은 active 여부와 무관하게 항상 감소
  if (minigame.postCooldown > 0) minigame.postCooldown -= dt;
  if (!minigame.active) return;
  if (minigame.flashTimer > 0) minigame.flashTimer -= dt;

  // 전투 게이지 힘싸움
  if (minigame.type === 'combat' && !minigame.result) {
    // 치료제 선택지 표시 중 — 게이지 감소/타임아웃 정지
    if (minigame.serumChoice) {
      minigame.serumChoiceTimer -= dt;
      if (minigame.serumChoiceTimer <= 0) {
        // 시간 초과 → N 선택과 동일 (계속 싸우기)
        minigame.serumChoice = false;
        minigame.serumChosen = true;
        hideTutChoiceCenter();
        if (window._updateTouchUI) window._updateTouchUI();
      }
      return;
    }
    // 좀비가 게이지를 지속적으로 깎음
    minigame.combatGauge = Math.max(0, minigame.combatGauge - minigame.combatDrain * dt);
    // 제한 시간
    minigame.mashTimer -= dt;

    // 튜토리얼 — 시간 70% 경과(남은시간 30% 이하) 시 F연타 강제 안내, 1회만
    // (튜토리얼 전투는 mashTimer 자체가 늘어나므로, 그 늘어난 총량 기준으로 비율 계산)
    const tutMashTotal = MG.combatMashTime * TUT_COMBAT_TIME_MULT;
    if (TUT_ACTIVE && !TUT_FORCE_MASH_SHOWN && !minigame.serumChosen
        && minigame.mashTimer <= tutMashTotal * 0.3) {
      TUT_FORCE_MASH_SHOWN = true;
      addPopup('F키를 연타하세요!', '#ffaa00', 0);
    }

    if (minigame.mashTimer <= 0) {
      if (TUT_ACTIVE) {
        devLog('전투 시간 초과 (튜토리얼 — 성공 처리)', 'warn');
        endMinigame(true);
      } else {
        devLog('전투 시간 초과 — 실패', 'danger');
        endMinigame(false);
      }
    }
  }

  if (minigame.result) {
    minigame.resultTimer -= dt;
    if (minigame.resultTimer <= 0) {
      // 미니게임 종료 — 시야 복구
      if (TUT_ACTIVE && minigame.type === 'mine' && TUT_VIGNETTE.mode === 'mild') {
        collapseVignetteTo('mild', 300, 1, () => { TUT_VIGNETTE.active = false; });
      }
      minigame.active = false;
      minigame.type   = null;
      revealAround(player.tx, player.ty, CONFIG.player.visionRad);
      if (window._updateTouchUI) window._updateTouchUI();
    }
  }
}

// 주변 numbers 재계산 + detected 초기화 (병원체 제거 후)
function recalcNumbers(tx, ty) {
  const { tiles, numbers, detected, width, height } = MAP;
  detected[ty * width + tx] = 0; // 제거된 타일 탐지 초기화
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

function showExitChoice(mode, remaining) {
  GAME_STATE = 'ESCAPED';
  SoundManager.play('exit_reach');
  SoundManager.stopLoop('oxygen_warn');
  const stageIdx = Math.min(player.stage, CONFIG.stages.length - 1);
  const total     = CONFIG.stages[stageIdx].mineCount;
  const collected = total - (remaining || 0);
  const isLast    = player.stage >= CONFIG.stages.length - 1;

  document.getElementById('early-collected').textContent = collected;
  document.getElementById('early-total').textContent     = total;
  document.getElementById('early-remain').textContent    = remaining || 0;

  if (mode === 'full') {
    // 전부 회수 — 복귀 or 다음 스테이지
    document.getElementById('exit-title').textContent      = '✓ 모든 병원체 회수 완료';
    document.getElementById('exit-title').style.color      = '#00ff88';
    document.getElementById('exit-desc').textContent       = '기지로 복귀하거나 다음 층으로 진행하세요.';
    document.getElementById('exit-retire-btn').style.display = 'block';
    document.getElementById('exit-next-btn').style.display   = isLast ? 'none' : 'block';
    document.getElementById('exit-next-btn').textContent     = '다음 스테이지 ▶';
    document.getElementById('exit-rescan-btn').style.display = 'none';
    document.getElementById('early-stats').style.display    = 'none';
  } else {
    // 미회수 — 조기복귀 or 재탐사
    document.getElementById('exit-title').textContent      = '⚠ 미회수 병원체';
    document.getElementById('exit-title').style.color      = '#ffaa00';
    document.getElementById('exit-desc').textContent       = `${remaining}개 미회수. 지금 나가면 수집한 것만 가져갑니다.`;
    document.getElementById('exit-retire-btn').style.display = 'block';
    document.getElementById('exit-next-btn').style.display   = 'none';
    document.getElementById('exit-rescan-btn').style.display = 'block';
    document.getElementById('early-stats').style.display    = 'flex';
  }
  document.getElementById('early-exit').classList.add('show');
}

function applyStageTransition() {
  // 층 이동 시: 산소 보충 (최대치 초과 불가), 감염 누적 유지
  const healAmt = CONFIG.oxygen.stageHeal;
  player.oxygen   = Math.min(CONFIG.oxygen.max, player.oxygen + healAmt);
  // 감염은 그대로 — 누적 유지
  devLog(`층 이동 — 산소 +${healAmt}% 보충 (현재 ${player.oxygen.toFixed(1)}%), 감염 ${player.infection.toFixed(1)}% 누적`, 'good');
  addPopup(`산소 +${healAmt}%`, '#44ddff', 0);
  // BGM 크로스페이드 — 스테이지별
  const nextStage = player.stage; // 이미 증가된 후 호출됨
  const bgmId = nextStage >= 4 ? 'bgm_stage5'
              : nextStage >= 2 ? 'bgm_stage34'
              : 'bgm_stage12';
  SoundManager.crossfadeBGM(bgmId);
}

// ── 터미널 텍스트 (언어 분리 — 추후 영문 교체 가능) ─────────────
const TERMINAL_LINES = [
  '[기밀 — 5등급 접근 전용]',
  '',
  '실험 코드명: ORIGIN',
  '최초 감염 발생: ████-██-██',
  '발원지: 지하 ██층 밀폐 구역',
  '현재 상태: 생존 확인',
  '',
  '특이사항:',
  '  - 자가 번식 능력 확인됨',
  '  - 크리쳐 생성 능력 확인됨',
  '  - 외부 의사소통 시도 감지됨',
  '',
  '경고: 발원지 봉쇄는 불완전합니다',
  '경고: ORIGIN은 여전히 활성 상태입니다',
  '',
  '...',
  '[통신 두절]',
];

function showEndingSequence() {
  GAME_STATE = 'GAMEOVER'; // 입력 차단

  const endingEl  = document.getElementById('ending-screen');
  const textEl    = document.getElementById('terminal-text');
  const cursorEl  = document.getElementById('terminal-cursor');
  const eyesEl    = document.getElementById('origin-eyes');
  const eyeL      = document.getElementById('eye-left');
  const eyeR      = document.getElementById('eye-right');
  const tbcEl     = document.getElementById('tbc-screen');

  // 통계 채우기
  try {
    const records  = loadRecords();
    const totalDna = parseInt(localStorage.getItem(DNA_KEY) || '0');
    const unit     = getCurrentUnit();
    let totalCollected = 0;
    records.forEach(r => { totalCollected += (r.rawCollected || r.collected || 0); });
    document.getElementById('tbc-collected').textContent = totalCollected;
    document.getElementById('tbc-units').textContent     = Math.max(0, unit - 1);
    document.getElementById('tbc-runs').textContent      = records.length;
  } catch(e) {}

  endingEl.classList.add('show');
  textEl.textContent = '';

  // 타이핑 엔진
  const FULL_TEXT  = TERMINAL_LINES.join('\n');
  let   charIdx    = 0;
  let   fastMode   = false;
  let   typingDone = false;

  const NORMAL_SPEED = 45;  // ms/글자
  const FAST_SPEED   = 4;   // ms/글자 (빨리감기)

  // 빨리감기 — capture:true로 전역 keydown보다 먼저 잡아서 전파 차단
  const onFast = (e) => {
    e.stopPropagation();  // 전역 keydown 핸들러 차단
    e.preventDefault();
    fastMode = true;
  };
  const onNorm = (e) => { fastMode = false; };
  window.addEventListener('keydown',  onFast, true);  // capture phase
  window.addEventListener('keyup',    onNorm, true);
  endingEl.addEventListener('mousedown', onFast);
  endingEl.addEventListener('mouseup',   onNorm);

  function cleanupFastListeners() {
    window.removeEventListener('keydown',  onFast, true);
    window.removeEventListener('keyup',    onNorm, true);
    endingEl.removeEventListener('mousedown', onFast);
    endingEl.removeEventListener('mouseup',   onNorm);
  }

  function typeNext() {
    if (typingDone) return;
    if (charIdx >= FULL_TEXT.length) {
      typingDone = true;
      cursorEl.style.display = 'none';
      document.getElementById('terminal-hint').style.display = 'none';
      cleanupFastListeners();
      setTimeout(showOriginEyes, 1000);
      return;
    }
    textEl.textContent += FULL_TEXT[charIdx++];
    // 자동 스크롤
    const box = document.getElementById('terminal-box');
    box.scrollTop = box.scrollHeight;
    setTimeout(typeNext, fastMode ? FAST_SPEED : NORMAL_SPEED);
  }
  setTimeout(typeNext, 600);

  function showOriginEyes() {
    endingEl.style.background = '#000';
    endingEl.querySelector('#terminal-box').style.display = 'none';
    eyesEl.classList.add('show');
    // 눈 점등 (약간 시차)
    setTimeout(() => { eyeL.classList.add('lit'); }, 200);
    setTimeout(() => { eyeR.classList.add('lit'); }, 500);
    // 2.5초 후 눈 꺼짐 → TBC
    setTimeout(() => {
      eyeL.classList.remove('lit');
      eyeR.classList.remove('lit');
      setTimeout(() => {
        eyesEl.classList.remove('show');
        endingEl.classList.remove('show');
        showTBC();
      }, 1200);
    }, 2500);
  }

  function showTBC() {
    tbcEl.classList.add('show');
    SoundManager.playBGM('bgm_ending', 2.0);
  }
}

function showEscaped(exitType) {
  player.dead = true;
  GAME_STATE = 'ESCAPED';
  const finalCollected = saveRunRecord(exitType || 'retire');
  const elapsed = Math.floor((Date.now() - stats.startTime) / 1000);
  const stageIdx = Math.min(player.stage, CONFIG.stages.length - 1);
  const totalMines = CONFIG.stages[stageIdx].mineCount;
  let remaining = 0;
  for (let i = 0; i < MAP.tiles.length; i++) if (MAP.tiles[i] === T.MINE) remaining++;
  const collected = totalMines - remaining;

  document.getElementById('esc-stage').textContent = `${stageIdx + 1}층 클리어`;
  document.getElementById('esc-items').textContent = `${collected} / ${totalMines}`;
  // 누적 수집량 표시 (있으면)
  const totalEl = document.getElementById('esc-total');
  if (totalEl) totalEl.textContent = finalCollected;
  document.getElementById('esc-mines').textContent = stats.minesHit;
  document.getElementById('esc-time').textContent  = elapsed + '초';

  // 마지막 층이면 엔딩 시퀀스, 아니면 일반 탈출 패널
  const isLast = player.stage >= CONFIG.stages.length - 1;
  document.getElementById('esc-clear').style.display = 'none';
  document.getElementById('esc-btn').style.display   = 'none';

  SoundManager.stopLoop('oxygen_warn');

  if (isLast) {
    // 5층 클리어 — 엔딩 시퀀스
    SoundManager.stopBGMImmediate();
    setTimeout(() => SoundManager.play('all_clear'), 300);
    setTimeout(() => showEndingSequence(), 1500);
  } else {
    // 일반 층 클리어
    SoundManager.stopBGM(0.8);
    setTimeout(() => SoundManager.play('stage_clear'), 200);
    document.getElementById('escaped').classList.add('show');
  }
}

// ── 런 기록 저장 ─────────────────────────────────────────────────
// exitType: 'retire'(전부회수) | 'early'(조기탈출) | 'death'(사망) | 'infected'(좀비화)
function saveRunRecord(exitType) {
  if (player.recordSaved) return player.lastFinalCollected || 0;
  player.recordSaved = true;

  const stageIdx = Math.min(player.stage, CONFIG.stages.length - 1);
  const elapsed  = Math.floor((Date.now() - stats.startTime) / 1000);

  let finalCollected;
  if (exitType === 'death' || exitType === 'infected') {
    finalCollected = Math.floor(player.totalCollected / 2);
  } else {
    finalCollected = player.totalCollected;
  }
  player.lastFinalCollected = finalCollected;

  const record = {
    date:         new Date().toLocaleString('ko-KR'),
    exitType,
    unit:         getCurrentUnit(),
    stage:        stageIdx + 1,
    stageName:    CONFIG.stages[stageIdx].name,
    rawCollected: player.totalCollected,
    collected:    finalCollected,
    infection:    Math.ceil(player.infection),
    elapsed,
  };

  try {
    const prev = JSON.parse(localStorage.getItem(RECORDS_KEY) || '[]');
    prev.push(record);
    localStorage.setItem(RECORDS_KEY, JSON.stringify(prev));
    const prevDna = parseInt(localStorage.getItem(DNA_KEY) || '0');
    localStorage.setItem(DNA_KEY, String(prevDna + finalCollected));
  } catch(e) { console.warn('기록 저장 실패', e); }

  // 다음 출격 시 유닛 번호 증가 여부 결정 — 조기탈출이면 같은 유닛 유지
  setLastExitType(exitType);

  // 감염사 + 일반 사망 → 전사자 풀 등록
  if (exitType === 'infected' || exitType === 'death') {
    addToFallenPool(getCurrentUnit(), stageIdx + 1);
    devLog(`UNIT-${String(getCurrentUnit()).padStart(2,'0')} 전사자 풀 등록 [${exitType}]`, 'warn');
  }

  const label = { retire:'복귀', early:'조기탈출', death:'사망', infected:'좀비화' }[exitType] || exitType;
  devLog(`기록 저장 [${label}] ${stageIdx+1}층 / 획득 ${finalCollected}개 (회수 ${player.totalCollected})`, 'good');
  return finalCollected;
}

// ================================================================
//  기지 시스템 (데이터/로직 중심 — UI는 추후 교체)
// ================================================================

// localStorage 키 상수
const UPGRADE_KEY  = 'outbreak_upgrades';
const RECORDS_KEY  = 'outbreak_records';
const DNA_KEY      = 'outbreak_total_dna';
const UNIT_KEY     = 'outbreak_unit_number'; // 현재 요원 번호
const FALLEN_KEY   = 'outbreak_fallen_pool'; // 전사자 풀 (감염자 증원용)

// ── 전사자 풀 관리 ────────────────────────────────────────────────
function loadFallenPool() {
  try { return JSON.parse(localStorage.getItem(FALLEN_KEY) || '[]'); } catch(e) { return []; }
}
function saveFallenPool(pool) {
  try { localStorage.setItem(FALLEN_KEY, JSON.stringify(pool)); } catch(e) {}
}
function addToFallenPool(unitNum, stage, cause = null) {
  const pool = loadFallenPool();
  // 층당 최대 N명 제한
  const stagePool = pool.filter(f => f.stage === stage);
  if (stagePool.length >= CONFIG.fallen.maxPerStage) return;
  // 중복 방지
  if (pool.find(f => f.unit === unitNum)) return;
  const entry = { unit: unitNum, stage };
  // cause가 있을 때만 임무일지에 표시 — 본게임 사망/감염(런 기록에서 이미 자세히 표시됨)은 cause 없이 호출되어 중복 표시 방지
  if (cause) { entry.cause = cause; entry.ts = Date.now(); }
  pool.push(entry);
  saveFallenPool(pool);
}

// cause 갈아끼우기용 — 추후 스테이지에서 UNIT-00을 조우한 뒤 정확한 사유로 교체할 때 사용
function updateFallenCause(unitNum, cause) {
  const pool = loadFallenPool();
  const entry = pool.find(f => f.unit === unitNum);
  if (!entry) return false;
  entry.cause = cause;
  saveFallenPool(pool);
  return true;
}
function removeFromFallenPool(unitNum) {
  const pool = loadFallenPool();
  const idx  = pool.findIndex(f => f.unit === unitNum);
  if (idx === -1) return false;
  pool.splice(idx, 1);
  saveFallenPool(pool);
  return true;
}

function loadUpgrades() {
  try { return JSON.parse(localStorage.getItem(UPGRADE_KEY) || '{}'); }
  catch(e) { return {}; }
}
function saveUpgrades(data) {
  try { localStorage.setItem(UPGRADE_KEY, JSON.stringify(data)); } catch(e) {}
}

// 요원 번호 — 완주/사망/좀비화 시에만 +1 (조기탈출은 같은 유닛 유지)
function getCurrentUnit() {
  try { return parseInt(localStorage.getItem(UNIT_KEY) || '0'); }
  catch(e) { return 0; }
}
function incrementUnit() {
  const n = getCurrentUnit() + 1;
  try { localStorage.setItem(UNIT_KEY, String(n)); } catch(e) {}
  return n;
}

const LAST_EXIT_KEY = 'outbreak_last_exit_type';
function getLastExitType() {
  try { return localStorage.getItem(LAST_EXIT_KEY) || null; }
  catch(e) { return null; }
}
function setLastExitType(type) {
  try { localStorage.setItem(LAST_EXIT_KEY, type); } catch(e) {}
}

// 런 시작 시 호출 — 조기탈출 다음 런이면 유닛 유지, 그 외엔 새 유닛
function advanceUnitIfNeeded() {
  const last = getLastExitType();
  if (last === 'early') return; // 조기탈출 직후 — 같은 유닛으로 이어서 출격
  incrementUnit();               // 완주/사망/좀비화/첫 시작 — 새 유닛
}

// ── 유닛 행동 로그 (안식/소멸) — 임무일지에 시간순으로 통합 표시 ──
// 유물 해금 조건 등에서 재사용 가능하도록 영구 저장
const UNIT_ACTIONS_KEY = 'outbreak_unit_actions';
function loadUnitActions() {
  try { return JSON.parse(localStorage.getItem(UNIT_ACTIONS_KEY) || '[]'); }
  catch(e) { return []; }
}
function logUnitAction(unitNum, action, stage) {
  if (unitNum == null) return; // 인식표 없는 좀비는 기록 안 함
  try {
    const list = loadUnitActions();
    list.push({ unit: unitNum, action, stage, date: new Date().toLocaleString('ko-KR'), ts: Date.now() });
    localStorage.setItem(UNIT_ACTIONS_KEY, JSON.stringify(list));
  } catch(e) {}
}

// 현재 업그레이드가 게임 파라미터에 적용된 효과 반환
function getUpgradeEffects() {
  const ups = loadUpgrades();
  const fx = {
    oxygenMaxBonus:       0,
    oxygenDrainMult:      1.0,
    infectThresholdBonus: 0,
    combatPowerBonus:     0,
    postCooldownBonus:    0,
    capsuleHealBonus:     0,
    patternLenMinus:      0,
    noiseRadiusMinus:     0,
    sonarRadiusBonus:     0,
    infectResistRate:     0,   // 회수 성공 시 감염 증가 감소율 (0~1)
  };
  const all = [...LOBBY.status, ...LOBBY.trait];
  for (const item of all) {
    const lv = ups[item.id] || 0;
    if (lv <= 0) continue;
    const e = item.effects(lv);
    for (const k in e) {
      if (k === 'oxygenDrainMult') fx[k] *= e[k];
      else if (typeof e[k] === 'boolean') fx[k] = fx[k] || e[k];
      else fx[k] += e[k];
    }
  }
  return fx;
}

// ── 기지 화면 열기/닫기 ──────────────────────────────────────────
function showLobby() {
  GAME_STATE = 'LOBBY';
  // 타이틀/게임오버/탈출 화면 모두 닫기
  ['title-screen','gameover','escaped','early-exit','stage-intro']
    .forEach(id => document.getElementById(id)?.classList.remove('show'));
  document.getElementById('lobby-screen').classList.add('show');
  SoundManager.crossfadeBGM('bgm_base');
  renderLobbyMeta();
  renderLobby('status');
  // 버튼 포커스로 Space가 먹히는 문제 방지 — canvas로 포커스 이동
  setTimeout(() => document.getElementById('canvas')?.focus(), 50);
}

function closeLobby() {
  document.getElementById('lobby-screen').classList.remove('show');
  showTitle();
}

// 요원 정보 / DNA 헤더 갱신
function renderLobbyMeta() {
  const dna     = parseInt(localStorage.getItem(DNA_KEY) || '0');
  const records = loadRecords();
  const unit    = getCurrentUnit();
  document.getElementById('lb-dna-val').textContent    = dna;
  document.getElementById('lb-agent-name').textContent = `UNIT-${String(unit).padStart(2,'0')}`;
  document.getElementById('lb-agent-runs').textContent = `총 출격 ${records.length}회`;
}

// 런 기록 로드
function loadRecords() {
  try { return JSON.parse(localStorage.getItem(RECORDS_KEY) || '[]'); }
  catch(e) { return []; }
}

// ── 탭별 콘텐츠 렌더링 ────────────────────────────────────────────
function renderLobby(tab) {
  // 사이드바 탭 버튼 활성화
  document.querySelectorAll('.lb-tab-btn').forEach(b => {
    b.classList.toggle('on', b.dataset.tab === tab);
  });
  renderLobbyMeta();

  const el = document.getElementById('lb-content');

  if (tab === 'relic') {
    el.innerHTML = '<div class="lb-locked">🔒 유물 — 추후 해금</div>';
    return;
  }
  if (tab === 'memorial') {
    renderMemorial(el);
    return;
  }

  // 스테이터스 / 특성 공통 렌더
  const dna     = parseInt(localStorage.getItem(DNA_KEY) || '0');
  const ups     = loadUpgrades();
  const isTrait = tab === 'trait';
  const items   = isTrait ? LOBBY.trait : LOBBY.status;
  const dotCls  = isTrait ? 'trait-on' : 'on';
  const btnCls  = isTrait ? 'lb-btn trait' : 'lb-btn';

  const effText = (item) => {
    const lines = [];
    for (let i = 1; i <= item.maxLv; i++) {
      const e = item.effects(i);
      const p = [];
      if (e.oxygenMaxBonus)        p.push(`산소 +${Math.round(e.oxygenMaxBonus*100)}%`);
      if (e.oxygenDrainMult)       p.push(`감소속도 ×${e.oxygenDrainMult.toFixed(2)}`);
      if (e.infectThresholdBonus)  p.push(`감염기준 -${e.infectThresholdBonus}%`);
      if (e.combatPowerBonus)      p.push(`전투게이지 +${e.combatPowerBonus}`);
      if (e.postCooldownBonus)     p.push(`무적 +${e.postCooldownBonus}초`);
      if (e.capsuleHealBonus)      p.push(`캡슐 +${Math.round(e.capsuleHealBonus*100)}%`);
      if (e.patternLenMinus)       p.push(`패턴 -${e.patternLenMinus}자`);
      if (e.noiseRadiusMinus)      p.push(`소음반경 -${e.noiseRadiusMinus}칸`);
      if (e.sonarRadiusBonus)      p.push(`소나반경 +${e.sonarRadiusBonus}칸`);
      if (e.noInfectOnSuccess)     p.push('회수성공 감염 없음');
      lines.push(`Lv${i}: ${p.join(', ')}`);
    }
    return lines.join('<br>');
  };

  let html = `<div class="lb-section">— ${isTrait ? '특성 (오브젝트 영향)' : '스테이터스 (기본 능력치)'} —</div><div class="lb-grid">`;
  for (const item of items) {
    const lv    = ups[item.id] || 0;
    const isMax = lv >= item.maxLv;
    const cost  = isMax ? 0 : item.costs[lv];
    const canBuy = !isMax && dna >= cost;
    let dots = '';
    for (let i = 0; i < item.maxLv; i++)
      dots += `<div class="lb-dot${i < lv ? ' '+dotCls : ''}"></div>`;
    html += `
      <div class="lb-card${isTrait?' trait':''}">
        <div class="lb-card-name">${item.name}</div>
        <div class="lb-card-desc">${item.desc}</div>
        <div class="lb-card-eff">${effText(item)}</div>
        <div class="lb-lv-row">${dots}<span class="lb-cost">${isMax?'MAX':'DNA '+cost}</span></div>
        <button class="${btnCls}" data-id="${item.id}" data-tab="${tab}" ${!canBuy?'disabled':''}>
          ${isMax?'최대':'강화 ▶'}
        </button>
      </div>`;
  }
  html += '</div>';
  el.innerHTML = html;

  // 강화 버튼 이벤트
  el.querySelectorAll('[data-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id    = btn.dataset.id;
      const t     = btn.dataset.tab;
      const ups2  = loadUpgrades();
      const lv2   = ups2[id] || 0;
      const item2 = [...LOBBY.status, ...LOBBY.trait].find(x => x.id === id);
      if (!item2 || lv2 >= item2.maxLv) return;
      const cost2 = item2.costs[lv2];
      const dna2  = parseInt(localStorage.getItem(DNA_KEY) || '0');
      if (dna2 < cost2) return;
      ups2[id] = lv2 + 1;
      saveUpgrades(ups2);
      localStorage.setItem(DNA_KEY, String(dna2 - cost2));
      SoundManager.play('upgrade_buy');
      devLog(`강화: ${item2.name} Lv${ups2[id]} (DNA -${cost2})`, 'good');
      renderLobby(t);
    });
  });
}

// ── 임무일지 (구 "전사자 기록") ──────────────────────────────────
// 런 기록(완주/조기탈출/사망/좀비화) + 유닛 행동(안식/소멸)을 시간순으로 통합 표시
const MEMORIAL_ICONS = {
  retire:   '🧬',  // 탈출 성공
  early:    '☣',   // 조기 탈출
  death:    '💀',  // 사망
  infected: '🪖',  // 좀비화
};
const MEMORIAL_LABELS = {
  retire:'탈출', early:'조기탈출', death:'사망', infected:'좀비화',
};
const ACTION_ICONS = { rested: '✦', dissolved: '☠' };
const ACTION_LABELS = { rested: '안식시킴', dissolved: '소멸시킴' };
// 전사자 풀 cause 표시 라벨 — 'lost'는 임시 사유, 1스테이지 조우 후 updateFallenCause()로 정확한 사유로 교체 예정
const CAUSE_ICONS  = { lost: '📡' };
const CAUSE_LABELS = { lost: '로스트' };

function renderMemorial(el) {
  const records = loadRecords();
  const actions = loadUnitActions();
  // cause가 있는 전사자 풀 항목만 표시 — 본게임 사망/감염은 이미 'run' 기록으로 자세히 표시되므로 cause 없이 등록되어 여기 안 끼임 (중복 방지)
  const fallenCaused = loadFallenPool().filter(f => f.cause);

  if (records.length === 0 && actions.length === 0 && fallenCaused.length === 0) {
    el.innerHTML = '<div class="lb-section">— 임무일지 —</div><div class="mem-empty">아직 기록 없음</div>';
    return;
  }

  // 세 종류를 하나의 타임라인으로 합치고 시간순 정렬
  const timeline = [
    ...records.map(r => ({ kind: 'run', ts: new Date(r.date).getTime() || 0, data: r })),
    ...actions.map(a => ({ kind: 'action', ts: a.ts || 0, data: a })),
    ...fallenCaused.map(f => ({ kind: 'fallen', ts: f.ts || 0, data: f })),
  ].sort((a, b) => b.ts - a.ts); // 최신순

  let html = '<div class="lb-section">— 임무일지 —</div>';
  timeline.forEach(entry => {
    if (entry.kind === 'run') {
      const r      = entry.data;
      const icon   = MEMORIAL_ICONS[r.exitType] || '☣';
      const label  = MEMORIAL_LABELS[r.exitType] || r.exitType;
      const unit   = r.unit ? `UNIT-${String(r.unit).padStart(2,'0')}` : `UNIT-??`;
      const raw    = r.rawCollected ?? r.collected ?? 0;
      html += `
        <div class="mem-item">
          <div class="mem-icon">${icon}</div>
          <div class="mem-info">
            <div class="mem-name">${unit} — ${r.stage}층 ${r.stageName || ''}</div>
            <div class="mem-detail">${label} | ${r.elapsed}초 생존 | 회수 ${raw}개 | 감염 ${r.infection}%</div>
          </div>
          <div class="mem-dna">+${r.collected} DNA</div>
        </div>`;
    } else if (entry.kind === 'fallen') {
      const f     = entry.data;
      const icon  = CAUSE_ICONS[f.cause] || '❔';
      const label = CAUSE_LABELS[f.cause] || f.cause;
      const unit  = `UNIT-${String(f.unit).padStart(2,'0')}`;
      html += `
        <div class="mem-item" style="opacity:0.75;">
          <div class="mem-icon">${icon}</div>
          <div class="mem-info">
            <div class="mem-name">${unit} — ${f.stage}층</div>
            <div class="mem-detail">${label}</div>
          </div>
        </div>`;
    } else {
      const a     = entry.data;
      const icon  = ACTION_ICONS[a.action] || '•';
      const label = ACTION_LABELS[a.action] || a.action;
      const unit  = `UNIT-${String(a.unit).padStart(2,'0')}`;
      html += `
        <div class="mem-item" style="opacity:0.75;">
          <div class="mem-icon">${icon}</div>
          <div class="mem-info">
            <div class="mem-name">${unit} ${label}</div>
            <div class="mem-detail">${a.stage}층에서 조우</div>
          </div>
        </div>`;
    }
  });
  el.innerHTML = html;
}

// ── 타이틀 화면 ──────────────────────────────────────────────────
function showTitle() {
  GAME_STATE = 'TITLE';
  TUT_ACTIVE = false;
  TUT_LOCKED = false;
  TUT_STEP   = null;
  TUT_FREEZE_ZOMBIES = false;
  TUT_VIGNETTE.active = false;
  hideTutorialBox();
  hideTutorialIntroScreen();
  document.getElementById('title-screen').classList.add('show');
  updateTitleStats();
  SoundManager.init();
  SoundManager.playBGM('bgm_title', 1.5);
}

function updateTitleStats() {
  try {
    const records = JSON.parse(localStorage.getItem(RECORDS_KEY) || '[]');
    const totalDna = parseInt(localStorage.getItem(DNA_KEY) || '0');
    const bestStage = records.reduce((m, r) => Math.max(m, r.stage || 0), 0);
    document.getElementById('ts-dna').textContent   = totalDna;
    document.getElementById('ts-best').textContent  = bestStage > 0 ? bestStage + 'F' : '-';
    document.getElementById('ts-runs').textContent  = records.length;
  } catch(e) {}
}

function applyUpgradeEffects() {
  const fx = getUpgradeEffects();
  // 산소 최대치
  CONFIG.oxygen.max = Math.round(100 * (1 + fx.oxygenMaxBonus));
  // 산소 감소 속도 배율 (drainPerStage 전체에 적용)
  CONFIG.oxygen._drainMult = fx.oxygenDrainMult;
  // 감염 임계값
  CONFIG.oxygen.infectThreshold = 60 - fx.infectThresholdBonus;
  // 전투 게이지 증가량
  MG.combatPlayerPower = 18 + fx.combatPowerBonus;
  // 무적 시간
  MG.postCooldown = 3.0 + fx.postCooldownBonus;
  // 캡슐 회복량
  CONFIG.oxygen.capsuleHeal = Math.round(33 * (1 + fx.capsuleHealBonus));
  // 소나 반경
  CONFIG.sonar.maxRadius = 4 + fx.sonarRadiusBonus;
  // 특성 효과는 런타임에서 참조 (MG/endMinigame에서 getUpgradeEffects 호출)
  devLog(`업그레이드 효과 적용: 산소MAX=${CONFIG.oxygen.max} 감소×${fx.oxygenDrainMult.toFixed(2)} 전투+${fx.combatPowerBonus}`, 'good');
}

// ================================================================
//  튜토리얼 (UNIT-00)
//  세계관 설명 → 이동 학습 → 기본소나 학습(병원체 2개, danger=2 시연)
//  → 회수 미니게임 1개 → 기지 전환
//  PR 1 범위: 여기까지. (정밀소나/전투/사망 연출은 후속 PR)
// ================================================================
let TUT_ACTIVE = false;   // 튜토리얼 진행 중 여부
let TUT_LOCKED = false;   // true면 이동 입력 차단 (대화창 보는 중)
let TUT_STEP   = null;    // 'world_intro'|'move_intro'|'moving'|'sonar_prompt'|'sonar_result'|'mine_collect'|'mine_collect_2'|'serum_prompt'|'serum_use_wait'|'sonar_prompt_2'|'sonar_result_2'|'mine_collect_3'|'ambush'|'aftermath'|'precise_prompt'|'precise_revealed'|'done'
let TUT_FORCE_MASH_SHOWN = false; // 전투 중 F연타 강제안내 1회 표시 플래그
let TUT_FREEZE_ZOMBIES = false;   // true면 좀비 AI 갱신 정지 (정밀소나 연출용 — 다가오면 안 됨)
let TUT_SERUM_PROMPT_TIMER = 0;   // 치료제 선택(Y/N) 자동 타임아웃 — 0이면 비활성
let TUT_SERUM_PROMPT_ACTIVE = false; // 평시 Y/N 선택지가 화면에 떠 있는 동안만 true — TUT_STEP과 별개로 모바일 터치 UI 노출 제어용 (N 선택 후 후속 대사 중엔 TUT_STEP은 그대로지만 선택지는 이미 닫혀야 함)
let TUT_PRECISE_READY = false; // precise_prompt 텍스트 타이핑이 끝나야 true — 그 전엔 G키를 눌러도 무시(너무 빨리 지나가는 문제 방지)
const TUT_COMBAT_TIME_MULT = 2.2; // 튜토리얼 전투 제한시간 배율 — 텍스트 읽을 여유 보장
const TUT_COMBAT_PLAYER_POWER = 11; // 튜토리얼 전투 F연타당 게이지 증가량 — 드레인은 본게임 그대로 두고 이 값으로 "F 10번 안팎" 조정
const TUT_SERUM_CHOICE_TIME = 7.0; // 튜토리얼 치료제 선택지(Y/N) 결정 시간 — 본게임 3초보다 충분히 여유있게

const TUT_WORLD_LINES = [
  '[수신: 격리구역 통신망]',
  '',
  '...이곳은 한때 평범한 병원이었다.',
  '지금은 아니다.',
  '',
  '임무: 병원체 회수.',
  '생존자는 없다고 가정하라.',
  '— 단, 정말 그런지는 직접 확인하게 될 것이다.',
];

const TUT_MOVE_LINES = [
  '목표 지점 도착했습니다.',
  '즉시 이동하여 탐색을 시작합니다.',
];

// 산소 안내 — 도착보고 다음 (Space로 진행)
const TUT_OXYGEN_LINES = [
  '가용 산소 100%.',
  '생존 가능 시간 약 50초입니다.',
  '그 이후로는 오염도가 증가합니다.',
];

// 이동 지시 — 산소안내 다음 (자동진행, 이동 시작 시 닫힘)
const TUT_MOVE_GO_LINES = [
  '상하좌우 방향키로 이동합니다.',
];

const TUT_SONAR_LINES = [
  '병원체 탐색을 위해',
  '소나를 가동합니다.',
  '',
  '[F] 키를 꾹 눌러 소나를 사용하세요.',
];

const TUT_SONAR_RESULT_LINES = [
  '인근 병원체 반응 확인. 코드 오렌지.',
  '주변에 약한 반응(옐로우)도 감지됩니다.',
  '',
  '채집을 시작합니다.',
];

// 치료제 선택 — 2번째 회수 직후. Y(거친 선택)/N(아낀다) 둘 다 직접 만든 입력 핸들러로 처리
const TUT_SERUM_PROMPT_LINES = [
  '병원체 2개 회수 완료. 경미한 오염 발생.',
  '',
  '치료제를 사용하시겠습니까?',
  '[Y] 사용  /  [N] 보류',
];

const TUT_SERUM_USE_LINES = [
  '[D] 키를 눌러 치료제를 사용하세요.',
];

const TUT_SERUM_HOLD_LINES = [
  '이건 내가 쓸 게 아니야.',
  '그들을 위해서 남겨둬야 해.',
];

const TUT_SERUM_DONE_LINES = [
  '남은 병원체 1개. 회수 후 즉시 복귀합니다.',
];

// 3번째 병원체 탐지를 위한 소나 재사용 안내 — 자동진행(F차징 시작 시 닫힘)
const TUT_SONAR2_LINES = [
  '남은 병원체 탐지를 위해',
  '소나를 다시 가동합니다.',
  '',
  '[F] 키를 꾹 눌러 소나를 사용하세요.',
];

const TUT_SONAR2_RESULT_LINES = [
  '병원체 반응 확인.',
  '',
  '채집을 시작합니다.',
];

// ── 습격 시퀀스 (시간기반 자동진행 — 다급함을 끊지 않기 위해 Space 불필요) ──
const TUT_AMBUSH_LINES = [
  '제기랄, 코드 레드! 코드 레드!',
  '대상 생명체 진위 확인 미실시',
  '— 정밀소나 사용 불가.',
];

// 전투 시작 대사 — player.serum 값으로 분기(0=이미 사용함, >0=아직 있음)
const TUT_AMBUSH_NOSERUM_LINES = [
  '제길, 치료제가...!',
];

const TUT_AMBUSH_HASSERUM_LINES = [
  '치료제를 사용해야 하나?',
  '식별이 안 됐는데!!',
];

const TUT_PRECISE_LINES = [
  '(거친 숨소리)',
  '',
  '미확인 크리쳐의 접근으로 접촉상황 발생.',
  '추가 크리쳐 및 감염자 확인을 위해',
  '정밀소나를 사용합니다.',
  '',
  '[G] 키를 눌러 정밀소나를 사용하세요.',
];

const TUT_DESPAIR_LINES = [
  '.....제기랄.',
];

function startTutorial() {
  ['title-screen','lobby-screen'].forEach(id =>
    document.getElementById(id)?.classList.remove('show'));
  TUT_ACTIVE = true;
  TUT_LOCKED = true;
  TUT_STEP   = 'world_intro';
  resetOriginFlash(); // 깨끗한 상태로 시작 — 습격 직후 화이트플래시 보장

  // 콘솔 강제 초기화 후 재실행 등 비정상 재시작 경로에서 이전 잔여값이 남지 않도록 명시적 리셋
  TUT_FREEZE_ZOMBIES     = false;
  TUT_FORCE_MASH_SHOWN   = false;
  TUT_SERUM_PROMPT_TIMER = 0;
  TUT_SERUM_PROMPT_ACTIVE = false;
  TUT_PRECISE_READY = false;
  hideTutChoiceCenter();
  TUT_VIGNETTE.active = false;
  TUT_VIGNETTE.mode   = null;
  TUT_VIGNETTE.radius = 1;
  TUT_VIGNETTE.pulseT = 0;

  player.stage          = 0;
  player.oxygen         = CONFIG.oxygen.max;
  player.infection      = 0;
  player.totalCollected = 0;
  player.recordSaved    = false;
  player.serum          = CONFIG.serum.initialCount;
  // 튜토리얼은 본게임 특성(업그레이드) 효과를 적용하지 않음 — 항상 기본값으로 동일하게 시연
  resetConfigToDefaults();
  player.oxygen = CONFIG.oxygen.max;

  MAP = generateTutorialMap();
  VISITED = new Uint8Array(MAP.width * MAP.height);
  VISIBLE  = new Uint8Array(MAP.width * MAP.height);

  Object.assign(player, {
    tx: TUT_START_TX, ty: TUT_START_TY,
    px: TUT_START_TX * CONFIG.map.tileSize, py: TUT_START_TY * CONFIG.map.tileSize,
    targetX: TUT_START_TX * CONFIG.map.tileSize, targetY: TUT_START_TY * CONFIG.map.tileSize,
    moving: false, facing: 'down',
    dead: false, itemsFound: 0, exitCooldown: 0,
  });

  Object.assign(sonar, {
    charging:false, chargeTime:0,
    chargingPrecise:false, chargeTimePrecise:0,
    firing:false, pulseR:0, pulseMaxR:0,
    pings:[], preciseMarks:[],
    precise: CONFIG.sonar.preciseCount,
    radarTimer: 0, radarRadius: 0,
  });

  zombies.length = 0; // 튜토리얼 1단계는 좀비 없음
  noisePulses.length = 0;
  popups.length = 0;
  notices.length = 0;
  Object.assign(minigame, {
    active:false, type:null, pattern:[], current:0, result:null,
    resultTimer:0, flashTimer:0, mineTileIdx:-1, combatZombie:null,
    interruptedMine:false, postCooldown:0,
    combatGauge:0, combatDrain:0, playerPower: MG.combatPlayerPower, mashTimer:0,
  });

  revealAround(TUT_START_TX, TUT_START_TY, CONFIG.player.visionRad);
  camX = player.px + CONFIG.map.tileSize / 2 - viewW() / 2;
  camY = player.py + CONFIG.map.tileSize / 2 - viewH() / 2;

  ['gameover','escaped','early-exit','stage-intro','ending-screen','tbc-screen','origin-eyes']
    .forEach(id => document.getElementById(id)?.classList.remove('show'));

  // ── 1단계: 풀스크린 암전 — 세계관 설명 (인게임 화면은 아직 안 보임) ──
  GAME_STATE = 'TUTORIAL_INTRO';
  SoundManager.crossfadeBGM('bgm_base');

  showTutorialIntroScreen(TUT_WORLD_LINES, () => {
    hideTutorialIntroScreen();
    // ── 2단계: 인게임 화면 등장 — 이동 안내부터는 하단 오버레이 대화창 ──
    GAME_STATE = 'PLAYING';
    TUT_STEP = 'move_intro';
    showTutorialLine(TUT_MOVE_LINES, () => {
      // 도착보고 다음 — 산소 안내(Space로 진행)
      showTutorialLine(TUT_OXYGEN_LINES, () => {
        // 산소안내 다음 — 이동 지시(자동진행, 실제 이동 시작 시 닫힘)
        showTutorialLine(TUT_MOVE_GO_LINES, () => {
          TUT_STEP = 'moving';
          TUT_LOCKED = false; // 이동 허용 — 대화창은 플레이어가 실제로 움직이기 시작할 때 닫힘
        }, true); // autoAdvance
      }); // Space로 진행
    }); // Space로 진행
  });
}

// ── 튜토리얼 텍스트 진행 공용 키 핸들러 (F/Space) ────────────────
// _tutAdvance: 현재 호출하면 "타이핑 즉시완성" 또는 "다음 단계로" 동작하는 함수. null이면 대기 중 아님.
let _tutAdvance = null;
let _tutBoxToken = 0; // showTutorialLine 호출마다 갱신 — 'timer' 모드의 뒤늦은 정리 타이머가 최신 텍스트를 잘못 지우는 것 방지

function tutorialAdvanceKey() {
  if (_tutAdvance) _tutAdvance();
}

// ── 튜토리얼 풀스크린 암전 인트로 (세계관 설명 전용) ─────────────
// 검은 화면에서 커서만 깜빡이다가 텍스트가 타이핑되는 구조 — 엔딩 터미널과 동일한 패턴
// F 또는 Space로 진행: 타이핑 중엔 즉시완성, 완성 후엔 다음 단계로
function showTutorialIntroScreen(lines, onDone) {
  const screen   = document.getElementById('tutorial-intro-screen');
  const textEl   = document.getElementById('tutorial-intro-text');
  const cursorEl = document.getElementById('tutorial-intro-cursor');
  const hintEl   = document.getElementById('tutorial-intro-hint');
  if (!screen || !textEl || !cursorEl) { if (onDone) onDone(); return; }

  screen.classList.add('show');
  const textNode = document.createTextNode('');
  textEl.textContent = '';
  textEl.appendChild(textNode);
  textEl.appendChild(cursorEl);
  cursorEl.style.display = '';
  if (hintEl) hintEl.style.display = 'none';

  const FULL_TEXT = Array.isArray(lines) ? lines.join('\n') : lines;
  let charIdx = 0;
  let typingDone = false;
  const SPEED = 55; // ms/글자 — 사람이 편하게 읽을 수 있는 속도

  function finishTyping() {
    typingDone = true;
    textNode.textContent = FULL_TEXT;
    cursorEl.style.display = 'none';
    if (hintEl) hintEl.style.display = '';
    _tutAdvance = () => { _tutAdvance = null; if (onDone) onDone(); };
  }

  function typeNext() {
    if (typingDone) return; // 이미 즉시완성됐다면 예약된 타이머는 더 진행하지 않음 (중복출력 방지)
    if (charIdx >= FULL_TEXT.length) { finishTyping(); return; }
    textNode.textContent += FULL_TEXT[charIdx++];
    setTimeout(typeNext, SPEED);
  }

  // 타이핑 중에는 Space로 스킵 불가 — 끝까지 자연스러운 속도로 출력됨
  // 커서만 잠시 깜빡이다가 타이핑 시작 — 검은 화면에 커서만 깜빡이는 느낌
  setTimeout(typeNext, 900);
}

function hideTutorialIntroScreen() {
  const screen = document.getElementById('tutorial-intro-screen');
  if (screen) screen.classList.remove('show');
}

// ── 튜토리얼 대화창 타이핑 엔진 (엔딩 터미널과 동일한 패턴) ──────
// autoAdvance: true(행동트리거형 — 타이핑끝나면 onDone 즉시, 닫힘은 호출측이 처리) |
//              'timer'(시간기반 자동진행 — 최소체류시간 보장 후 자동으로 onDone+페이드아웃 닫힘) |
//              false/undefined(Space로 진행)
function showTutorialLine(lines, onDone, autoAdvance) {
  const box     = document.getElementById('tutorial-box');
  const textEl  = document.getElementById('tutorial-text');
  const cursorEl= document.getElementById('tutorial-cursor');
  const hintEl  = document.getElementById('tutorial-hint');
  if (!box || !textEl || !cursorEl) { if (onDone) onDone(); return; }

  const myToken = ++_tutBoxToken; // 이 호출의 고유 토큰 — 이후 다른 showTutorialLine이 호출되면 갱신됨

  box.classList.remove('fade-out');
  box.classList.add('show');
  // 텍스트는 커서(span) 앞에 별도 텍스트노드로 삽입 — textContent 직접 덮어쓰면 커서 자식이 같이 지워지므로
  const textNode = document.createTextNode('');
  textEl.textContent = ''; // 기존 내용(이전 텍스트노드+커서) 정리
  textEl.appendChild(textNode);
  textEl.appendChild(cursorEl);
  cursorEl.style.display = '';
  hintEl.style.display = 'none';

  const FULL_TEXT = Array.isArray(lines) ? lines.join('\n') : lines;
  let charIdx = 0;
  let typingDone = false;
  const SPEED = 55; // ms/글자 — 사람이 편하게 읽을 수 있는 속도

  function finishTyping() {
    typingDone = true;
    textNode.textContent = FULL_TEXT;
    cursorEl.style.display = 'none';
    if (autoAdvance === 'timer') {
      // 최소 체류시간 보장 — 글자수 비례, 최소 1.3초 — 다급한 장면이라도 읽을 시간은 확보
      const minHoldMs = Math.max(1300, FULL_TEXT.length * 35);
      setTimeout(() => {
        // onDone() 안에서 새 showTutorialLine이 즉시 호출되면 토큰이 바뀜 — 그러면 이 텍스트는 더 이상 "현재 표시 중"이 아니므로 박스를 건드리지 않음
        if (_tutBoxToken === myToken) box.classList.add('fade-out'); // 부드럽게 사라짐 — 훅 끊기지 않게
        if (onDone) onDone();
        setTimeout(() => {
          if (_tutBoxToken === myToken) box.classList.remove('show', 'fade-out');
        }, 260);
      }, minHoldMs);
    } else if (autoAdvance === 'silent') {
      // 외부 입력(G키 등)으로만 다음 진행 — 힌트/Space 둘 다 비활성
      _tutAdvance = null;
    } else if (autoAdvance) {
      _tutAdvance = null;
      if (onDone) onDone();
    } else {
      hintEl.style.display = '';
      _tutAdvance = () => { _tutAdvance = null; if (onDone) onDone(); };
    }
  }

  function typeNext() {
    if (typingDone) return; // 이미 즉시완성됐다면 예약된 타이머는 더 진행하지 않음 (중복출력 방지)
    if (charIdx >= FULL_TEXT.length) { finishTyping(); return; }
    textNode.textContent += FULL_TEXT[charIdx++];
    setTimeout(typeNext, SPEED);
  }

  // 타이핑 중에는 Space로 스킵 불가 — 끝까지 자연스러운 속도로 출력됨
  // (완료 후 Space로 다음 진행하는 기능은 finishTyping() 내부에서 별도 설정)
  setTimeout(typeNext, 200);
}

function hideTutorialBox() {
  const box = document.getElementById('tutorial-box');
  if (box) box.classList.remove('show', 'fade-out');
}

// ── 튜토리얼 전용 화면 정중앙 Y/N 선택 오버레이 ───────────────────
function showTutChoiceCenter(yLabel, nLabel, subLabel) {
  const el = document.getElementById('tut-choice-center');
  if (!el) return;
  const yEl = document.getElementById('tcc-y-label');
  const nEl = document.getElementById('tcc-n-label');
  const subEl = document.getElementById('tut-choice-sub');
  if (yEl) yEl.textContent = yLabel;
  if (nEl) nEl.textContent = nLabel;
  if (subEl) subEl.textContent = subLabel || '';
  el.classList.add('show');
}
function hideTutChoiceCenter() {
  const el = document.getElementById('tut-choice-center');
  if (el) el.classList.remove('show');
}

// ── 이동 거리 체크 — 매 onStep마다 호출 (moving 단계에서만 동작) ──
function checkTutorialMoveProgress() {
  if (!TUT_ACTIVE) return;
  if (TUT_STEP === 'mine_collect' || TUT_STEP === 'mine_collect_2' || TUT_STEP === 'mine_collect_3') {
    hideTutorialBox(); // 회수 대기 중 이동 — 대화창이 화면을 가리지 않도록 즉시 숨김
    return;
  }
  if (TUT_STEP !== 'moving') return;
  hideTutorialBox(); // 이동 시작 — 대화창이 화면을 가리지 않도록 즉시 숨김
  if (player.tx >= TUT_SONAR_TRIGGER_TX) {
    TUT_STEP = 'sonar_prompt';
    TUT_LOCKED = true; // 이동 다시 차단
    showTutorialLine(TUT_SONAR_LINES, () => {
      // 타이핑 끝나면 자동으로 잠금 해제 — 대화창은 F 차징을 시작하는 순간 닫힘
      TUT_LOCKED = false;
    }, true); // autoAdvance
  }
}

// ── 소나 발사 후 처리 — fireSonar 내부에서 튜토리얼이면 호출 ──────
function onTutorialSonarFired() {
  if (!TUT_ACTIVE) return;
  if (TUT_STEP === 'sonar_prompt') {
    TUT_STEP = 'sonar_result';
    TUT_LOCKED = true; // 이동 다시 차단 — 핑을 관찰하게 함
    setTimeout(() => {
      showTutorialLine(TUT_SONAR_RESULT_LINES, () => {
        TUT_STEP = 'mine_collect';
        TUT_LOCKED = false; // 타이핑 끝나면 자동으로 이동 가능
      }, true); // autoAdvance — Space 불필요, 힌트도 안 뜸
    }, 1200);
    return;
  }
  if (TUT_STEP === 'sonar_prompt_2') {
    TUT_STEP = 'sonar_result_2';
    TUT_LOCKED = true; // 이동 다시 차단 — 핑을 관찰하게 함
    setTimeout(() => {
      showTutorialLine(TUT_SONAR2_RESULT_LINES, () => {
        TUT_STEP = 'mine_collect_3';
        TUT_LOCKED = false; // 타이핑 끝나면 자동으로 이동 가능
      }, true); // autoAdvance
    }, 1200);
    return;
  }
}

// ── 회수 미니게임 시작 시 호출 — 3번째 병원체(C) 회수 시작이 좀비 습격 트리거 ──
function onTutorialMineCollectStart(mineTileIdx) {
  if (!TUT_ACTIVE || TUT_STEP !== 'mine_collect_3') return;
  const mineCIdx = TUT_MINE_C_TY * MAP.width + TUT_MINE_C_TX;
  if (mineTileIdx !== mineCIdx) return; // C가 아니면(이론상 발생 안 함) 무시
  TUT_STEP = 'ambush';
  spawnTutorialAmbushZombie();
}

// ── 튜토리얼 전용 습격 좀비 스폰 — 처음부터 CHASE 상태로 플레이어에게 직진 ──
function spawnTutorialAmbushZombie() {
  const ts = CONFIG.map.tileSize;
  const spawnTx = TUT_MINE_C_TX, spawnTy = TUT_AMBUSH_SPAWN_TY; // 멀리서 — 화면을 가로질러 달려오게
  const z = makeZombieObj(spawnTx, spawnTy, ts, 'BASIC', 'CREATURE');
  z.state = 'CHASE';
  z.hasTarget = true;
  z.targetWx = player.px + ts / 2;
  z.targetWy = player.py + ts / 2;
  z.memoryTimer = 999; // 튜토리얼 한 장면용 — 기억 소멸로 풀릴 일 없게
  z.tutBoost = 2.4;    // 급속 접근 — 본게임 좀비는 영향 없음(기본값 1)
  zombies.push(z);
  SoundManager.playZombieChase();
}

// ── 전투 미니게임 시작 시 호출 — 습격 직후 코드레드 보고 ──────────
function onTutorialCombatStart() {
  if (!TUT_ACTIVE || TUT_STEP !== 'ambush') return;
  TUT_FORCE_MASH_SHOWN = false;
  showTutorialLine(TUT_AMBUSH_LINES, () => {
    // 치료제 보유 여부에 따라 분기된 후속 대사
    const lines = player.serum > 0 ? TUT_AMBUSH_HASSERUM_LINES : TUT_AMBUSH_NOSERUM_LINES;
    showTutorialLine(lines, null, 'timer');
  }, 'timer'); // 시간기반 자동진행 — 다급함을 끊지 않음
}

// ── 습격 전투 종료 후 — 화이트플래시 → 정적 → 강한 비네팅 → 거친숨+G키 안내 → (G키 입력) → 좀비노출 → 제기랄 → 암전 → 비명 → 타이틀 ──
function onTutorialAmbushResolved() {
  if (!TUT_ACTIVE || TUT_STEP !== 'ambush') return;
  TUT_STEP = 'aftermath';
  TUT_LOCKED = true;

  triggerOriginFlash(); // 기존 화이트플래시 100% 재사용

  // 화이트플래시(약 0.55초) 끝난 뒤 짧은 정적(1.5초, 텍스트 없음) → 비네팅 강한 수렴
  setTimeout(() => {
    if (!TUT_ACTIVE || TUT_STEP !== 'aftermath') return; // 그 사이 상태가 바뀌었으면(강제 초기화 등) 중단
    collapseVignetteTo('aftermath', 2200, 0.30, () => {
      // 펄스 유지 상태로 — updateTutorialVignette가 이후 자동으로 0.15~0.35 사이 숨쉬듯 유지
    });
    setTimeout(() => {
      if (!TUT_ACTIVE || TUT_STEP !== 'aftermath') return; // 동일 가드 — 늦게 실행되는 경우 방지
      TUT_STEP = 'precise_prompt';
      TUT_LOCKED = false; // G키 입력을 받기 위해 잠금 해제 (이동은 별도 가드로 차단됨)
      TUT_PRECISE_READY = false; // 타이핑 끝나기 전엔 G키 무시 — 너무 빨리 지나가는 문제 방지
      showTutorialLine(TUT_PRECISE_LINES, () => { TUT_PRECISE_READY = true; }, true);
    }, 2600);
  }, 700);
}

// ── 정밀소나용 좀비 스폰 — WALL 타일을 피해 안전한 FLOOR에 배치, AI 동결 상태로 대기 ──
function spawnTutorialPreciseZombies() {
  const ts = CONFIG.map.tileSize;
  TUT_FREEZE_ZOMBIES = true; // 다가오지 않도록 AI 동결
  const count = 6;
  let placed = 0, attempts = 0;
  while (placed < count && attempts < 60) {
    attempts++;
    const ang = Math.random() * Math.PI * 2;
    const dist = 1.2 + Math.random() * 1.8;
    const ztx = Math.round(player.tx + Math.cos(ang) * dist);
    const zty = Math.round(player.ty + Math.sin(ang) * dist);
    if (ztx < 0 || zty < 0 || ztx >= MAP.width || zty >= MAP.height) continue;
    if (MAP.tiles[zty * MAP.width + ztx] === T.WALL) continue; // 벽 회피 — 화면에 안 보이는 문제 방지
    const z = makeZombieObj(ztx, zty, ts, 'BASIC', 'CREATURE');
    z.state = 'WANDER';
    zombies.push(z);
    placed++;
  }
}

// ── 정밀소나 발사 직후 호출 — fireSonar 내부에서 튜토리얼 precise_prompt 단계면 호출 ──
function onTutorialPreciseFired() {
  if (!TUT_ACTIVE || TUT_STEP !== 'precise_prompt') return;
  TUT_STEP = 'precise_revealed';
  TUT_LOCKED = true;
  // 좀비를 발사 직후에 스폰 — G키를 누르는 순간 드러나는 느낌, VISIBLE 잔존으로 미리 보이는 문제도 방지
  spawnTutorialPreciseZombies();
  revealAround(player.tx, player.ty, 6); // 좀비들이 보이도록 시야 확보
  // 비네팅 해제를 핑 확산 진행률(sonar.pulseR/pulseMaxR)에 직접 연동
  // — 정밀소나가 퍼지는 것과 정확히 같은 속도로 시야가 풀림
  TUT_VIGNETTE.active = true;
  TUT_VIGNETTE.mode = 'precise_release';

  setTimeout(() => {
    if (!TUT_ACTIVE || TUT_STEP !== 'precise_revealed') return; // 그 사이 상태가 바뀌었으면 중단
    showTutorialLine(TUT_DESPAIR_LINES, () => {
      onTutorialFinalBlackout();
    }, 'timer'); // 시간기반 자동진행
  }, 1300);
}

// ── 최종 암전 → 비명 → 타이틀 복귀 ──────────────────────────────
function onTutorialFinalBlackout() {
  const overlay = document.getElementById('origin-flash');
  if (overlay) {
    overlay.style.transition = 'opacity 0.8s ease';
    overlay.style.backgroundColor = '#000000';
    overlay.style.opacity = '1';
  }
  SoundManager.play('gameover_infected'); // 비명류 사운드 — 기존 자원 재사용
  setTimeout(() => {
    TUT_ACTIVE = false;
    TUT_VIGNETTE.active = false;
    TUT_FREEZE_ZOMBIES = false;
    hideTutorialBox();
    goToLobbyFromTutorial();
    if (overlay) { overlay.style.transition = 'none'; overlay.style.opacity = '0'; }
  }, 1600);
}

// ── 치료제 선택 시퀀스 — 2번째 회수 완료 직후 트리거 ──────────────
function onTutorialSerumPromptStart() {
  TUT_STEP = 'serum_prompt';
  TUT_LOCKED = true;
  showTutorialLine(TUT_SERUM_PROMPT_LINES, () => {
    TUT_SERUM_PROMPT_TIMER = 5.0; // 5초 내 미선택 시 자동 N 처리(update 루프에서 감소)
    TUT_SERUM_PROMPT_ACTIVE = true;
    // 대화창은 그대로 유지 — 화면 정중앙에 Y/N 오버레이를 별도로 띄워서 안 겹치게 함 (PC/모바일 공용)
    showTutChoiceCenter('사용한다', '아껴둔다');
    if (window._updateTouchUI) window._updateTouchUI();
  }, true); // 타이핑이 끝나면 별도 Space 확인 없이 즉시 Y/N 선택 가능 — 5초 타임아웃도 이 시점부터 시작
}

// Y(true)/N(false) 선택 처리 — 사용자 입력 또는 타임아웃에서 호출
function onTutorialSerumChoice(useIt) {
  if (!TUT_ACTIVE || TUT_STEP !== 'serum_prompt' || !TUT_SERUM_PROMPT_ACTIVE) return; // 이미 선택 완료된 후 재입력(중복 호출) 방지
  TUT_SERUM_PROMPT_TIMER = 0;
  TUT_SERUM_PROMPT_ACTIVE = false; // 선택 즉시 닫힘 — 이후 후속 대사 중엔 TUT_STEP이 같아도 버튼이 다시 뜨지 않음
  hideTutChoiceCenter();
  if (window._updateTouchUI) window._updateTouchUI();
  if (useIt) {
    TUT_STEP = 'serum_use_wait';
    showTutorialLine(TUT_SERUM_USE_LINES, null, 'silent'); // D키로만 진행
  } else {
    showTutorialLine(TUT_SERUM_HOLD_LINES, () => {
      onTutorialSerumSequenceDone();
    }, 'timer'); // 시간기반 자동진행 — 짧은 독백, Space 불필요
  }
}

// D키로 실제 치료제 사용 확정
function onTutorialSerumUseConfirmed() {
  if (!TUT_ACTIVE || TUT_STEP !== 'serum_use_wait') return;
  useSerumSelf(); // 기존 자가 치료제 함수 재사용 — 오염도 감소가 실제로 적용됨
  onTutorialSerumSequenceDone();
}

// 선택 시퀀스 종료 — 다음 회수 단계로
function onTutorialSerumSequenceDone() {
  showTutorialLine(TUT_SERUM_DONE_LINES, () => {
    TUT_STEP = 'sonar_prompt_2';
    showTutorialLine(TUT_SONAR2_LINES, () => {
      TUT_LOCKED = false; // 타이핑 끝나면 F차징 가능 (대화창은 F 차징 시작 시 닫힘)
    }, true); // autoAdvance
  }, true); // autoAdvance — 타이핑 끝나면 바로 다음 안내로
}

function onTutorialMineCollected() {
  if (!TUT_ACTIVE) return;
  if (TUT_STEP === 'mine_collect') {
    // 1번째 회수 완료 — 2번째로 유도
    TUT_STEP = 'mine_collect_2';
    return;
  }
  if (TUT_STEP === 'mine_collect_2') {
    // 2번째 회수 완료 — 회수 결과표시(약 1초)가 끝난 뒤 치료제 선택 시퀀스로 진입
    TUT_LOCKED = true; // 결과표시 동안 다른 입력 방지
    setTimeout(() => { onTutorialSerumPromptStart(); }, 1050);
    return;
  }
  if (TUT_STEP === 'ambush') {
    // 3번째(C) 회수를 좀비에게 안 걸리고 끝까지 마친 경우 — 회수 자체는 성공이지만
    // 습격 시퀀스(전투→화이트플래시→비네팅→정밀소나→암전)는 별도 트리거(zombieContact)로 진행되므로 여기선 아무 처리도 안 함
    return;
  }
  TUT_STEP = 'done';
  TUT_LOCKED = true;
  setTimeout(() => {
    TUT_ACTIVE = false;
    hideTutorialBox();
    goToLobbyFromTutorial();
  }, 1400);
}

function goToLobbyFromTutorial() {
  // UNIT-00 튜토리얼 완주(= 감염사 처리) — 전사자 풀에 정식 등록 후 유닛을 1로 올리고 타이틀로 복귀
  // cause:'lost' — 1스테이지에서 실제로 조우하기 전까지의 임시 사유. 조우 이후 updateFallenCause(0, '실제사유')로 교체할 것
  addToFallenPool(0, 1, 'lost');
  devLog('UNIT-00 전사자 풀 등록 [튜토리얼 완주 — 사유: lost]', 'warn');
  incrementUnit();
  showTitle();
}

function startGame() {
  ['title-screen','lobby-screen'].forEach(id =>
    document.getElementById(id)?.classList.remove('show'));
  advanceUnitIfNeeded();
  player.stage          = 0;
  player.oxygen         = CONFIG.oxygen.max;
  player.infection      = 0;
  player.totalCollected = 0;
  player.recordSaved    = false;
  player.serum          = CONFIG.serum.initialCount; // 치료제 초기화
  applyUpgradeEffects();
  player.oxygen = CONFIG.oxygen.max;
  SoundManager.crossfadeBGM('bgm_stage12');
  init();
}

// ── 스테이지 인트로 ──────────────────────────────────────────────
function showStageIntro() {
  GAME_STATE = 'INTRO';
  const s = Math.min(player.stage, CONFIG.stages.length - 1);
  const st = CONFIG.stages[s];
  document.getElementById('intro-stage').textContent    = `STAGE ${s + 1}`;
  document.getElementById('intro-location').textContent = st.name || '';
  document.getElementById('intro-mines').textContent    = `병원체 ${st.mineCount}개`;
  document.getElementById('intro-zombies').textContent  = `좀비 ${st.zombieCount}마리`;
  document.getElementById('intro-capsules').textContent = `산소 캡슐 ${st.capsuleCount}개`;
  document.getElementById('stage-intro').classList.add('show');
}

// ── 패트롤 강화 체크 (고정 개수 기반) ──────────────────────────
function checkPatrolPhase() {
  const stageIdx = Math.min(player.stage, CONFIG.stages.length - 1);
  const st       = CONFIG.stages[stageIdx];
  const thr      = st.patrolThresholds; // [1단계, 2단계, 3단계] 제거 개수
  let remaining  = 0;
  for (let i = 0; i < MAP.tiles.length; i++) if (MAP.tiles[i] === T.MINE) remaining++;
  const removed  = st.mineCount - remaining;

  // 1단계 — 좀비 extraSpawn체 추가 스폰
  if (removed >= thr[0] && patrol.phase < 1) {
    patrol.phase = 1;
    for (let i = 0; i < (st.extraSpawn || 1); i++) spawnExtraZombie();
    devLog(`⚠ 패트롤 1단계 [${removed}개 제거] — 좀비 ${st.extraSpawn || 1}체 증원`, 'warn');
    triggerFlash('red');
    setTimeout(() => SoundManager.play('patrol_phase1'), 200);
    setTimeout(() => addNotice('⚠ PATROL LV.1 — 좀비 증원', '#ff8800', 3.0), 200);
  }
  // 2단계 — 이동속도 +20%
  if (removed >= thr[1] && patrol.phase < 2) {
    patrol.phase     = 2;
    patrol.speedMult = 1.2;
    devLog(`⚠ 패트롤 2단계 [${removed}개 제거] — 이동속도 ×1.2`, 'warn');
    triggerFlash('red');
    setTimeout(() => SoundManager.play('patrol_phase2'), 200);
    setTimeout(() => addNotice('⚠ PATROL LV.2 — 이동속도 상승', '#ff6600', 3.0), 200);
  }
  // 3단계 — 이동속도 +40%, 시야각 120도
  if (removed >= thr[2] && patrol.phase < 3) {
    patrol.phase     = 3;
    patrol.speedMult = 1.4;
    patrol.fovMult   = 120 / CONFIG.zombie.fovAngle;
    devLog(`🔴 패트롤 3단계 [${removed}개 제거] — 속도 ×1.4, 시야 확대`, 'danger');
    triggerFlash('red');
    setTimeout(() => SoundManager.play('patrol_phase3'), 200);
    setTimeout(() => addNotice('🔴 PATROL LV.3 — 시야 확대', '#ff3333', 3.0), 200);
  }
}

// GUARD 홈 포인트 일괄 갱신 (병원체 회수 후 호출)
function updateGuardHomePoints() {
  const { tiles, width, height } = MAP;
  for (const z of zombies) {
    if (z.type !== 'GUARD') continue;
    if (tiles[z.homeTy * width + z.homeTx] === T.MINE) continue; // 아직 유효
    let bestDist = Infinity;
    for (let my = 0; my < height; my++) for (let mx = 0; mx < width; mx++) {
      if (tiles[my * width + mx] !== T.MINE) continue;
      const d = Math.hypot(mx - z.tx, my - z.ty);
      if (d < bestDist) { bestDist = d; z.homeTx = mx; z.homeTy = my; }
    }
  }
}

// ── 크리쳐 워프 이탈 ────────────────────────────────────────────
// 전투 승리 시 크리쳐를 맵 반대편으로 워프시킴 (ORIGIN 회수 연출)
function warpZombie(z) {
  const { tiles, width, height } = MAP;
  const ts   = CONFIG.map.tileSize;
  const minD = CONFIG.zombie.spawnDist + 3;

  const candidates = [];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (tiles[y * width + x] !== T.FLOOR) continue;
    if (Math.hypot(x - player.tx, y - player.ty) < minD) continue;
    candidates.push([x, y]);
  }
  if (candidates.length === 0) {
    z.stunTimer = 1.8;
    z.state     = 'WANDER';
    z.hasTarget = false;
    return;
  }

  const dest = candidates[Math.floor(Math.random() * candidates.length)];

  // ① 워프 아웃 이펙트 (현재 위치에서 수축)
  addZombieFX('warp', z.px + ts / 2, z.py + ts / 2, '#bb44ff');

  // ② 이펙트 재생 중 본체 숨김 — drawZombie가 스킵
  z.hidden    = true;
  z.state     = 'WANDER';
  z.hasTarget = false;

  // ③ 이펙트 종료 후 실제 이동 + 재출현
  const WARP_DELAY = 620;
  setTimeout(() => {
    if (!zombies.includes(z)) return;

    z.px = dest[0] * ts;
    z.py = dest[1] * ts;
    z.tx = dest[0];
    z.ty = dest[1];

    addZombieFX('warpIn', z.px + ts / 2, z.py + ts / 2, '#bb44ff');

    z.hidden    = false;
    z.stunTimer = 1.8;
    z.state     = 'WANDER';
    z.hasTarget = false;

    devLog(`크리쳐 워프 완료 → (${dest[0]},${dest[1]}) [ORIGIN 회수]`, 'warn');
  }, WARP_DELAY);

  // 사운드 슬롯 — mp3 추가 후 주석 해제
  // const laughChance = 0.3 + (player.stage / CONFIG.stages.length) * 0.5;
  // if (Math.random() < laughChance) SoundManager.play('origin_laugh');

  // ORIGIN 암전 연출 (층별 확률, 층당 1회)
  triggerOriginFlash();

  devLog('크리쳐 워프 시작 — 이펙트 재생 중', 'warn');
}

// ── 감염자 소멸 처리 ─────────────────────────────────────────────
// 치료제 없이 전투 승리 시 — "싸워서 보낸 것"
function dissolveInfected(z) {
  const ts = CONFIG.map.tileSize;
  const unitLabel = z.fallenUnit != null
    ? `UNIT-${String(z.fallenUnit).padStart(2, '0')}`
    : null;

  // 소멸 중 접촉 판정 차단
  z.dissolving = true;

  // 소멸 이펙트
  addZombieFX('dissolve', z.px + ts / 2, z.py + ts / 2, '#aa66cc', unitLabel);

  // 전사자 풀 청소
  if (z.fallenUnit != null) {
    const cleaned = removeFromFallenPool(z.fallenUnit);
    if (cleaned) devLog(`${unitLabel} — 전투로 보냄, 전사자 풀 제거`, 'good');
    logUnitAction(z.fallenUnit, 'dissolved', player.stage + 1);
  }

  // 좀비 배열에서 제거
  const idx = zombies.indexOf(z);
  if (idx !== -1) zombies.splice(idx, 1);

  // 좀비 수 유지 — 크리쳐로 대체 스폰 (ORIGIN이 보충)
  // 소멸 이펙트가 끝날 즈음 등장하는 느낌으로 약간 딜레이
  setTimeout(() => spawnExtraZombie(true), 800);

  devLog('감염자 소멸 — 크리쳐로 대체 스폰 예약', 'warn');
}

function spawnExtraZombie(forceCreature = false) {
  const { tiles, width, height } = MAP;
  const ts   = CONFIG.map.tileSize;
  const minD = CONFIG.zombie.spawnDist;
  const candidates = [];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (tiles[y * width + x] !== T.FLOOR) continue;
    if (Math.hypot(x - player.tx, y - player.ty) < minD) continue;
    candidates.push([x, y]);
  }
  if (candidates.length === 0) return;
  const pick = candidates[Math.floor(Math.random() * candidates.length)];

  // forceCreature = true면 무조건 크리쳐 (치료제 크리쳐 사용 시)
  let faction = 'CREATURE';
  let fallenUnit = null;
  if (!forceCreature) {
    const pool      = loadFallenPool();
    const stageIdx  = Math.min(player.stage, CONFIG.stages.length - 1);
    const stagePool = pool.filter(f => f.stage <= stageIdx + 1);
    if (stagePool.length > 0) {
      const pick2 = stagePool[Math.floor(Math.random() * stagePool.length)];
      faction     = 'INFECTED';
      fallenUnit  = pick2.unit;
    }
  }

  const ez = makeZombieObj(pick[0], pick[1], ts, 'BASIC', faction);
  ez.state       = 'SEARCH';
  ez.targetWx    = player.px + ts / 2;
  ez.targetWy    = player.py + ts / 2;
  ez.hasTarget   = true;
  ez.wanderTimer = 0;
  ez.memoryTimer = CONFIG.zombie.chaseMemory;
  if (fallenUnit !== null) ez.fallenUnit = fallenUnit;
  zombies.push(ez);
  SoundManager.play('zombie_spawn');
  devLog(`증원 좀비 스폰 [${faction}${fallenUnit !== null ? ' UNIT-'+String(fallenUnit).padStart(2,'0') : ''}] @ (${pick[0]},${pick[1]})`, 'warn');
}

// ── 소나 ─────────────────────────────────────────────────────────
function fireSonar(isPrecise) {
  const cfg = CONFIG.sonar;
  const chargeTime = TUT_ACTIVE ? cfg.maxCharge : (isPrecise ? sonar.chargeTimePrecise : sonar.chargeTime);
  const ratio  = Math.min(chargeTime, cfg.maxCharge) / cfg.maxCharge;
  const radius = Math.round(cfg.minRadius + (cfg.maxRadius - cfg.minRadius) * ratio);
  const ts = CONFIG.map.tileSize;

  if (isPrecise) { sonar.chargingPrecise = false; sonar.chargeTimePrecise = 0; sonar.precise--; }
  else           { sonar.charging = false; sonar.chargeTime = 0; }

  if (!isPrecise) onTutorialSonarFired();
  if (isPrecise) onTutorialPreciseFired();

  // 사운드
  SoundManager.play(isPrecise ? 'sonar_precise' : 'sonar_fire');

  // 소나 발동 소음 — 소나 반경 그대로 전달 (파동 도달 기반)
  const noiseWx = player.px + ts / 2, noiseWy = player.py + ts / 2;
  triggerNoise(noiseWx, noiseWy, radius, 'sonar');

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
      // 병원체 인접 타일 핑 + 탐지 플래그
      if (tile === T.MINE) {
        MAP.detected[ny * width + nx] = 1; // 탐지됨
      } else {
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
      if (tile === T.MINE) {
        MAP.detected[ny * width + nx] = 1; // 정밀 탐지
        newMarks.push({ tx:nx, ty:ny, dist, kind:'mine', lit:false, alpha:0, timer:cfg.pingDuration * 1.5 });
      }
    }
    // 정밀 소나: 좀비 위치 눈 표시 + 진영 식별
    for (const z of zombies) {
      const zdx = z.tx - player.tx, zdy = z.ty - player.ty;
      if (Math.hypot(zdx, zdy) > radius + 0.5) continue;
      const dist = Math.hypot(zdx, zdy) * ts;
      const existing = newMarks.find(m => m.tx === z.tx && m.ty === z.ty);
      z.identified = true; // 정밀 소나로만 식별
      if (!existing)
        newMarks.push({
          tx: z.tx, ty: z.ty, dist,
          kind: 'zombie',
          faction: z.faction,
          fallenUnit: z.fallenUnit ?? null,
          lit: false, alpha: 0,
          timer: cfg.pingDuration * 1.5
        });
    }
  }

  sonar.pings        = [...sonar.pings.filter(p => p.alpha > 0), ...newPings];
  sonar.preciseMarks = [...sonar.preciseMarks.filter(m => m.alpha > 0), ...newMarks];

  // 위험 핑 감지 시 틱음 — 최고 위험도 기반 (기본 소나만, 핑이 있을 때)
  if (!isPrecise && newPings.length > 0) {
    const maxDanger = newPings.reduce((m, p) => Math.max(m, p.danger), 0);
    if (maxDanger > 0) SoundManager.play('sonar_ping_hit');
  }

  // 소나 발동 후 — 플레이어가 현재 서 있는 타일이 병원체면 자동 탐지
  const curIdx = player.ty * MAP.width + player.tx;
  if (MAP.tiles[curIdx] === T.MINE) {
    MAP.detected[curIdx] = 1;
    devLog('현재 위치 병원체 탐지 — [E] 회수 가능', 'good');
  }
}

function updateSonar(dt) {
  const cfg = CONFIG.sonar;
  if (sonar.charging) {
    sonar.chargeTime = Math.min(sonar.chargeTime + dt, cfg.maxCharge);
  }
  if (sonar.chargingPrecise) {
    sonar.chargeTimePrecise = Math.min(sonar.chargeTimePrecise + dt, cfg.maxCharge);
  }
  if (sonar.radarTimer > 0)  sonar.radarTimer = Math.max(0, sonar.radarTimer - dt);

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
function makeZombieObj(tx, ty, ts, type, faction) {
  return {
    tx, ty,
    px: tx * ts, py: ty * ts,
    type: type || 'BASIC',
    faction: faction || 'CREATURE',  // 'CREATURE' | 'INFECTED'
    identified: false,               // 정밀 소나로 식별됐는지
    state: 'WANDER',
    facingAngle: Math.random() * Math.PI * 2,
    targetWx: 0, targetWy: 0,
    hasTarget: false,
    wanderTimer: Math.random() * 2,
    memoryTimer: 0,
    stunTimer:   0,
    homeTx: tx, homeTy: ty,
  };
}

function spawnZombies() {
  zombies = [];
  const { tiles, width, height } = MAP;
  const ts    = CONFIG.map.tileSize;
  const sIdx  = Math.min(player.stage, CONFIG.stages.length - 1);
  const comp  = CONFIG.zombieComposition[sIdx];
  const minD  = CONFIG.zombie.spawnDist;

  // 스폰 후보 풀 — 바닥 타일, 스폰 거리 이상
  const pool = [];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (tiles[y * width + x] !== T.FLOOR) continue;
    if (Math.hypot(x - 1, y - 1) < minD) continue;
    pool.push({ x, y, d: Math.hypot(x - 1, y - 1) });
  }
  pool.sort((a, b) => a.d - b.d);

  // 전체 스폰 수 계산 후 구간 분산
  const totalCount = comp.reduce((s, g) => s + g.count, 0);
  const used = [];
  const zoneSize = Math.floor(pool.length / Math.max(totalCount, 1));

  let idx = 0;
  for (const group of comp) {
    for (let i = 0; i < group.count; i++) {
      const zStart = idx * zoneSize;
      const zEnd   = idx === totalCount - 1 ? pool.length : (idx + 1) * zoneSize;
      const zone   = pool.slice(zStart, zEnd).filter(c => !used.find(u => u.x === c.x && u.y === c.y));
      if (zone.length === 0) { idx++; continue; }
      const pick = zone[Math.floor(Math.random() * zone.length)];
      used.push(pick);
      zombies.push(makeZombieObj(pick.x, pick.y, ts, group.type));
      idx++;
    }
  }
  // GUARD 홈 포인트 — 가장 가까운 병원체 타일로 설정
  const { tiles: mt, width: mw, height: mh } = MAP;
  for (const z of zombies) {
    if (z.type !== 'GUARD') continue;
    let bestDist = Infinity, bestTx = z.tx, bestTy = z.ty;
    for (let my = 0; my < mh; my++) for (let mx = 0; mx < mw; mx++) {
      if (mt[my * mw + mx] !== T.MINE) continue;
      const d = Math.hypot(mx - z.tx, my - z.ty);
      if (d < bestDist) { bestDist = d; bestTx = mx; bestTy = my; }
    }
    z.homeTx = bestTx; z.homeTy = bestTy;
  }
  devLog(`좀비 스폰: ${zombies.map(z=>z.type).join(', ')}`, '');
}

// ════════════════════════════════════════════════════════════════
//  좀비 시스템 (재설계) — 단일 책임 구조
//  원칙: ① 상태 전환은 zombieSense 한 곳 ② 이동은 BFS방향+픽셀
//        ③ 끼임은 충돌단계 슬라이딩으로만 (상태 안 건드림)
// ════════════════════════════════════════════════════════════════

// 좀비 충돌 반경 (렌더링과 일치)
const ZOMBIE_RADIUS = 0.40;   // 타일 비율

function updateZombies(dt) {
  if (player.dead) return;
  const ts  = CONFIG.map.tileSize;
  const pcx = player.px + ts / 2;
  const pcy = player.py + ts / 2;


  for (const z of zombies) {
    // 워프 이펙트 재생 중 — AI/이동/접촉 전부 스킵
    if (z.hidden) continue;

    // 스턴 처리 — 이동/감지/접촉 전부 스킵
    if (z.stunTimer > 0) {
      z.stunTimer = Math.max(0, z.stunTimer - dt);
      continue;
    }

    // 타입별 파라미터 적용
    const zt  = CONFIG.zombieTypes[z.type] || CONFIG.zombieTypes.BASIC;
    const boost = z.tutBoost || 1; // 튜토리얼 전용 급속접근 배율 (본게임 좀비는 기본 1, 영향 없음)
    const spd = (ts / CONFIG.player.moveDelay) * zt.speed * patrol.speedMult * dt * boost;
    // RUSHER: CHASE 중엔 rushSpeed 사용
    const chaseSpd = zt.rushSpeed
      ? (ts / CONFIG.player.moveDelay) * zt.rushSpeed * patrol.speedMult * dt * boost
      : spd;

    const c = {
      dt, ts, pcx, pcy,
      spd:        spd,
      chaseSpd:   chaseSpd,
      wSpd:       spd * 0.5,
      fovHalf:    (zt.fovAngle * patrol.fovMult / 2) * Math.PI / 180,
      sightTiles: zt.fovRange,
      chaseMemory:zt.chaseMemory,
      r:          ts * ZOMBIE_RADIUS,
    };

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
// sourceType: 'sonar'(소나 파동) | 'noise'(일반 소음)
// radiusTiles: 소나 반경 or 일반 소음 반경
function triggerNoise(sourceX, sourceY, radiusTiles, sourceType) {
  devNoiseMarker = { wx: sourceX, wy: sourceY, timer: 3.0, r: radiusTiles };
  const ts = CONFIG.map.tileSize;
  const isSonar = (sourceType === 'sonar');

  // 소음 파동 생성 — 소나가 아닌 소음만 (소나는 자체 파동 있음)
  if (!isSonar) {
    noisePulses.push({
      wx: sourceX, wy: sourceY,
      r: 0,
      maxR: radiusTiles * ts,
      color: '#ff6600', // 주황 — 일반 소음
    });
  }

  for (const z of zombies) {
    if (z.state === 'CHASE') continue; // 추격 중엔 소음 무시
    const zcx = z.px + ts / 2, zcy = z.py + ts / 2;
    const distToSource = Math.hypot(sourceX - zcx, sourceY - zcy) / ts;
    const zt = CONFIG.zombieTypes[z.type] || CONFIG.zombieTypes.BASIC;

    let reacts = false;
    if (isSonar) {
      // 소나: 파동이 좀비 몸체 or 센서의 감지 원에 닿으면 반응
      reacts = distToSource <= radiusTiles + (zt.sensorRange || 0);
    } else {
      // 일반 소음: 반경 안에 있으면 반응 (모든 타입 동일)
      reacts = distToSource <= radiusTiles;
    }
    if (!reacts) continue;

    z.targetWx    = sourceX;
    z.targetWy    = sourceY;
    z.hasTarget   = true;
    z.state       = 'SEARCH';
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
    // 플레이어 직접 인지 → CHASE
    const wasChase = z.state === 'CHASE';
    z.state = 'CHASE';
    z.targetWx = c.pcx;
    z.targetWy = c.pcy;
    z.hasTarget = true;
    z.memoryTimer = c.chaseMemory;
    // 새로 CHASE 진입 시만 효과음
    if (!wasChase) SoundManager.playZombieChase();
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
      // CHASE면 플레이어와 겹친 것 → 직선으로 밀착 (RUSHER는 chaseSpd)
      const a = Math.atan2(c.pcy - zcy, c.pcx - zcx);
      const mv = z.state === 'CHASE' ? c.chaseSpd : c.spd;
      mvx = Math.cos(a) * mv;
      mvy = Math.sin(a) * mv;
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
      // RUSHER: 추격 중 빠른 속도 적용 (chaseSpd)
      const sp = z.state === 'CHASE' ? c.chaseSpd : c.spd * 0.85;
      mvx = Math.cos(a) * sp;
      mvy = Math.sin(a) * sp;
    }
  }

  zombieMoveWithSlide(z, c, mvx, mvy);
}

// 배회 이동 벡터
function zombieWanderVec(z, c) {
  // GUARD: 홈 포인트(병원체) 기준 범위 제한 배회
  if (z.type === 'GUARD') {
    return zombieGuardPatrolVec(z, c);
  }

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

// GUARD 순찰 벡터 — 홈 기준 2~5타일 범위 유지
const GUARD_MIN_DIST = 2; // 최소 거리 (너무 붙으면 밀려남)
const GUARD_MAX_DIST = 5; // 최대 거리 (벗어나면 복귀)

function zombieGuardPatrolVec(z, c) {
  // 홈 포인트가 제거된 병원체면 다음 병원체로 갱신
  const { tiles, width, height } = MAP;
  if (tiles[z.homeTy * width + z.homeTx] !== T.MINE) {
    let bestDist = Infinity;
    for (let my = 0; my < height; my++) for (let mx = 0; mx < width; mx++) {
      if (tiles[my * width + mx] !== T.MINE) continue;
      const d = Math.hypot(mx - z.tx, my - z.ty);
      if (d < bestDist) { bestDist = d; z.homeTx = mx; z.homeTy = my; }
    }
    // 병원체 없으면 일반 배회
    if (bestDist === Infinity) {
      z.wanderTimer -= c.dt;
      return [Math.cos(z.facingAngle) * c.wSpd, Math.sin(z.facingAngle) * c.wSpd];
    }
  }

  const distHome = Math.hypot(z.tx - z.homeTx, z.ty - z.homeTy);

  // 너무 가까움 → 홈에서 멀어지는 방향
  if (distHome < GUARD_MIN_DIST) {
    const a = Math.atan2(z.ty - z.homeTy, z.tx - z.homeTx); // 홈 반대 방향
    z.facingAngle = a;
    return [Math.cos(a) * c.wSpd, Math.sin(a) * c.wSpd];
  }

  // 너무 멀음 → BFS로 홈 복귀
  if (distHome > GUARD_MAX_DIST) {
    const next = zombieNextStepDir(z.tx, z.ty, z.homeTx, z.homeTy);
    if (next) {
      const a = Math.atan2(next[1] * c.ts + c.ts/2 - (z.py + c.ts/2),
                           next[0] * c.ts + c.ts/2 - (z.px + c.ts/2));
      z.facingAngle = a;
      return [Math.cos(a) * c.wSpd, Math.sin(a) * c.wSpd];
    }
  }

  // 적정 범위 → 일반 배회
  z.wanderTimer -= c.dt;
  if (z.wanderTimer <= 0) {
    const dirs = shuffle([...DIR4]);
    for (const [dx, dy] of dirs) {
      const nx = z.tx + dx, ny = z.ty + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      if (tiles[ny * width + nx] === T.WALL) continue;
      // 홈 범위 벗어나는 방향은 제외
      const newDist = Math.hypot(nx - z.homeTx, ny - z.homeTy);
      if (newDist > GUARD_MAX_DIST) continue;
      z.facingAngle = Math.atan2(dy, dx);
      z.wanderTimer = 1.2 + Math.random() * 1.5;
      break;
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
  if (z.stunTimer > 0) return;                     // 스턴 중인 좀비는 접촉 없음
  if (z.hidden) return;                             // 워프/소멸 이펙트 중 접촉 없음
  if (z.dissolving) return;                         // 소멸 대기 중 접촉 없음
  if (minigame.postCooldown > 0) return;          // 무적 쿨타임 중
  if (minigame.active && minigame.type === 'combat') return; // 전투 중 중복 차단
  // 출구 처리 중이거나 탈출/게임오버 상태면 전투 차단
  if (GAME_STATE === 'ESCAPED' || GAME_STATE === 'GAMEOVER') return;
  const curTile = MAP.tiles[player.ty * MAP.width + player.tx];
  if (curTile === T.EXIT) return; // 출구 타일 위에 있을 때 전투 차단
  const dist = Math.hypot(zcx - c.pcx, zcy - c.pcy);
  if (dist < c.ts * 0.6) {
    if (!devInvincible) {
      const interrupted = minigame.active && minigame.type === 'mine';
      startMinigame('combat', -1, z, interrupted);
    } else {
      triggerFlash('red');
    }
  }
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
  // PLAYING 상태일 때만 게임 로직 실행
  if (GAME_STATE !== 'PLAYING') return;
  if (!TUT_FREEZE_ZOMBIES) updateZombies(dt);
  updateMinigame(dt);
  updateOxygenInfection(dt);
  updateZombieFX(dt);
  updateTutorialVignette(dt);
  if (TUT_SERUM_PROMPT_TIMER > 0) {
    TUT_SERUM_PROMPT_TIMER -= dt;
    if (TUT_SERUM_PROMPT_TIMER <= 0) {
      TUT_SERUM_PROMPT_TIMER = 0;
      onTutorialSerumChoice(false); // 시간 초과 → N(보류) 처리
    }
  }
  if (player.exitCooldown > 0) player.exitCooldown -= dt;

  // 소음 파동 업데이트
  const pulseSpd = CONFIG.sonar.pulseSpeed * 1.2; // 소나보다 살짝 빠름
  for (const p of noisePulses) p.r += pulseSpd * dt;
  for (let i = noisePulses.length - 1; i >= 0; i--) {
    if (noisePulses[i].r > noisePulses[i].maxR * 1.4) noisePulses.splice(i, 1);
  }
  const ts = CONFIG.map.tileSize;
  camX += (player.px + ts / 2 - viewW() / 2 - camX) * CONFIG.camera.smooth;
  camY += (player.py + ts / 2 - viewH() / 2 - camY) * CONFIG.camera.smooth;
}

// ── 산소 / 감염 업데이트 ─────────────────────────────────────────
let _prevOxyZone = 'safe';   // 'safe' | 'warn' | 'empty' — 로그 중복 방지
let _prevInfZone = 'low';    // 'low' | 'mid' | 'high'

function updateOxygenInfection(dt) {
  if (player.dead) return;
  if (GAME_STATE !== 'PLAYING') return;
  if (TUT_ACTIVE && TUT_LOCKED) return; // 튜토리얼 대화창을 보는 동안만 산소/감염 자연 변화 정지
  const cfg = CONFIG.oxygen;

  // 산소 자연 감소 (스테이지별 속도)
  if (!devInvincible) {
    const baseDrain = cfg.drainPerStage[Math.min(player.stage, cfg.drainPerStage.length - 1)];
    const drainRate = baseDrain * (CONFIG.oxygen._drainMult || 1.0);
    player.oxygen = Math.max(0, player.oxygen - drainRate * dt);
  }

  // 산소 구간 진입 로그 + 사운드
  const oxyZone = player.oxygen <= 0 ? 'empty' : player.oxygen < cfg.infectThreshold ? 'warn' : 'safe';
  if (oxyZone !== _prevOxyZone) {
    if (oxyZone === 'warn')  { devLog(`⚠ 산소 위험구간 진입 (${player.oxygen.toFixed(1)}%) — 감염 시작`, 'warn'); SoundManager.startLoop('oxygen_warn'); addPopup('⚠ 산소 부족', '#ffaa00'); }
    if (oxyZone === 'empty') { devLog(`🔴 산소 고갈 — 감염 가속 시작`, 'danger'); SoundManager.play('oxygen_critical'); addPopup('🔴 산소 고갈', '#ff3333'); }
    if (oxyZone === 'safe')  { devLog(`산소 안전구간 복귀 (${player.oxygen.toFixed(1)}%)`, 'good'); SoundManager.stopLoop('oxygen_warn'); }
    _prevOxyZone = oxyZone;
  }

  // oxygen_warn 볼륨 — 산소 수치 낮을수록 크게
  if (oxyZone === 'warn') {
    const ratio = 1 - (player.oxygen / cfg.infectThreshold);
    SoundManager.setLoopVolume('oxygen_warn', ratio * 0.3);
  }

  // 감염 증가 — 산소 60% 이하부터 시작
  if (!devInvincible) {
    if (player.oxygen <= 0) {
      player.infection = Math.min(100, player.infection + cfg.infectRateEmpty * dt);
    } else if (player.oxygen < cfg.infectThreshold) {
      player.infection = Math.min(100, player.infection + cfg.infectRate * dt);
    }
  }

  // 감염 구간 진입 로그 + 사운드
  const infZone = player.infection >= 75 ? 'high' : player.infection >= 40 ? 'mid' : 'low';
  if (infZone !== _prevInfZone) {
    if (infZone === 'mid')  { devLog(`⚠ 감염 40% 돌파 (${player.infection.toFixed(1)}%)`, 'warn'); addPopup('⚠ 감염 진행 중', '#ff8800'); }
    if (infZone === 'high') { devLog(`🔴 감염 75% 위험 (${player.infection.toFixed(1)}%)`, 'danger'); SoundManager.play('infection_high'); addPopup('🔴 감염 위험', '#ff3333'); }
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
  if (!MAP || !MAP.width || !W_px || !H_px) return;
  const ts = CONFIG.map.tileSize;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W_px, H_px);
  ctx.save();
  ctx.scale(ZOOM, ZOOM);
  ctx.translate(-camX, -camY);

  const tx0 = Math.max(0, Math.floor(camX / ts) - 1);
  const ty0 = Math.max(0, Math.floor(camY / ts) - 1);
  const tx1 = Math.min(MAP.width,  Math.ceil((camX + viewW()) / ts) + 1);
  const ty1 = Math.min(MAP.height, Math.ceil((camY + viewH()) / ts) + 1);

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

      // DEV 지뢰 표시 (탐지됨=초록테두리 / 미탐지=빨강)
      if (tile === T.MINE && vis2 && devRevealMines) {
        const det = MAP.detected[ty * MAP.width + tx];
        ctx.save(); ctx.globalAlpha = 0.4;
        ctx.fillStyle = det ? 'rgba(0,255,136,0.1)' : 'rgba(255,50,50,0.15)';
        ctx.fillRect(sx, sy, ts, ts);
        ctx.strokeStyle = det ? '#00ff88' : '#ff3333'; ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(sx+8, sy+8); ctx.lineTo(sx+ts-8, sy+ts-8);
        ctx.moveTo(sx+ts-8, sy+8); ctx.lineTo(sx+8, sy+ts-8);
        ctx.stroke(); ctx.restore();
      }

      // 아이템 / 출구 (RESOURCE LAYER)
      if (tile === T.ITEM && vis2) drawItem(tx, ty, ts);
      if (tile === T.EXIT && vis2) drawExit(tx, ty, ts, player.exitCooldown <= 0);
    }
  }

  // RESOURCE LAYER
  drawSonarPings();
  drawSonarPreciseMarks();
  drawSonarPulse();
  drawNoisePulses();
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
  drawZombieFX(ts);
  drawPlayer(ts);
  drawMinePrompt(ts);
  drawTutorialSerumPrompt(ts);

  // 튜토리얼 비네팅 — 미니게임보다 먼저 그려서 미니게임이 비네팅 위에 보이게 함
  // (카메라 변환이 걸린 상태이므로 일시 해제하고 화면좌표로 그린 뒤 복귀)
  if (TUT_VIGNETTE.active) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0); // 카메라 translate 일시 해제 — 화면 좌표계로
    drawTutorialVignette();
    ctx.restore();
  }

  drawMinigame(ts);
  // END RESOURCE LAYER

  ctx.restore();

  // 비네팅
  ctx.fillStyle = vignetteGradient; ctx.fillRect(0, 0, W_px, H_px);

  // 화면 좌표계 오버레이 (ctx.restore 이후)
  drawPopups(lastDt);
  drawVoicePopup(lastDt);
  drawNotices(lastDt);
}

// ── 미니맵 ───────────────────────────────────────────────────────
function renderMinimap() {
  const { tiles, width, height } = MAP;
  const sz = CONFIG.minimap.size;
  const s  = sz / Math.max(width, height);
  mmCtx.fillStyle = '#000'; mmCtx.fillRect(0, 0, sz, sz);

  for (let ty = 0; ty < height; ty++) for (let tx = 0; tx < width; tx++) {
    const i = ty * width + tx;
    if (!VISITED[i]) continue;
    const tile = tiles[i];
    if (tile === T.WALL) {
      mmCtx.fillStyle = '#1a1a1a';
    } else if (tile === T.ITEM) {
      mmCtx.fillStyle = '#44aaff'; // 산소 캡슐 — 파란 점
    } else if (tile === T.EXIT) {
      mmCtx.fillStyle = player.exitCooldown > 0 ? '#115533' : '#00ff88'; // 쿨타임 중 어둡게
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
      if (distTiles > sonar.radarRadius + 0.5) continue;
      const zs  = Math.max(s, 2.5);
      const col = z.state === 'CHASE' ? '#ff3333' : z.state === 'SEARCH' ? '#ff8800' : '#ff6644';
      mmCtx.fillStyle = col;
      mmCtx.fillRect(z.tx * s + s/2 - zs/2, z.ty * s + s/2 - zs/2, zs, zs);
    }
    mmCtx.restore();
  }
}

// ── HUD & DEV ────────────────────────────────────────────────────
function updateHUD() {
  const cfg    = CONFIG.oxygen;
  const needed = CONFIG.stages[Math.min(player.stage, CONFIG.stages.length-1)].capsuleCount;
  const oxy    = Math.max(0, player.oxygen);
  const inf    = Math.max(0, player.infection);

  document.getElementById('hud-pos').textContent     = `${player.tx},${player.ty}`;
  document.getElementById('hud-basic').textContent   = sonar.charging ? 'CHARGE' : 'READY';
  document.getElementById('hud-precise').textContent = '📡 ' + sonar.precise;
  const serumEl = document.getElementById('hud-serum');
  if (serumEl) serumEl.textContent = '💉 ' + player.serum;

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
  itemEl.style.color = '#44aaff'; // 산소 캡슐 카운터 — 파란색 고정

  let visited = 0;
  for (let i = 0; i < VISITED.length; i++) if (VISITED[i]) visited++;
  document.getElementById('hud-explored').textContent = Math.floor(visited / MAP.floorCount * 100) + '%';

  // 남은 병원체 (회수 / 전체)
  const mineEl = document.getElementById('hud-mines');
  if (mineEl) {
    let remaining = 0;
    for (let i = 0; i < MAP.tiles.length; i++) if (MAP.tiles[i] === T.MINE) remaining++;
    const total = TUT_ACTIVE ? MAP.mineCount : CONFIG.stages[Math.min(player.stage, CONFIG.stages.length - 1)].mineCount;
    const collected = total - remaining;
    mineEl.textContent = `${collected}/${total}`;
    mineEl.style.color = remaining === 0 ? '#00ff88' : '#ff6644'; // 전부 회수 시 초록
  }

  // 누적 DNA (저장된 총량 + 이번 런 현재 회수량)
  const dnaEl = document.getElementById('hud-dna');
  if (dnaEl) {
    let savedDna = 0;
    try { savedDna = parseInt(localStorage.getItem('outbreak_total_dna') || '0'); } catch(e) {}
    dnaEl.textContent = `${savedDna} (+${player.totalCollected})`;
  }
}

function updateDevInfo() {
  if (!document.getElementById('dev-panel').classList.contains('open')) return;
  const t = MAP.tiles[player.ty * MAP.width + player.tx];
  document.getElementById('di-fps').textContent     = fps;
  document.getElementById('di-tile').textContent    = t === T.WALL ? 'WALL' : t === T.MINE ? 'MINE' : t === T.ITEM ? 'ITEM' : t === T.EXIT ? 'EXIT' : 'FLOOR';
  document.getElementById('di-mines').textContent   = MAP.mineCount;
  document.getElementById('di-items').textContent   = `${player.itemsFound}/${CONFIG.stages[Math.min(player.stage, CONFIG.stages.length-1)].capsuleCount}`;
  document.getElementById('di-zombies').textContent = zombies.length;
  document.getElementById('di-dead').textContent    = Math.floor(MAP.deadEndRatio * 100) + '%';
  document.getElementById('di-time').textContent    = Math.floor((Date.now() - stats.startTime) / 1000) + 's';
  document.getElementById('di-oxygen').textContent  = Math.ceil(player.oxygen) + '%';
  document.getElementById('di-infect').textContent  = Math.ceil(player.infection) + '%';
  const patEl = document.getElementById('di-patrol');
  if (patEl) patEl.textContent = `${patrol.phase}단계 / 속도×${patrol.speedMult.toFixed(1)}`;
  const stEl = document.getElementById('di-stage');
  if (stEl) stEl.textContent = `${player.stage + 1}층 (${CONFIG.stages[Math.min(player.stage, CONFIG.stages.length-1)].name})`;
}

// ── DEV 패널 ─────────────────────────────────────────────────────
document.getElementById('dev-toggle').addEventListener('click', () => {
  document.getElementById('dev-panel').classList.toggle('open');
  document.getElementById('dev-toggle').classList.toggle('on');
  resize();
});

// ── DEV 패널 내부 탭 전환 (설정 / 로그) ────────────────────────────
function switchDevTab(tab) {
  const settingsEl = document.getElementById('dev-inner');
  const logEl      = document.getElementById('log-panel');
  const tabSettings = document.getElementById('tab-settings');
  const tabLog      = document.getElementById('tab-log');

  if (tab === 'log') {
    settingsEl.classList.remove('active');
    logEl.classList.add('active');
    tabSettings.classList.remove('active');
    tabLog.classList.add('active');
  } else {
    settingsEl.classList.add('active');
    logEl.classList.remove('active');
    tabSettings.classList.add('active');
    tabLog.classList.remove('active');
  }
}
document.getElementById('tab-settings').addEventListener('click', () => switchDevTab('settings'));
document.getElementById('tab-log').addEventListener('click', () => switchDevTab('log'));
switchDevTab('settings'); // 기본값: 설정 탭

const SLIDERS = [
  ['d-stage',     v => { player.stage = parseInt(v) - 1; init(); }],
  ['d-tilesize',  v => CONFIG.map.tileSize         = parseInt(v)],
  ['d-loops',     v => CONFIG.map.loopPaths        = parseInt(v)],
  ['d-delay',     v => CONFIG.player.moveDelay     = parseFloat(v)],
  ['d-vision',    v => CONFIG.player.visionRad     = parseInt(v)],
  ['d-maxcharge', v => CONFIG.sonar.maxCharge      = parseFloat(v)],
  ['d-radius',    v => CONFIG.sonar.maxRadius      = parseInt(v)],
  ['d-pingdur',   v => CONFIG.sonar.pingDuration   = parseFloat(v)],
  ['d-precise',   v => CONFIG.sonar.preciseCount   = parseInt(v)],
  ['d-zspeed',    v => CONFIG.zombie.speed         = parseFloat(v)],
  ['d-oxydrain',  v => { const s = Math.min(player.stage, CONFIG.oxygen.drainPerStage.length-1); CONFIG.oxygen.drainPerStage[s] = parseFloat(v); }],
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
  document.getElementById('d-reveal').textContent = '☣ 병원체 표시 ' + (devRevealMines ? 'ON' : 'OFF');
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
  player.itemsFound++;
});
document.getElementById('d-add-serum').addEventListener('click', () => {
  player.serum++;
  updateSerumHUD();
  devLog(`DEV: 치료제 +1 (현재 ${player.serum}개)`, 'good');
});
document.getElementById('d-add-dna').addEventListener('click', () => {
  try {
    const prev = parseInt(localStorage.getItem(DNA_KEY) || '0');
    localStorage.setItem(DNA_KEY, String(prev + 20));
  } catch(e) {}
  devLog('DEV: DNA +20', 'good');
});
document.getElementById('d-collect-all').addEventListener('click', () => {
  if (!MAP || GAME_STATE !== 'PLAYING') return;
  // 모든 병원체 타일을 FLOOR로 변환
  let count = 0;
  for (let i = 0; i < MAP.tiles.length; i++) {
    if (MAP.tiles[i] === T.MINE) {
      MAP.tiles[i] = T.FLOOR;
      MAP.detected[i] = 0;
      const tx = i % MAP.width;
      const ty = Math.floor(i / MAP.width);
      recalcNumbers(tx, ty);
      player.totalCollected++;
      count++;
    }
  }
  updateGuardHomePoints();
  checkPatrolPhase();
  devLog(`DEV: 병원체 ${count}개 전체 회수`, 'good');
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
// go-btn 제거됨 (게임오버에서 기지로만 이동)
document.getElementById('go-base-btn').addEventListener('click', () => {
  player.stage          = 0;
  player.oxygen         = CONFIG.oxygen.max;
  player.infection      = 0;
  player.totalCollected = 0;
  player.recordSaved    = false;
  // 감염 연출 초기화
  const infectFlash = document.getElementById('infect-flash');
  infectFlash.style.opacity = '0';
  setTimeout(() => { infectFlash.style.display = 'none'; }, 600);
  const goPanel = document.getElementById('gameover');
  goPanel.classList.remove('show', 'infected');
  showLobby();
});
// 다음 스테이지
document.getElementById('esc-btn').addEventListener('click', () => {
  if (player.stage < CONFIG.stages.length - 1) {
    player.stage++;
    applyStageTransition();
  }
  init();
});
// 기지 복귀 — 1층부터 재시작
// esc-retire 제거됨 (탈출에서 기지로만 이동)
document.getElementById('esc-base-btn').addEventListener('click', () => {
  player.stage          = 0;
  player.oxygen         = CONFIG.oxygen.max;
  player.infection      = 0;
  player.totalCollected = 0;
  player.recordSaved    = false;
  document.getElementById('escaped').classList.remove('show');
  showLobby();
});
document.getElementById('esc-clear').addEventListener('click', () => {
  player.stage          = 0;
  player.oxygen         = CONFIG.oxygen.max;
  player.infection      = 0;
  player.totalCollected = 0;
  player.recordSaved    = false;
  document.getElementById('escaped').classList.remove('show');
  showTitle();
});

// TO BE CONTINUED — 기지 복귀
document.getElementById('tbc-btn').addEventListener('click', () => {
  player.stage          = 0;
  player.oxygen         = CONFIG.oxygen.max;
  player.infection      = 0;
  player.totalCollected = 0;
  player.recordSaved    = false;
  document.getElementById('tbc-screen').classList.remove('show');
  document.getElementById('ending-screen').classList.remove('show');
  document.getElementById('origin-eyes').classList.remove('show');
  document.getElementById('eye-left').classList.remove('lit');
  document.getElementById('eye-right').classList.remove('lit');
  document.getElementById('terminal-text').textContent = '';
  document.getElementById('terminal-box').style.display = '';
  document.getElementById('terminal-hint').style.display = '';
  document.getElementById('terminal-cursor').style.display = '';
  document.getElementById('ending-screen').style.background = '';
  showLobby();
});
// 출구 팝업 — 복귀 (조기 or 완전)
document.getElementById('exit-retire-btn').addEventListener('click', () => {
  document.getElementById('early-exit').classList.remove('show');
  showEscaped('early');
});
// 출구 팝업 — 다음 스테이지 (전부 회수 시)
document.getElementById('exit-next-btn').addEventListener('click', () => {
  document.getElementById('early-exit').classList.remove('show');
  if (player.stage < CONFIG.stages.length - 1) {
    player.stage++;
    applyStageTransition();
  }
  resetOriginFlash();
  init();
});
// 출구 팝업 — 재탐사 (미회수 시, 쿨타임 부여)
document.getElementById('exit-rescan-btn').addEventListener('click', () => {
  document.getElementById('early-exit').classList.remove('show');
  player.exitCooldown = 4.0; // 4초 쿨타임
  GAME_STATE = 'PLAYING';
  devLog('재탐사 시작 — 출구 4초 쿨타임', '');
});
document.getElementById('log-clear').addEventListener('click', () => {
  devLogEntries.length = 0; _renderDevLog();
});

// ── 모바일 감지 및 터치 조작 ─────────────────────────────────────
const _isTouchDevice = ('ontouchstart' in window || navigator.maxTouchPoints > 0)
                       && window.innerWidth < 1024;

let _touchControlsActive = _isTouchDevice;

// ── 전체화면 요청 (모바일 주소표시줄 방지) ────────────────────────
function requestFullscreenOnce() {
  const el = document.documentElement;
  if (el.requestFullscreen)            el.requestFullscreen();
  else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen(); // iOS Safari 미지원, 무시
}

// ── 모바일 / PC 레이아웃 분리 ──────────────────────────────────────
function applyTouchControls() {
  const gameArea = document.getElementById('game-area');
  const touchEl  = document.getElementById('touch-controls');

  if (_touchControlsActive) {
    // ── 모바일 전용 ──────────────────────────────────────
    gameArea.classList.add('mobile');        // CSS: 미니맵 우상단, 볼륨 숨김
    document.body.classList.add('mobile-ui'); // CSS: HUD 크기 축소, sidebar 자동 숨김
    touchEl.classList.add('show');           // 터치 컨트롤 표시
    CONFIG.camera.smooth = 0.18;             // 카메라 스무스 강화

    // 첫 터치 시 전체화면 요청 (주소표시줄 숨김)
    document.addEventListener('touchstart', requestFullscreenOnce, { once: true });
  } else {
    // ── PC 전용 ──────────────────────────────────────────
    gameArea.classList.remove('mobile');
    document.body.classList.remove('mobile-ui');
    touchEl.classList.remove('show');
    CONFIG.camera.smooth = 0.12;             // 카메라 스무스 기본값
  }

  document.getElementById('d-touch-toggle').textContent =
    '📱 터치 조작 ' + (_touchControlsActive ? 'ON' : 'OFF');

  // 모바일↔PC 전환 시 캔버스 실제 해상도 갱신 (비율 왜곡 방지)
  if (typeof resize === 'function') resize();
}
applyTouchControls();
updateSerumHUD(); // D 버튼 초기 상태 설정
window.addEventListener('resize', () => {
  const shouldTouch = ('ontouchstart' in window || navigator.maxTouchPoints > 0)
                      && window.innerWidth < 1024;
  if (shouldTouch !== _touchControlsActive) {
    _touchControlsActive = shouldTouch;
    applyTouchControls();
  }
});

// DEV — 터치 조작 수동 토글
document.getElementById('d-touch-toggle').addEventListener('click', () => {
  _touchControlsActive = !_touchControlsActive;
  applyTouchControls();
});

// DEV — 이벤트 로그 탭으로 전환
document.getElementById('d-log-toggle').addEventListener('click', () => {
  switchDevTab('log');
});

// ── 터치 이벤트 → 키 입력 변환 ───────────────────────────────────
(function setupTouchControls() {
  const ACTION_MAP = {
    'touch-f': 'KeyF',
    'touch-e': 'KeyE',
    'touch-g': 'KeyG',
  };
  const DPAD_MAP = {
    'dpad-up':    'ArrowUp',
    'dpad-down':  'ArrowDown',
    'dpad-left':  'ArrowLeft',
    'dpad-right': 'ArrowRight',
  };

  function fireKey(code, type) {
    const e = new KeyboardEvent(type, { code, bubbles: true, cancelable: true });
    window.dispatchEvent(e);
  }

  // ── 조이스틱 ───────────────────────────────────────────────────
  const joystickWrap  = document.getElementById('joystick-wrap');
  const joystickStick = document.getElementById('joystick-stick');
  const minigameDpad  = document.getElementById('minigame-dpad');

  let _joyActive  = false;
  let _joyOriginX = 0;
  let _joyOriginY = 0;
  let _joyDir     = null;
  const JOY_DEAD  = 18;
  const JOY_MAX   = 48;

  function calcDir(dx, dy) {
    if (Math.hypot(dx, dy) < JOY_DEAD) return null;
    return Math.abs(dx) > Math.abs(dy)
      ? (dx > 0 ? 'ArrowRight' : 'ArrowLeft')
      : (dy > 0 ? 'ArrowDown'  : 'ArrowUp');
  }

  function joyMove(cx, cy) {
    const dx  = cx - _joyOriginX;
    const dy  = cy - _joyOriginY;
    const mag = Math.min(Math.hypot(dx, dy), JOY_MAX);
    const ang = Math.atan2(dy, dx);
    joystickStick.style.transform =
      `translate(calc(-50% + ${Math.cos(ang)*mag}px), calc(-50% + ${Math.sin(ang)*mag}px))`;
    const newDir = calcDir(dx, dy);
    if (newDir === _joyDir) return;
    if (_joyDir) { KEYS[_joyDir] = false; }
    _joyDir = newDir;
    if (_joyDir && GAME_STATE === 'PLAYING') KEYS[_joyDir] = true;
  }

  function joyEnd() {
    if (!_joyActive) return;
    _joyActive = false;
    if (_joyDir) { KEYS[_joyDir] = false; _joyDir = null; }
    joystickStick.style.transform = 'translate(-50%, -50%)';
  }

  joystickWrap.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const t = e.changedTouches[0];
    const r = joystickWrap.getBoundingClientRect();
    _joyOriginX = r.left + r.width  / 2;
    _joyOriginY = r.top  + r.height / 2;
    _joyActive  = true;
    joyMove(t.clientX, t.clientY);
  }, { passive: false });

  joystickWrap.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (!_joyActive) return;
    joyMove(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
  }, { passive: false });

  joystickWrap.addEventListener('touchend',    (e) => { e.preventDefault(); joyEnd(); }, { passive: false });
  joystickWrap.addEventListener('touchcancel', (e) => { e.preventDefault(); joyEnd(); }, { passive: false });

  // ── 미니게임 D-PAD ─────────────────────────────────────────────
  Object.entries(DPAD_MAP).forEach(([id, code]) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    const start = (e) => { e.preventDefault(); btn.classList.add('pressed'); fireKey(code, 'keydown'); };
    const end   = (e) => { e.preventDefault(); btn.classList.remove('pressed'); fireKey(code, 'keyup'); };
    btn.addEventListener('touchstart', start, { passive: false });
    btn.addEventListener('touchend',   end,   { passive: false });
    btn.addEventListener('touchcancel',end,   { passive: false });
  });

  // ── 미니게임 진입/종료 / 선택지 UI 전환 ─────────────────────
  window._updateTouchUI = function() {
    if (!joystickWrap || !minigameDpad) return;
    const isMinigame   = minigame.active && minigame.type === 'mine';
    const isCombat     = minigame.active && minigame.type === 'combat';
    // 본게임 전투 선택지 — 화면 하단 터치 버튼 사용 (스크립트가 없어 하단도 안 겹침)
    const isMainChoice = isCombat && minigame.serumChoice && !TUT_ACTIVE;
    // 튜토리얼 선택지(평시 Y/N + 전투 강제선택) — 화면 정중앙 오버레이를 따로 사용, 여기선 액션버튼 숨김 용도로만 참조
    const isTutChoice  = TUT_ACTIVE && (TUT_SERUM_PROMPT_ACTIVE || (isCombat && minigame.serumChoice));
    const isChoice     = isMainChoice || isTutChoice;
    const isMoveLocked = minigame.active;  // 회수든 전투든 — 이동 불가 시 조이스틱 숨김

    // 조이스틱 — 이동 가능할 때만 표시 (전투 중에도 숨김, dpad는 회수에만)
    joystickWrap.style.display  = isMoveLocked ? 'none' : '';
    minigameDpad.classList.toggle('show', isMinigame);

    // 미니게임(회수) 중엔 액션버튼 숨김 — dpad 입력과 오조작 방지. 선택지 표시 중에도 오조작 방지로 숨김
    const actionBtnsEl = document.getElementById('action-btns');
    if (actionBtnsEl && !isMainChoice) {
      actionBtnsEl.style.display = (isMinigame || isTutChoice) ? 'none' : '';
    }

    // 전투 중엔 G/E 숨김 — F(연타)만 유효한 입력
    const gBtn = document.getElementById('touch-g');
    const eBtn = document.getElementById('touch-e');
    if (gBtn) gBtn.style.display = isCombat ? 'none' : '';
    if (eBtn) eBtn.style.display = isCombat ? 'none' : '';

    // D 버튼 — 치료제 보유 + 전투/미니게임 외
    const dBtn = document.getElementById('touch-d');
    if (dBtn) dBtn.style.display = (player.serum > 0 && !minigame.active) ? '' : 'none';

    // 본게임 전투 선택지 Y/N 버튼 — action-btns 전체 숨기고 하단 중앙 Y/N 표시 (튜토리얼은 화면 정중앙 오버레이를 따로 사용)
    const choiceEl = document.getElementById('touch-serum-choice');
    const actionBtns = document.getElementById('action-btns');
    if (choiceEl) {
      if (isMainChoice) {
        choiceEl.classList.add('show');
        if (actionBtns) actionBtns.style.display = 'none';
      } else {
        choiceEl.classList.remove('show');
        // 미니게임/튜토리얼 선택지 중이 아닐 때만 복원 (위에서 이미 처리)
        if (actionBtns && !isMinigame && !isTutChoice) actionBtns.style.display = '';
      }
    }
  };
  window._updateTouchUI(); // 정의 즉시 1회 호출 — D버튼 등 초기 상태 동기화

  // ── D 버튼 (자가 치료제) ──────────────────────────────────────
  const dBtn = document.getElementById('touch-d');
  if (dBtn) {
    dBtn.addEventListener('touchstart', (e) => {
      e.preventDefault(); dBtn.classList.add('pressed'); fireKey('KeyD', 'keydown');
    }, { passive: false });
    dBtn.addEventListener('touchend', (e) => {
      e.preventDefault(); dBtn.classList.remove('pressed');
    }, { passive: false });
  }

  // ── Y/N 버튼 (전투 치료제 선택지) ────────────────────────────
  const yBtn = document.getElementById('touch-y');
  const nBtn = document.getElementById('touch-n');
  if (yBtn) {
    yBtn.addEventListener('touchstart', (e) => {
      e.preventDefault(); yBtn.classList.add('pressed'); fireKey('KeyY', 'keydown');
    }, { passive: false });
    yBtn.addEventListener('touchend', (e) => {
      e.preventDefault(); yBtn.classList.remove('pressed');
      if (window._updateTouchUI) window._updateTouchUI();
    }, { passive: false });
  }
  if (nBtn) {
    nBtn.addEventListener('touchstart', (e) => {
      e.preventDefault(); nBtn.classList.add('pressed'); fireKey('KeyN', 'keydown');
    }, { passive: false });
    nBtn.addEventListener('touchend', (e) => {
      e.preventDefault(); nBtn.classList.remove('pressed');
      if (window._updateTouchUI) window._updateTouchUI();
    }, { passive: false });
  }

  // ── 액션 버튼 (F/E/G) ─────────────────────────────────────────
  Object.entries(ACTION_MAP).forEach(([id, code]) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    const start = (e) => { e.preventDefault(); btn.classList.add('pressed');    fireKey(code, 'keydown'); };
    const end   = (e) => { e.preventDefault(); btn.classList.remove('pressed'); fireKey(code, 'keyup');   };
    btn.addEventListener('touchstart', start, { passive: false });
    btn.addEventListener('touchend',   end,   { passive: false });
    btn.addEventListener('touchcancel',end,   { passive: false });
  });
})();

// ── 튜토리얼 풀스크린 인트로 — 모바일 탭으로 Space 대체 (정상 동작 확인됨, 유지) ──
// 인게임 하단 대화창은 탭 대신 F키(터치에선 기존 touch-f 버튼)로 진행 — 조이스틱/액션버튼과 겹치는 영역에서
// click/touchstart 합성이 불안정했던 문제를 피하기 위해, 이미 검증된 touch-f 버튼 경로를 그대로 재사용.
{
  const introEl = document.getElementById('tutorial-intro-screen');
  if (introEl) {
    introEl.addEventListener('touchstart', (e) => { e.preventDefault(); tutorialAdvanceKey(); }, { passive: false });
    introEl.addEventListener('click', tutorialAdvanceKey);
  }
}

// ── 튜토리얼 중앙 Y/N 오버레이 버튼 — 클릭/탭 시 실제 Y/N 키 입력과 동일하게 처리 ──
// 기존 키보드 Y/N 핸들러(평시 선택/전투 선택 모두)를 그대로 재사용 — 가상 keydown 이벤트만 디스패치
{
  const fireYN = (code) => window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true, cancelable: true }));
  const yBtn = document.getElementById('tcc-y-btn');
  const nBtn = document.getElementById('tcc-n-btn');
  if (yBtn) {
    yBtn.addEventListener('touchstart', (e) => { e.preventDefault(); yBtn.classList.add('pressed'); fireYN('KeyY'); }, { passive: false });
    yBtn.addEventListener('touchend',   (e) => { e.preventDefault(); yBtn.classList.remove('pressed'); }, { passive: false });
    yBtn.addEventListener('click', () => fireYN('KeyY'));
  }
  if (nBtn) {
    nBtn.addEventListener('touchstart', (e) => { e.preventDefault(); nBtn.classList.add('pressed'); fireYN('KeyN'); }, { passive: false });
    nBtn.addEventListener('touchend',   (e) => { e.preventDefault(); nBtn.classList.remove('pressed'); }, { passive: false });
    nBtn.addEventListener('click', () => fireYN('KeyN'));
  }
}

function closeIntro() {
  document.getElementById('stage-intro').classList.remove('show');
  GAME_STATE = 'PLAYING';
}
document.getElementById('intro-btn').addEventListener('click', closeIntro);

// 기지 사이드바 탭 버튼
document.querySelectorAll('.lb-tab-btn').forEach(btn => {
  btn.addEventListener('click', () => renderLobby(btn.dataset.tab));
});
// 기지 작전 개시
document.getElementById('lb-start-btn').addEventListener('click', startGame);
// 기지 뒤로가기
document.getElementById('lb-back-btn').addEventListener('click', closeLobby);
// 강화 초기화 — 확인 후 실행
document.getElementById('lb-reset-btn').addEventListener('click', () => {
  if (!confirm('모든 강화를 초기화하고 DNA를 환불합니까?')) return;
  const ups = loadUpgrades();
  let refund = 0;
  const all = [...LOBBY.status, ...LOBBY.trait];
  for (const item of all) {
    const lv = ups[item.id] || 0;
    for (let i = 0; i < lv; i++) refund += item.costs[i];
  }
  saveUpgrades({});
  const dna = parseInt(localStorage.getItem(DNA_KEY) || '0');
  localStorage.setItem(DNA_KEY, String(dna + refund));
  devLog(`강화 초기화 — DNA +${refund} 환불`, 'warn');
  renderLobby('status');
});

// 타이틀 메뉴 버튼
document.getElementById('ts-start').addEventListener('click', showLobby);
// ts-base, ts-records 제거됨 — 기지로 이동만 사용

// TEST ONLY — 출시 빌드에서 반드시 제거. 모든 진행 데이터를 지우고 튜토리얼로 진입(PC/모바일 공용)
// 데이터가 비어있으면 전사자 풀 중복방지 등 부수효과가 없어 안전 — 부분 리셋(유닛 번호만 제거) 대신 전체 초기화로 통일
document.getElementById('ts-test-reset')?.addEventListener('click', () => {
  if (!confirm('모든 진행 데이터(DNA·업그레이드·기록)를 초기화하고 튜토리얼로 이동합니다. 계속할까요?')) return;
  localStorage.clear();
  location.reload();
});

// DEV — 수집 기록 보기 (로그 패널에 출력)
document.getElementById('d-records').addEventListener('click', () => {
  try {
    const records = JSON.parse(localStorage.getItem(RECORDS_KEY) || '[]');
    const totalDna = parseInt(localStorage.getItem(DNA_KEY) || '0');
    devLog(`═══ 누적 DNA: ${totalDna}개 / 총 ${records.length}런 ═══`, 'good');
    records.slice(-8).reverse().forEach(r => {
      const label = { retire:'복귀', early:'조기', death:'사망', infected:'좀비화' }[r.exitType] || r.exitType;
      devLog(`${r.stage}층 [${label}] 획득${r.collected} (회수${r.rawCollected}) 감염${r.infection}% ${r.elapsed}s`, '');
    });
  } catch(e) { devLog('기록 읽기 실패', 'danger'); }
});

// DEV — 기록 초기화 (튜토리얼 우회, 바로 본게임 테스트용)
document.getElementById('d-clearrecords').addEventListener('click', () => {
  localStorage.removeItem(RECORDS_KEY);
  localStorage.removeItem(DNA_KEY);
  localStorage.setItem(UNIT_KEY, '1');   // UNIT-00 = 튜토리얼 우회, 플레이어는 UNIT-01부터
  localStorage.removeItem(FALLEN_KEY);
  devLog('수집 기록 초기화 — UNIT-01부터 시작 (튜토리얼 우회)', 'warn');
});

// DEV — 기지 UI 폰트 크기 조절
(function() {
  const root  = document.documentElement;
  const valEl = document.getElementById('d-font-size-val');
  let basePx  = 13;
  const update = () => {
    root.style.setProperty('--lb-base', basePx + 'px');
    if (valEl) valEl.textContent = basePx + 'px';
  };
  update();
  document.getElementById('d-font-up').addEventListener('click',   () => { basePx++; update(); });
  document.getElementById('d-font-down').addEventListener('click', () => { if (basePx > 4) { basePx--; update(); } });
})();

// DEV — 사운드 마스터 슬라이더
(function() {
  function bindSlider(id, valId, fn) {
    const el  = document.getElementById(id);
    const vel = document.getElementById(valId);
    if (!el) return;
    el.addEventListener('input', () => {
      const v = parseFloat(el.value);
      if (vel) vel.textContent = v.toFixed(2);
      fn(v);
    });
  }
  bindSlider('s-master', 's-master-v', v => SoundManager.setMasterVolume(v));
  bindSlider('s-bgm',    's-bgm-v',    v => SoundManager.setBGMVolume(v));
  bindSlider('s-sfx',    's-sfx-v',    v => SoundManager.setSFXVolume(v));
})();

// DEV — 효과음 개별 슬라이더
document.querySelectorAll('.sfx-slider').forEach(el => {
  const valEl = el.nextElementSibling;
  el.addEventListener('input', () => {
    const id = el.dataset.id;
    const v  = parseFloat(el.value);
    if (valEl) valEl.textContent = v.toFixed(2);
    SoundManager.setSFXIndividualVolume(id, v);
  });
});

// DEV — BGM 개별 슬라이더
document.querySelectorAll('.bgm-slider').forEach(el => {
  const valEl = el.nextElementSibling;
  el.addEventListener('input', () => {
    const id = el.dataset.id;
    const v  = parseFloat(el.value);
    if (valEl) valEl.textContent = v.toFixed(2);
    SoundManager.setBGMIndividualVolume(id, v);
  });
});

// DEV — 사운드 설정 내보내기
document.getElementById('d-sound-export').addEventListener('click', () => {
  const data = {
    VOL:     { ...SoundManager.VOL },
    SFX_VOL: { ...SoundManager.SFX_VOL },
    BGM_VOL: { ...SoundManager.BGM_VOL },
  };
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'sound_config.json';
  a.click();
  URL.revokeObjectURL(url);
  devLog('사운드 설정 내보내기 완료 → sound_config.json', 'good');
});

// ── 인게임 볼륨 패널 ─────────────────────────────────────────────
(function() {
  function bindVol(id, valId, fn) {
    const el  = document.getElementById(id);
    const vel = document.getElementById(valId);
    if (!el) return;
    el.addEventListener('input', () => {
      const v = parseFloat(el.value);
      if (vel) vel.textContent = v.toFixed(2);
      fn(v);
      // DEV 패널 슬라이더도 동기화
      const devMap = { 'vp-master':'s-master', 'vp-bgm':'s-bgm', 'vp-sfx':'s-sfx' };
      const devEl  = document.getElementById(devMap[id]);
      const devVal = document.getElementById(devMap[id] + '-v');
      if (devEl)  devEl.value = el.value;
      if (devVal) devVal.textContent = v.toFixed(2);
    });
  }
  bindVol('vp-master', 'vp-master-v', v => SoundManager.setMasterVolume(v));
  bindVol('vp-bgm',    'vp-bgm-v',    v => SoundManager.setBGMVolume(v));
  bindVol('vp-sfx',    'vp-sfx-v',    v => SoundManager.setSFXVolume(v));

  // DEV 패널 슬라이더 변경 시 인게임 패널도 동기화
  ['master','bgm','sfx'].forEach(key => {
    const devEl = document.getElementById(`s-${key}`);
    if (!devEl) return;
    devEl.addEventListener('input', () => {
      const vpEl  = document.getElementById(`vp-${key}`);
      const vpVal = document.getElementById(`vp-${key}-v`);
      if (vpEl)  vpEl.value = devEl.value;
      if (vpVal) vpVal.textContent = parseFloat(devEl.value).toFixed(2);
    });
  });
})();

// ESC 설정 메뉴 — 계속하기 버튼
document.getElementById('settings-resume')?.addEventListener('click', resumeGame);
// 모바일 일시정지 버튼
document.getElementById('mobile-pause')?.addEventListener('click', () => {
  if (GAME_STATE === 'PLAYING') pauseGame();
});

// ── 메인 루프 ────────────────────────────────────────────────────
let lastTs = 0, fps = 0, frameCount = 0, fpsTimer = 0, lastDt = 0;

function loop(ts) {
  const dt = Math.min((ts - lastTs) / 1000, 0.1); lastTs = ts; lastDt = dt;
  frameCount++; fpsTimer += dt;
  if (fpsTimer >= 1) { fps = frameCount; frameCount = 0; fpsTimer = 0; }
  // TUTORIAL_INTRO — 풀스크린 암전 세계관 설명 중. 인게임 화면(캔버스/HUD) 렌더링 안 함
  if (GAME_STATE === 'PLAYING' || GAME_STATE === 'ESCAPED' || GAME_STATE === 'GAMEOVER') {
    handleInput(dt); updateSonar(dt); update(dt);
    render(); renderMinimap(); updateHUD(); updateDevInfo();
  }
  requestAnimationFrame(loop);
}

// 최초 실행 — 산소/감염 초기화
player.oxygen         = CONFIG.oxygen.max;
player.infection      = 0;
player.stage          = 0;
player.totalCollected = 0;
player.recordSaved    = false;
resize();
// CSS 완전 로드 후 resize 재호출 (GitHub Pages 타이밍 이슈 방지)
window.addEventListener('load', () => { resize(); });
// 최초 진입 — 유닛 0(첫 플레이)이면 튜토리얼, 아니면 타이틀
if (getCurrentUnit() === 0) startTutorial();
else showTitle();

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
