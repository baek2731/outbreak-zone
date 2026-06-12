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
  },

  escape: {
    itemCount: 3,          // 탈출에 필요한 부품 수
  },

  camera: { smooth: 0.12 },

  minimap: {
    size:    80,
    opacity: 0.80,
  },

  // 좀비 (Step 3 적용 중)
  zombie: {
    count:      2,     // 스폰 수
    speed:      0.42,  // 플레이어 대비 속도 비율
    spawnDist:  6,     // 스폰 최소 거리 (스폰 지점에서, 타일)
    damageCool: 1.5,   // 접촉 피해 쿨타임 (초)
    fovAngle:   90,    // 시야각 (도)
    fovRange:   2,     // 시야 거리 (타일)
    hearRange:  4,     // 청각 범위 (예약 — Step 4 소나 패널티)
  },

};
