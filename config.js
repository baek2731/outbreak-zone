// ================================================================
//  config.js — OUTBREAK ZONE 파라미터 테이블
// ================================================================

const CONFIG = {

  map: {
    tileSize:   48,
    loopPaths:   6,
    deadEndMax: 0.3,
  },

  player: {
    moveDelay: 0.35,
    visionRad:  4,
  },

  oxygen: {
    max:              100,           // 산소 최대치
    drainPerStage:    [2, 3.5, 5.5, 7, 9], // 스테이지별 자연 감소 속도 (%/초)
    drainOnHit:        7.5,          // (구) 좀비 피격 시 산소 감소 — 현재 미니게임으로 대체
    infectThreshold:   60,           // 산소 이 % 이하부터 감염 시작
    infectRate:         1.25,        // 감염 증가 속도 (%/초) — 위험구간
    infectRateEmpty:    3.0,         // 감염 증가 속도 (%/초) — 산소 0일 때
    capsuleHeal:       33,           // 산소 캡슐 1개당 회복량 (%)
    stageHeal:         30,           // 층 이동 시 산소 보충량 (%)
  },

  sonar: {
    minCharge:      0.5,   // 최소 차징
    maxCharge:      1.5,   // 최대 차징
    minRadius:      2,     // 최소 스캔 반경
    maxRadius:      4,     // 최대 스캔 반경
    pingDuration:   1.2,   // 핑 표시 지속 (초)
    pulseSpeed:     160,   // 파장 속도 (px/초)
    preciseCount:   2,     // 시작 시 정밀 소나 지급 수
    radarDuration:  4.0,   // 소나 발동 후 미니맵 레이더 표시 지속 (초)
  },

  // 스테이지 테이블 — 맵/병원체/좀비/캡슐/미니게임 난이도
  stages: [
    { name:'외곽 병동',         mapSize:15, mineCount:5,  zombieCount:1, capsuleCount:3, patternLen:3, combatMash:{ CHASE:6,  SEARCH:4, WANDER:2 } },
    { name:'일반 병동',         mapSize:17, mineCount:7,  zombieCount:2, capsuleCount:3, patternLen:3, combatMash:{ CHASE:7,  SEARCH:5, WANDER:3 } },
    { name:'중환자실',          mapSize:19, mineCount:9,  zombieCount:3, capsuleCount:4, patternLen:4, combatMash:{ CHASE:8,  SEARCH:5, WANDER:3 } },
    { name:'바이러스 연구소',   mapSize:21, mineCount:11, zombieCount:4, capsuleCount:4, patternLen:4, combatMash:{ CHASE:9,  SEARCH:6, WANDER:4 } },
    { name:'발원지',            mapSize:23, mineCount:13, zombieCount:5, capsuleCount:5, patternLen:5, combatMash:{ CHASE:10, SEARCH:7, WANDER:4 } },
  ],

  camera: { smooth: 0.12 },

  minimap: {
    size:    120,
    opacity: 0.85,
  },

  zombie: {
    speed:        0.30,  // 플레이어 대비 속도 비율
    spawnDist:    6,     // 스폰 최소 거리 (타일)
    damageCool:   1.5,   // 접촉 판정 쿨타임 (초)
    fovAngle:     90,    // 시야각 (도)
    fovRange:     2,     // 시야 거리 (타일)
    hearRange:    4,     // 청각 범위 (타일)
    chaseMemory:  2.5,   // 시야 잃은 후 추격 유지 (초)
    noiseMemory:  6.0,   // 소음 인지 후 탐색 유지 (초)
  },

};
