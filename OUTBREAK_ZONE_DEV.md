# OUTBREAK ZONE — 개발 인수인계 문서

## 프로젝트 개요
- **게임명:** OUTBREAK ZONE
- **장르:** 2D 탑다운 서바이버 퍼즐 (지뢰찾기 + 좀비 + 로그라이크)
- **플랫폼:** 웹 (CrazyGames) → Android Google Play
- **개발 방식:** HTML5 Canvas + Vanilla JS
- **GitHub:** https://github.com/baek2731/outbreak-zone (Private)

---

## 파일 구조
```
outbreak-zone/
├── index.html   ← 게임 전체 로직 + 렌더링 (약 1340줄)
└── config.js    ← 파라미터 테이블 (수치 조정은 여기만)
```

---

## 작업 원칙

### 코드 수정 원칙
- 수정 시 항상 쓰레기코드 제거
- 다른 코드와 연결된 경우 전체 파악 후 수정
- 가능하면 문자열 교체보다 전면 재작성 방식 권장
- 수정 후 잔재 코드 검증 필수 (grep/count 확인)

### 커밋 메시지 방식
```
한글로 짧게
예시:
  스탭3 - 좀비 스폰, CHASE 이동, 접촉 피해
  스탭3 패치2 - 시야LOS, 소음인식, 분리흩어짐, 스폰분산
  스탭3 정리 - 쓰레기코드 제거 (DIR8, placed, _sonarWarmCtx)
```

### 피드백 방식
- 코드 수정 전 "코드수정없이 피드백먼저" 요청 시 피드백만
- 검증 요청 시 치명적 문제 아니면 '가능합니다'로 처리 후 수정
- 방향성 파악 후 세부 피드백 없이 바로 수정 가능
- 피드백 내용을 길게 나열하지 않고 핵심만

### RESOURCE LAYER
- 렌더링 함수 (drawXxx)는 RESOURCE LAYER로 분리
- 스프라이트 교체 시 해당 함수만 수정
- 모든 draw 함수는 ctx.translate(-camX,-camY) 적용 상태에서 호출
- **월드 좌표 그대로 사용 (camX/Y 빼지 않음)**

---

## 개발 단계 현황

### ✅ Step 1 — 봉인 완료
- 미로 맵 생성 (재귀 백트래커 + 루프 경로)
- WASD 이동 (타일 단위, 4방향)
- 3단계 시야 (완전밝음 / 그림자 / 암흑)
- 카메라 추적 (smooth)
- 미니맵 (방문한 곳만 표시, 80px 우하단)
- facing: 이동 불가여도 방향 즉시 업데이트
- 막다른 길 비율 체크 (30% 초과 시 재생성)

### ✅ Step 2-A — 봉인 완료
- 지뢰 배치 (스폰 주변 2타일 안전 반경)
- 지뢰 밟으면 HP -1 + 빨간 플래시
- HP 하트 아이콘 연동
- 게임오버 화면 + RETRY

### ✅ Step 2-B — 봉인 완료
- **기본 소나 [F키 홀딩]:** 지뢰 인접 타일에 위험도 핑 (노랑/주황/빨강)
- **정밀 소나 [G키 홀딩]:** 지뢰 타일에 X 표시 (횟수 소모)
- 소나 파장 애니메이션 (순차 점등)
- 핑 N초 후 페이드아웃
- 밟은 지뢰 제거 후 numbers 재계산
- HUD: 기본소나[F] / 정밀소나[G] 📡 카운터

### ✅ Step 2-C — 봉인 완료
- 아이템 타일 (탈출 부품 🔑) — 거리 구간 분산 배치
- 출구 타일 (🚪) — 스폰 최원거리 배치
- 탈출 조건 (N개 수집 → 출구 개방)
- 탈출 성공 화면 (#escaped)
- 아이템 수집 피드백: 초록 vignette + HUD 숫자 팝 (지뢰 빨강 플래시와 구분)
- 미니맵: 아이템 노란 점 / 출구 잠금(어두움)→해제(밝은 초록)

### ✅ Step 3 — 봉인 완료
- 좀비 엔티티 (픽셀 단위 이동, 벽 슬라이딩 충돌)
- **상태 머신:** WANDER / SEARCH / CHASE
  - WANDER: 랜덤 배회 (1.5~3.5초마다 방향 전환, 벽 유효 방향 우선)
  - SEARCH: 시야 잃으면 마지막 목격 위치로 이동 → 두리번 → 2초 후 WANDER
  - CHASE: 플레이어 추적
- **인식 3종:** 시야(FOV 각도 + LOS), 소음(noiseRadius), 근접(0.6타일)
- 좀비 시야 벽 관통 차단 (hasLOS 활용)
- 좀비 간 분리 벡터 (겹침 방지 + 흩어짐)
- 스폰: 거리 구간 분산 배치
- 접촉 피해 (player.damageCooldown 통합 관리)
- 암흑 속 좀비 미렌더링 (VISIBLE 체크)

#### Step 3 최적화/리팩토링 이력
- updateZombies 157줄 → 35줄 (상태별 함수 분리)
  - zombieSense / zombieMove(zombieChase/Search/Wander) / zombieSeparate / zombieApplyMove / zombieContact
- 매 프레임 공유 컨텍스트 객체(ctx2)로 전달
- 쓰레기코드 제거: DIR8, placed 배열, _sonarWarmCtx defineProperty

#### Step 3 난이도 너프 이력
- 지뢰 밀도 15% → 8%
- 좀비 수 3 → 2마리
- 근접 감지 1.2 → 0.6타일
- SEARCH 시간 3.5 → 2.0초
- 소나 소음 반경×1.5 → ×0.8, 지뢰 소음 8 → 5타일

---

## 플레이어 행동 → 소음(noiseRadius) 시스템
| 행동 | noiseRadius (타일) |
|------|------|
| 이동 | 0 (소리 없음) |
| 소나 발동 | 스캔 반경 × 0.8 |
| 지뢰 밟음 | 5 |

- noiseRadius는 매 프레임 `dt * 3`씩 감소
- 좀비는 noiseRadius 범위 안에 있으면 CHASE 전환 (벽 관통 인식)

---

## 다음 단계 계획

### Step 4 — 좀비 AI 고도화 + 소나 패널티
- PATROL (경로 순찰 상태 추가)
- 소나 패널티 고도화 (좀비가 소나 발원지로 유인되는 낚시 메카닉)
- 좀비 레이더 시스템
- 레이더 사용 시 미니맵 좀비 위치 N초 표시
- config: zombie.hearRange 활용 시작

### Step 5 — 감염 + 탈출 고도화
- 물림 탈출 F키 연타
- 감염 시스템 (물린 횟수 → 상태이상)
- 방 클리어 → 다음 방 (스테이지)
- 지뢰 밀도 스테이지별 증가 (1스테이지 8% → 점증)

### Step 6+ — 콘텐츠
- 점수 시스템
- 동료 시스템
- 와드 아이템
- 직업 시스템 (지뢰 해제 속도 차이)

### 플랫폼
- CrazyGames 배포 준비
- Android Google Play 포팅

---

## 확정 파라미터 (config.js 기준)

| 항목 | 값 | ID |
|------|----|----|
| 맵 크기 | 17 | A1 |
| 타일 크기 | 48px | - |
| 루프 경로 | 6 | A7 |
| 막다른 길 상한 | 30% | - |
| 이동 딜레이 | 0.25초 | B1 |
| 시야 반경 | 4타일 | B3 |
| 최대 HP | 3 | B2 |
| 지뢰 밀도 | 8% | A3 |
| 소나 최소 차징 | 0.5초 | C1 |
| 소나 최대 차징 | 1.5초 | C2 |
| 소나 최소 반경 | 2타일 | C3 |
| 소나 최대 반경 | 4타일 | C4 |
| 핑 지속 시간 | 1.2초 | - |
| 정밀 소나 시작 수 | 2 | - |
| 탈출 아이템 수 | 3 | - |
| 좀비 수 | 2 | - |
| 좀비 속도 비율 | 0.30 | - |
| 좀비 스폰 거리 | 6타일 | - |
| 좀비 피해 쿨타임 | 1.5초 | - |
| 좀비 시야각 | 90° | - |
| 좀비 시야 거리 | 2타일 | - |
| 카메라 smooth | 0.12 | - |
| 미니맵 크기 | 80px | - |

---

## 소나 시스템 설계 확정

### 기본 소나 [F키 홀딩]
- 지뢰 인접 타일에 위험도 핑
- 위험도: 노랑(1개) / 주황(2개) / 빨강(3개+)
- 벽 관통 스캔 (확정), 무제한 사용
- 발동 시 좀비 소음 인식 유발 (noiseRadius)

### 정밀 소나 [G키 홀딩]
- 지뢰 타일에 X 표시 (정확한 위치)
- 시작 시 2개 지급, 보급 상자에서 추가 (소모품)

---

## 미니맵 정책 확정
| 항목 | 표시 |
|------|------|
| 방문한 바닥/벽 | ✅ 항상 |
| 플레이어 위치 | ✅ 항상 |
| 발견한 아이템 | ✅ 노란 점 |
| 출구 위치 | ✅ 잠금(어두움)/해제(밝은 초록) |
| 지뢰 | ❌ 없음 |
| 좀비 | ❌ 레이더 사용 시만 N초 (Step 4) |

---

## 코드 구조 핵심 메모

### 전역 상수
```
T             타일 타입 (WALL/FLOOR/MINE/ITEM/EXIT)
DIR4          4방향 배열
DMAZE         미로 생성용 4방향 배열
GAME_KEYS     preventDefault 적용 키 Set
```

### 입력 처리
```
KEYS{}        방향키 전용
GAME_KEYS Set preventDefault 필터
F/G키         keydown(e.repeat 차단) / keyup(발동), KEYS와 완전 분리
processKeys() 게임오버 시 차징 취소만 담당
```

### 게임 상태 객체
```
player   tx,ty,px,py,facing,hp,itemsFound,damageCooldown,noiseRadius
sonar    charging,chargeTime,pings[],preciseMarks[],precise
zombies  [{tx,ty,px,py,state,wanderAngle,wanderTimer,facingAngle,lastSeenX/Y,searchTimer}]
MAP      {tiles,numbers,width,height,floorCount,mineCount,...}
VISITED  방문 타일 (미니맵용)
VISIBLE  현재 시야 타일 (렌더/좀비 표시용)
```

### 좀비 AI 함수 구조 (Step 3 리팩토링)
```
updateZombies(dt)              // 루프 + 공유 컨텍스트(ctx2) 생성
├─ zombieSense()               // 인식(시야/소음/근접) + 상태 전환
├─ zombieMove()                // 상태별 분기
│   ├─ zombieChase()           // 플레이어 추적
│   ├─ zombieSearch()          // 마지막 목격 위치 이동 + 두리번
│   └─ zombieWander()          // 랜덤 배회 (벽 유효방향 우선)
├─ zombieSeparate()            // 좀비 간 분리 벡터
├─ zombieApplyMove()           // 벽 슬라이딩 + 좌표 동기화
└─ zombieContact()             // 접촉 피해
```

### RESOURCE LAYER 함수 목록 (스프라이트 교체 지점)
```
drawPlayer()
drawZombie()              // DEV 시야 부채꼴 표시 포함
drawItem()
drawExit()
drawSonarCharging()
drawSonarPulse()
drawSonarPings()
drawSonarPreciseMarks()
```

### 캐시 변수
```
vignetteGradient  비네팅 그라디언트 (resize 시 재생성)
```

---

## DEV 패널 기능 (실 게임 빌드 시 제거 예정)
### 슬라이더
맵 크기 / 타일 크기 / 루프 경로 / 이동 딜레이 / 시야 반경 / 최대 HP /
지뢰 밀도 / 소나 최대 차징 / 스캔 반경 / 핑 지속 / 정밀 소나 수 /
필요 아이템 수 / 좀비 수 / 좀비 속도

### 버튼 (토글/액션)
- 🔄 맵 재생성
- 💣 지뢰 표시 ON/OFF
- ❤ HP 전부 회복
- 📡 정밀 소나 +1
- 🔑 아이템 +1 획득
- 🛡 무적 모드 ON/OFF
- 👁 전체 밝히기 ON/OFF
- ☠ 좀비 전체 제거
- 👁 좀비 시야 표시 ON/OFF (WANDER 회색 / SEARCH·CHASE 빨강 부채꼴)

### info
FPS / 현재 타일 / 지뢰 수 / 아이템 수 / 좀비 수 / 막다른 길 비율 / 경과 시간

---

## 기획 확정 사항
- **대각선 이동:** 없음 (4방향 고정)
- **타일 크기:** 48px 고정
- **시야 방식:** 3단계 (완전밝음 / 그림자 / 암흑)
- **좀비 인식:** 시야(FOV+LOS) / 소음 / 근접 3종
- **좀비/플레이어 속도 비율:** config.zombie.speed로 조정 (현재 0.30)
- **지뢰 해제:** 모든 직업 가능, 직업별 속도 차이 (Step 6)
- **물림 탈출:** F키 연타 (Step 5 예정)
- **와드 아이템:** Step 6 이후 예약
