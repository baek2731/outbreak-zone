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
    density: 8,   // A3 지뢰 밀도 (%)
  },

  player: {
    moveDelay: 0.25,
    visionRad:  4,
    maxHp:      3,
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
    itemCount: 3,          // 탈출에 필요한 부품 수
  },

  camera: { smooth: 0.12 },

  minimap: {
    size:    80,
    opacity: 0.80,
  },

  // 좀비 (Step 4 봉인)
  zombie: {
    count:        2,     // 스폰 수
    speed:        0.30,  // 플레이어 대비 속도 비율
    spawnDist:    6,     // 스폰 최소 거리 (타일)
    damageCool:   1.5,   // 접촉 피해 쿨타임 (초)
    fovAngle:     90,    // 시야각 (도)
    fovRange:     2,     // 시야 거리 (타일)
    hearRange:    4,     // 청각 범위 (타일) — 소나/지뢰 소음 도달 범위
    chaseMemory:  2.5,   // 플레이어 시야 잃은 후 추격 유지 시간 (초)
    noiseMemory:  6.0,   // 소음 인지 후 발원지 탐색 유지 시간 (초)
  },

};
