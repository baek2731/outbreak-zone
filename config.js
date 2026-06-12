// ================================================================
//  config.js — OUTBREAK ZONE 파라미터 테이블
// ================================================================

const CONFIG = {

  map: {
    size:       17,
    tileSize:   48,
    loopPaths:   6,
    deadEndMax: 0.3,
  },

  mine: {
    density: 8,   // 병원체 밀도 (%)
  },

  player: {
    moveDelay: 0.25,
    visionRad:  4,
  },

  oxygen: {
    max:              100,         // 산소 최대치
    drainPerStage:    [4, 7, 11], // 스테이지별 자연 감소 속도 (%/초)
    drainOnHit:        15,         // 좀비 피격 시 산소 감소량
    infectThreshold:   60,         // 산소 이 % 이하부터 감염 시작
    infectRate:         2.5,       // 감염 증가 속도 (%/초) — 위험구간
    infectRateEmpty:    6.0,       // 감염 증가 속도 (%/초) — 산소 0일 때
    capsuleHeal:       33,         // 산소 캡슐 1개당 회복량 (%)
  },

  sonar: {
    minCharge:      0.5,   // C1 최소 차징
    maxCharge:      1.5,   // C2 최대 차징
    minRadius:      2,     // C3 최소 스캔 반경
    maxRadius:      4,     // C4 최대 스캔 반경
    pingDuration:   1.2,   // 핑 표시 지속 (초)
    pulseSpeed:     160,   // 파장 속도 (px/초)
    preciseCount:   2,     // 시작 시 정밀 소나 지급 수
    radarDuration:  4.0,   // 소나 발동 후 미니맵 레이더 표시 지속 (초)
  },

  escape: {
    itemCount: 3,          // 산소 캡슐 수
  },

  camera: { smooth: 0.12 },

  minimap: {
    size:    80,
    opacity: 0.80,
  },

  zombie: {
    count:        2,
    speed:        0.30,
    spawnDist:    6,
    damageCool:   1.5,
    fovAngle:     90,
    fovRange:     2,
    hearRange:    4,
    chaseMemory:  2.5,
    noiseMemory:  6.0,
  },

};
