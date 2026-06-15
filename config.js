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
    max:             100,
    drainPerStage:   [2, 3.5, 5.5, 7, 9],
    infectThreshold:  60,
    infectRate:        1.25,
    infectRateEmpty:   3.0,
    capsuleHeal:      33,
    stageHeal:        30,
  },

  sonar: {
    maxCharge:     1.5,
    minRadius:     2,
    maxRadius:     4,
    pingDuration:  1.2,
    pulseSpeed:    160,
    preciseCount:  2,
    radarDuration: 4.0,
  },

  // 스테이지 테이블
  // patrolThresholds: [1단계, 2단계, 3단계] — 제거 개수 기준
  // extraSpawn: 1단계 발동 시 추가 스폰 수
  stages: [
    { name:'외곽 병동',
      mapSize:15, mineCount:5,  zombieCount:1, capsuleCount:3, patternLen:3,
      combatMash:{ CHASE:6, SEARCH:4, WANDER:2 },
      patrolThresholds:[2, 3, 5], extraSpawn:1 },

    { name:'일반 병동',
      mapSize:17, mineCount:7,  zombieCount:2, capsuleCount:3, patternLen:3,
      combatMash:{ CHASE:7, SEARCH:5, WANDER:3 },
      patrolThresholds:[3, 5, 7], extraSpawn:1 },

    { name:'중환자실',
      mapSize:19, mineCount:9,  zombieCount:3, capsuleCount:4, patternLen:4,
      combatMash:{ CHASE:8, SEARCH:5, WANDER:3 },
      patrolThresholds:[3, 6, 9], extraSpawn:1 },

    { name:'바이러스 연구소',
      mapSize:21, mineCount:11, zombieCount:4, capsuleCount:4, patternLen:4,
      combatMash:{ CHASE:9, SEARCH:6, WANDER:4 },
      patrolThresholds:[4, 7, 11], extraSpawn:2 },

    { name:'발원지',
      mapSize:23, mineCount:13, zombieCount:5, capsuleCount:5, patternLen:5,
      combatMash:{ CHASE:10, SEARCH:7, WANDER:4 },
      patrolThresholds:[4, 8, 13], extraSpawn:2 },
  ],

  camera: { smooth: 0.12 },

  minimap: {
    size:    120,
    opacity: 0.85,
  },

  zombie: {
    speed:       0.30,
    spawnDist:   6,
    fovAngle:    90,
    fovRange:    2,
    hearRange:   4,
    chaseMemory: 2.5,
    noiseMemory: 6.0,
  },

};
