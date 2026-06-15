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

  // 기본 좀비 파라미터 (BASIC 타입 기준)
  zombie: {
    speed:       0.40,
    spawnDist:   6,
    fovAngle:    90,
    fovRange:    2,
    noiseRadius: 4,   // 병원체 실패 등 일반 소음 반경 (타일)
    chaseMemory: 2.5,
    noiseMemory: 6.0,
  },

  // 특수 좀비 타입 정의
  zombieTypes: {
    BASIC: {
      speed:0.40, fovAngle:90, fovRange:2,
      chaseMemory:2.5, color:'#553333', rushSpeed:null,
      sensorRange:0,   // 소나 파동 도달 시 반응 (추가 감지 범위 없음)
    },
    SENSOR: {  // 청각형 — 소나 파동 범위 밖에서도 감지 가능
      speed:0.35, fovAngle:90, fovRange:2,
      chaseMemory:3.0, color:'#ffcc00', rushSpeed:null,
      sensorRange:3,   // 소나 반경 + 3타일 추가 감지
    },
    GUARD: {   // 순찰형 — 병원체 주변 지킴, 시야 넓음
      speed:0.35, fovAngle:110, fovRange:3,
      chaseMemory:3.5, color:'#0088ff', rushSpeed:null,
      sensorRange:0,
    },
    STALKER: { // 추적형 — 한번 보면 오래 쫓음
      speed:0.55, fovAngle:90, fovRange:3,
      chaseMemory:8.0, color:'#8800ff', rushSpeed:null,
      sensorRange:0,
    },
    RUSHER: {  // 돌진형 — CHASE 시 빠름
      speed:0.40, fovAngle:90, fovRange:2,
      chaseMemory:2.0, color:'#ff6600', rushSpeed:0.85,
      sensorRange:0,
    },
  },

  // 스테이지별 좀비 구성 [{ type, count }]
  zombieComposition: [
    // 1층: 기본만
    [{ type:'BASIC', count:1 }],
    // 2층: 기본만
    [{ type:'BASIC', count:2 }],
    // 3층: 기본 + 청각형
    [{ type:'BASIC', count:2 }, { type:'SENSOR', count:1 }],
    // 4층: 기본 + 청각형 + 순찰형
    [{ type:'BASIC', count:2 }, { type:'SENSOR', count:1 }, { type:'GUARD', count:1 }],
    // 5층: 기본×1 + 센서×1 + 추적형 + 돌진형 + 순찰형
    [{ type:'BASIC', count:1 }, { type:'SENSOR', count:1 }, { type:'STALKER', count:1 }, { type:'RUSHER', count:1 }, { type:'GUARD', count:1 }],
  ],

};

// ── 로비: 스테이터스 / 특성 정의 ─────────────────────────────────
const LOBBY = {

  status: [
    { id:'maskDura',   name:'방독면 내구도', desc:'산소 최대치 증가',
      maxLv:3, costs:[5,10,20],
      effects: lv => ({ oxygenMaxBonus: lv * 0.10 }) },
    { id:'oxyFilter',  name:'산소 필터',    desc:'산소 감소 속도 감소',
      maxLv:3, costs:[5,10,20],
      effects: lv => ({ oxygenDrainMult: 1 - lv * 0.08 }) },
    { id:'antivirus',  name:'항바이러스',   desc:'감염 시작 임계값 하향',
      maxLv:2, costs:[8,15],
      effects: lv => ({ infectThresholdBonus: lv * 5 }) },
    { id:'bodyTrain',  name:'체력 단련',    desc:'전투 게이지 증가량 상승',
      maxLv:3, costs:[8,15,25],
      effects: lv => ({ combatPowerBonus: lv * 3 }) },
    { id:'suitUp',     name:'방호복 강화',  desc:'전투 후 무적 시간 증가',
      maxLv:2, costs:[8,15],
      effects: lv => ({ postCooldownBonus: lv * 0.5 }) },
    { id:'capsuleUp',  name:'산소 캡슐 개량', desc:'캡슐 회복량 증가',
      maxLv:2, costs:[8,15],
      effects: lv => ({ capsuleHealBonus: lv * 0.10 }) },
  ],

  trait: [
    { id:'preciseDismantle', name:'정밀 해체',  desc:'병원체 회수 패턴 길이 감소',
      maxLv:2, costs:[12,20],
      effects: lv => ({ patternLenMinus: lv }) },
    { id:'noiseSuppressor',  name:'소음 억제',  desc:'회수 실패 소음 반경 감소',
      maxLv:2, costs:[10,18],
      effects: lv => ({ noiseRadiusMinus: lv }) },
    { id:'sonarAmp',         name:'소나 증폭',  desc:'소나 최대 반경 확장',
      maxLv:2, costs:[12,20],
      effects: lv => ({ sonarRadiusBonus: lv }) },
    { id:'infectResist',     name:'감염 저항',  desc:'회수 성공 시 감염 증가 없음',
      maxLv:1, costs:[20],
      effects: lv => ({ noInfectOnSuccess: lv >= 1 }) },
  ],

};
