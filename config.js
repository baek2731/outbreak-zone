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
    // 실측 플레이테스트(풀강+5층, 전투2회+채집실패1회=55초만에 산소고갈+감염사) 기준 추가 완화.
    // 1~4층은 파밍/성장 구간으로 가볍게, 5층만 진검승부로 가는 컨셉 유지.
    drainPerStage:   [0.8, 1.1, 1.4, 1.8, 2.4],
    // 노출(exposed) 시스템 도입 이후 infectThreshold는 순수 UI 경고 기준선(산소바 색상/경고음)으로만 쓰임.
    // 실제 감염 시작 여부는 player.exposed 플래그(산소 정확히 0 도달)로만 결정됨 — game.js updateOxygenInfection() 참고.
    infectThreshold:  60,
    infectRate:        1.25,
    // infectRateEmpty는 더 이상 사용되지 않음(노출 시스템으로 대체).
    // 과거: 산소0 상태에서만 가속 감염. 현재: 산소>0이면 감염 전혀 없음 / 산소=0 도달 시 노출되어
    // 이후 산소 회복 여부와 무관하게 infectRate로 계속 진행, 치료제 완치(case1)로만 해제.
    infectRateEmpty:   3.0,
    capsuleHeal:      33,
    // 층 이동 시 산소 보충량.
    stageHeal:        45,
    // 층 이동 시 감염도 회복량 — 완전 청소가 아니라 약간의 숨통.
    infectStageRecover: 22,
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

  // 치료제
  serum: {
    initialCount:   1,      // 런 시작 시 보유량
    selfHealAmount: 10,     // 자가 사용 시 감염 감소량 (%)
    combatThreshold: 80,    // 전투 게이지 이 값 이상 시 선택지 등장
    choiceTime:      3.0,   // 선택지 표시 시간 (초)
    infectedDnaBonus: 5,    // 감염자 안식 시 DNA 보너스
  },

  // 전사자 풀
  fallen: {
    maxPerStage: 3,         // 층당 최대 전사자 수
  },

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
    speed:       0.40,
    spawnDist:   6,
    fovAngle:    90,
    fovRange:    2,
    noiseRadius: 4,
    chaseMemory: 2.5,
    noiseMemory: 6.0,
  },

  zombieTypes: {
    BASIC: {
      speed:0.40, fovAngle:90, fovRange:2,
      chaseMemory:2.5, color:'#553333', rushSpeed:null,
      sensorRange:0,
    },
    SENSOR: {
      speed:0.35, fovAngle:90, fovRange:2,
      chaseMemory:3.0, color:'#ffcc00', rushSpeed:null,
      sensorRange:3,
    },
    GUARD: {
      speed:0.35, fovAngle:110, fovRange:3,
      chaseMemory:3.5, color:'#0088ff', rushSpeed:null,
      sensorRange:0,
    },
    STALKER: {
      speed:0.55, fovAngle:90, fovRange:3,
      chaseMemory:8.0, color:'#8800ff', rushSpeed:null,
      sensorRange:0,
    },
    RUSHER: {
      speed:0.40, fovAngle:90, fovRange:2,
      chaseMemory:2.0, color:'#ff6600', rushSpeed:0.85,
      sensorRange:0,
    },
  },

  zombieComposition: [
    [{ type:'BASIC', count:1 }],
    [{ type:'BASIC', count:2 }],
    [{ type:'BASIC', count:2 }, { type:'SENSOR', count:1 }],
    [{ type:'BASIC', count:2 }, { type:'SENSOR', count:1 }, { type:'GUARD', count:1 }],
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
    // 감염 저항 — 완전차단 → 레벨별 감소율 (Lv1: 30%, Lv2: 50%)
    { id:'infectResist',     name:'감염 저항',  desc:'회수 성공 시 감염 증가 30/50% 감소',
      maxLv:2, costs:[15,25],
      effects: lv => ({ infectResistRate: lv === 1 ? 0.30 : lv === 2 ? 0.50 : 0 }) },
  ],

};
