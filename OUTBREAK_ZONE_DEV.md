# OUTBREAK ZONE — 개발 인수인계 문서 (Step 4 봉인)

## 프로젝트 개요

| 항목 | 내용 |
|------|------|
| 게임명 | OUTBREAK ZONE |
| 장르 | 2D 탑다운 서바이버 퍼즐 (지뢰찾기 + 좀비 + 로그라이크) |
| 플랫폼 | 웹 (CrazyGames) → Android Google Play |
| 개발 방식 | HTML5 Canvas + Vanilla JS |
| GitHub | https://github.com/baek2731/outbreak-zone (Private) |

---

## 핵심 컨셉 (확정)

> **"바이러스 구역에 침투한 정화 요원이 병원체를 탐지·제거하며 좀비를 피해 탈출한다"**

### 컨셉 전환 배경
초기 컨셉은 "지뢰찾기 + 좀비"였으나, Step 4 기획 과정에서 **"바이러스 구역 정화"** 로 컨셉을 확정했다.

- **지뢰** → 병원체 오염 구역 (밟으면 감염)
- **지뢰 해체** → 병원체 제거 (정화 행위)
- **소나** → 병원체 탐지기 (소나 소음이 좀비를 유인하는 이유가 생김)
- **소나 소음** → 탐지기 작동음 (좀비의 본능적 반응)
- **탈출 부품** → 정화 완료 후 탈출에 필요한 장비

이 전환으로 모든 메카닉에 서사적 이유가 붙었다. 직업 시스템, 스토리 분기도 자연스럽게 확장 가능.

### 코어 루프 (한 줄)
> "멈춰서 병원체를 탐지해야 하는데(소나), 멈추면 좀비가 다가온다. 소나를 쏘면 좀비를 유인할 수 있지만 그것도 위험하다."

이 긴장이 성립하면 게임이 된다. 소나가 이 긴장의 정중앙에 있다.

---

## 파일 구조 (Step 4 봉인 기준 — 3파일)

```
outbreak-zone/
├── index.html   ← HTML 구조 + 스타일 + script 태그만
├── config.js    ← 모든 수치 파라미터 (수치 조정은 여기만)
└── game.js      ← 게임 로직 전체 (맵/플레이어/소나/좀비/렌더링)
```

### game.js 내부 섹션 구조
```
RESOURCE LAYER     drawPlayer / drawZombie / drawItem / drawExit
                   drawSonarCharging / drawSonarPulse / drawSonarPings / drawSonarPreciseMarks
맵 생성            generateMap / _buildMap / shuffle
게임 상태 객체     player / sonar / zombies / MAP / VISITED / VISIBLE
초기화             init / resize
시야               revealAround / hasLOS
입력               processKeys / handleInput / tryMove / onStep
소나               fireSonar / updateSonar
좀비               spawnZombies / updateZombies / triggerNoise
                   zombieSense / zombieStep / zombieWanderVec
                   zombieMoveWithSlide / zombieNextStepDir / circleWallCollide
                   zombieSeparate / zombieContact
업데이트/렌더링    update / render / renderMinimap / updateHUD
DEV 패널           updateDevInfo / DEV 슬라이더·버튼
메인 루프          loop
```

---

## 작업 원칙

### 코드 수정 원칙
- 수정 시 항상 쓰레기코드 제거
- 다른 코드와 연결된 경우 전체 파악 후 수정
- 가능하면 문자열 교체보다 전면 재작성 방식 권장
- 수정 후 잔재 코드 검증 필수 (grep/count 확인)
- **상태 전환은 한 곳에서만** (좀비는 zombieSense가 유일한 상태 전환 지점)

### 커밋 메시지 방식
```
한글로 짧게
예시:
  스탭4 - BFS 길찾기 + 소음 유인
  스탭4 봉인 - 속도 복원, config 분리, 3파일 모듈화
```

### 피드백 방식
- 코드 수정 전 "피드백먼저" 요청 시 피드백만
- 방향성 파악 후 세부 피드백 없이 바로 수정 가능
- 피드백은 함수명 대신 기능으로 설명 (함수명은 개발자가 정함)
- 핵심만 간략히

### RESOURCE LAYER
- 렌더링 함수(drawXxx)는 RESOURCE LAYER로 분리
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
- 지뢰(병원체) 배치 (스폰 주변 2타일 안전 반경)
- 밟으면 HP -1 + 빨간 플래시
- HP 하트 아이콘 연동
- 게임오버 화면 + RETRY

### ✅ Step 2-B — 봉인 완료
- **기본 소나 [F키 홀딩]:** 병원체 인접 타일에 위험도 핑 (노랑/주황/빨강)
- **정밀 소나 [G키 홀딩]:** 병원체 타일에 X 표시 (횟수 소모)
- 소나 파장 애니메이션 (순차 점등)
- 핑 N초 후 페이드아웃
- 밟은 지뢰 제거 후 numbers 재계산
- HUD: 기본소나[F] / 정밀소나[G] 📡 카운터

### ✅ Step 2-C — 봉인 완료
- 아이템 타일 (탈출 부품 🔑) — 거리 구간 분산 배치
- 출구 타일 (🚪) — 스폰 최원거리 랜덤 배치 (고정 안 함)
- 탈출 조건 (N개 수집 → 출구 개방)
- 탈출 성공 화면 (#escaped)
- 아이템 수집 피드백: 초록 vignette + HUD 숫자 팝
- 미니맵: 아이템 노란 점 / 출구 잠금(어두움)→해제(밝은 초록)

### ✅ Step 3 — 봉인 완료
- 좀비 엔티티 (픽셀 단위 이동, 원형 충돌)
- **상태 머신:** WANDER / SEARCH / CHASE
- **인식:** 시야(FOV+LOS) / 근접(0.7타일)
- 좀비 시야 벽 관통 차단 (hasLOS)
- 좀비 간 분리 벡터 (겹침 방지)
- 스폰: 거리 구간 분산 배치
- 접촉 피해 (damageCooldown 통합 관리)
- 암흑 속 좀비 미렌더링 (VISIBLE 체크)

### ✅ Step 4 — 봉인 완료
- **소음 낚시 메카닉** (이번 Step의 핵심)
- **BFS 길찾기** (zombieNextStepDir — 좀비가 미로를 돌아서 이동)
- **원형 충돌체** (circleWallCollide — 코너 슬라이딩 자연화)
- **소음 이벤트 즉시 처리** (triggerNoise — 소나/지뢰 발생 시점에 좀비 반응)
- **좀비 청력 범위** (hearRange — config 연동, 소나 반경과 min으로 결정)
- **memoryTimer 일원화** (추격 기억 2.5초 / 소음 기억 6초)
- **주시 방향 = 시야 방향** (facingAngle 통일 — 스프라이트 대비)
- **DEV 가시화** (소음 발원지 마커, SEARCH 주황 / CHASE 빨강 색 구분)
- **3파일 모듈화** (index.html + config.js + game.js)
- **JS 파일 분리** (game.js 독립)

---

## 좀비 AI 상세 설계 (Step 4 기준)

### 상태 머신

```
WANDER  →  시야/근접 인식     →  CHASE
WANDER  →  소음 인식(낚시)    →  SEARCH
SEARCH  →  시야/근접 인식     →  CHASE
SEARCH  →  memoryTimer 소진   →  WANDER
CHASE   →  시야/근접 유지     →  CHASE (memoryTimer 재충전)
CHASE   →  memoryTimer 소진   →  SEARCH → WANDER
```

### 핵심 원칙
- **상태 전환은 zombieSense 한 곳에서만** (triggerNoise는 target 좌표만 심음)
- **이동은 BFS 방향 + 픽셀 슬라이딩** (타일 단위 아님)
- **끼임은 충돌 슬라이딩으로만** (상태 안 건드림)

### 소음 낚시 메카닉
- 소나/지뢰 발생 시 `triggerNoise(sourceX, sourceY, radiusTiles)` 즉시 호출
- 소음 범위 = `min(소나 반경, hearRange)` — 강하게 쏠수록 더 멀리 유인 가능
- CHASE 중인 좀비는 소음 무시 (추격 중단 방지)
- SEARCH 중인 좀비는 더 가까운 소음이 오면 목표 교체
- 소음 목표 도달 → facingAngle 회전(두리번) → memoryTimer 소진 → WANDER

### 좀비 상태 객체 필드
```javascript
{
  tx, ty,           // 현재 타일 좌표 (중심 기준 floor)
  px, py,           // 픽셀 좌표 (좌상단 기준)
  state,            // 'WANDER' | 'SEARCH' | 'CHASE'
  facingAngle,      // 주시 방향 (rad) = 시야 방향 = 스프라이트 방향
  targetWx, targetWy, // 현재 이동 목표 (월드 px)
  hasTarget,        // 목표가 있는지
  wanderTimer,      // 배회 방향 전환 타이머
  memoryTimer,      // 목표 기억 잔여 시간 (0 되면 WANDER 복귀)
}
```

### AI 함수 구조
```
updateZombies(dt)
├─ zombieSense()        // 인식 + 상태 전환 (유일한 전환 지점)
├─ zombieStep()         // 이동 결정 + 실행
│  ├─ zombieWanderVec() // WANDER 방향 벡터
│  ├─ zombieNextStepDir() // BFS 다음 타일
│  └─ zombieMoveWithSlide() // 픽셀 이동 + 원형 충돌 슬라이딩
├─ zombieSeparate()     // 좀비 간 분리 (순수 밀어내기)
└─ zombieContact()      // 플레이어 접촉 피해

triggerNoise()          // 소음 이벤트 (외부에서 호출)
```

---

## 소나 시스템 설계 (확정)

### 기본 소나 [F키 홀딩]
- 차징 시간에 따라 반경 결정 (minRadius~maxRadius)
- 병원체 인접 타일에 위험도 핑 (노랑 1개 / 주황 2개 / 빨강 3개+)
- 발동 시 소음 발생 → triggerNoise 호출
- **소음 범위 = min(소나 반경, hearRange)** — 강약에 따른 트레이드오프
- 무제한 사용

### 정밀 소나 [G키 홀딩]
- 병원체 타일에 X 표시 (정확한 위치)
- 시작 시 2개 지급, 소모품

### 소나 트레이드오프
- 정보 획득 / 위험 유발 / 유인 방향 제어 — 3겹이 한 행동에 묶임
- 강하게 쏠수록 더 많은 정보 + 더 큰 소음 (더 멀리 유인 가능)

---

## 미니맵 정책 (확정)

| 항목 | 표시 |
|------|------|
| 방문한 바닥/벽 | ✅ 항상 |
| 플레이어 위치 | ✅ 항상 |
| 발견한 아이템 | ✅ 노란 점 |
| 출구 위치 | ✅ 잠금(어두움)/해제(밝은 초록) |
| 병원체(지뢰) | ❌ 없음 |
| 좀비 | ❌ 레이더 사용 시만 N초 (Step 5 예정) |

---

## 확정 파라미터 (config.js 기준)

| 항목 | 값 |
|------|-----|
| 맵 크기 | 17 |
| 타일 크기 | 48px |
| 루프 경로 | 6 |
| 막다른 길 상한 | 30% |
| 이동 딜레이 | 0.25초 |
| 시야 반경 | 4타일 |
| 최대 HP | 3 |
| 병원체 밀도 | 8% |
| 소나 최소 차징 | 0.5초 |
| 소나 최대 차징 | 1.5초 |
| 소나 최소 반경 | 2타일 |
| 소나 최대 반경 | 4타일 |
| 핑 지속 시간 | 1.2초 |
| 정밀 소나 시작 수 | 2 |
| 탈출 아이템 수 | 3 |
| 좀비 수 | 2 |
| 좀비 속도 비율 | 0.30 |
| 좀비 스폰 거리 | 6타일 |
| 좀비 피해 쿨타임 | 1.5초 |
| 좀비 시야각 | 90° |
| 좀비 시야 거리 | 2타일 |
| 좀비 청력 범위 | 4타일 |
| 추격 기억 시간 | 2.5초 |
| 소음 기억 시간 | 6.0초 |
| 카메라 smooth | 0.12 |
| 미니맵 크기 | 80px |

---

## DEV 패널 기능 (실 게임 빌드 시 제거 예정)

### 슬라이더
맵 크기 / 타일 크기 / 루프 경로 / 이동 딜레이 / 시야 반경 / 최대 HP /
병원체 밀도 / 소나 최대 차징 / 스캔 반경 / 핑 지속 / 정밀 소나 수 /
필요 아이템 수 / 좀비 수 / 좀비 속도

### 버튼 (토글/액션)
- 🔄 맵 재생성
- 💣 병원체 표시 ON/OFF
- ❤ HP 전부 회복
- 📡 정밀 소나 +1
- 🔑 아이템 +1 획득
- 🛡 무적 모드 ON/OFF
- 👁 전체 밝히기 ON/OFF
- ☠ 좀비 전체 제거
- 👁 좀비 시야 표시 ON/OFF (WANDER 회색 / SEARCH 주황 / CHASE 빨강 부채꼴)

### DEV 소음 가시화
- 소나/지뢰 소음 발생 시 발원지에 주황 점 + 청력 범위 원이 3초간 표시
- 좀비 색: WANDER 회색 / SEARCH 주황(유인 중) / CHASE 빨강

### info
FPS / 현재 타일 / 병원체 수 / 아이템 수 / 좀비 수 / 막다른 길 비율 / 경과 시간

---

## 기획 확정 사항

- **대각선 이동:** 없음 (4방향 고정)
- **타일 크기:** 48px 고정
- **시야 방식:** 3단계 (완전밝음 / 그림자 / 암흑)
- **출구 위치:** 랜덤 (스폰 최원거리, 매 판 다름 — 로그라이크 감각)
- **좀비 충돌:** 원형 (렌더링과 일치)
- **주시 방향:** facingAngle (시야 = 주시 = 스프라이트 방향 일치)
- **소음 범위:** min(소나 반경, hearRange)
- **일자 통로 막힘 문제:** Step 5 아이템 도입으로 해소 예정

---

## 다음 단계 계획

### Step 4 봉인 후 즉시 (Step 5 전)

**베스트 기록 / 클리어 횟수**
지금은 죽으면 그냥 0으로 돌아간다. 베스트 타임 하나, 클리어 횟수 하나만 있어도 "한 판 더"의 동기가 생긴다. CrazyGames/모바일 리텐션의 핵심. Step 5보다 먼저 넣는 걸 강력 권장.

---

### Step 5 — 감염 + 탈출 고도화

- 물림 탈출 (F키 연타)
- 감염 시스템 (물린 횟수 → 상태이상)
- **병원체 제거 자유화** — 해체 시 소음 발생 → 좀비 집결 패널티
  - "해체는 쉬운데 대신 위험이 커진다"는 리스크/리워드
  - 소음 시스템과 자연스럽게 연동
- 방 클리어 → 다음 방 (스테이지)
- 병원체 밀도 스테이지별 증가 (1스테이지 8% → 점증)
- 좀비 레이더 시스템 (미니맵 좀비 위치 N초 표시)
- PATROL 상태 (경로 순찰)
- 소리 아이템 (낚시 확장 — Step 4에서 triggerNoise 기반 설계됨)

---

### Step 6+ — 콘텐츠 + 로그라이크

**직업 시스템**
- 정화 요원 / 의료 전문가 / 폭발물 처리반 등
- 직업마다 고유 능력 + 스토리 분기
- 직업별 시작 유물 / 장비 호환성 차이

**장비 시스템**
- 방어구, 무기류 — 직업과 연동
- 소나 코어 메카닉과 연동되는 설계
  - 예: "소나 횟수 +1", "이동 시 소음 감소", "병원체 밟아도 무효화 1회"

**유물 시스템 (로그라이크 핵심)**
- 판마다 랜덤 패시브 효과
- 스테이지 클리어 시 보상 선택 (3개 중 1개)
- 직업과 연동된 전용 유물

**이벤트 시스템**
- 저주/축복 이벤트
- 동료 시스템
- 와드 아이템

**점수 시스템**
- 스테이지 클리어 점수 + 생존 시간 + 클리어 횟수

---

### 플랫폼

- CrazyGames 배포 준비 (DEV 패널 제거)
- Android Google Play 포팅

---

## 발전 가능성 진단 (Step 4 봉인 시점)

### 핵심 컨셉 평가
상한선은 높다. "바이러스 구역 정화 + 실시간 생존"은 한 줄 피치가 명확하고 유니크하다. 비슷한 게임이 없다 — 지뢰찾기 로그라이크는 있지만 전부 턴제다. 실시간 좀비 AI + 소나 낚시 + 미로 탐색의 조합은 차별점이 있다.

### 핵심 리스크
Step 5에서 병원체 제거 자유화 + 아이템이 들어오기 전까지 "진짜 재미"를 판단하기 어렵다. 지금은 코어 메카닉(소나 긴장)이 성립하는지만 확인된 상태. 콘텐츠가 다 붙기 전에 로드맵대로 계속 추가하다 보면 "이 게임이 재미있는가"를 검증 안 한 채 규모만 커질 수 있다.

### 권장 우선순위
1. 베스트 기록/클리어 횟수 (리텐션 기반 — 지금 당장)
2. Step 5 병원체 제거 + 감염 (코어 완성)
3. 외부 플레이테스트 (개발자는 객관적 판단 불가)
4. Step 6 로그라이크 요소 (콘텐츠 확장)

---

## 코드 구조 핵심 메모

### 전역 상수
```
T             타일 타입 (WALL/FLOOR/MINE/ITEM/EXIT)
DIR4          4방향 배열
DMAZE         미로 생성용 4방향 배열
GAME_KEYS     preventDefault 적용 키 Set
ZOMBIE_RADIUS 좀비 충돌 반경 비율 (0.40)
```

### 게임 상태 객체
```
player    tx,ty,px,py,facing,hp,itemsFound,damageCooldown,noiseX,noiseY
sonar     charging,chargeTime,pings[],preciseMarks[],precise
zombies   [{tx,ty,px,py,state,facingAngle,targetWx,targetWy,hasTarget,
            wanderTimer,memoryTimer}]
MAP       {tiles,numbers,width,height,floorCount,mineCount,...}
VISITED   방문 타일 (미니맵용)
VISIBLE   현재 시야 타일 (렌더/좀비 표시용)
```

### 소음 시스템 확장 방법
새로운 소음 수단 추가 시 발생 지점에서 한 줄만 추가하면 된다:
```javascript
triggerNoise(sourceX, sourceY, radiusTiles);
```
`sourceX/Y`는 월드 픽셀 좌표, `radiusTiles`는 소음 도달 범위(타일).
CHASE 중인 좀비는 자동으로 무시, SEARCH 중인 좀비는 더 가까운 소음만 교체.

### RESOURCE LAYER 함수 목록 (스프라이트 교체 지점)
```
drawPlayer()
drawZombie()              // DEV 시야 부채꼴 포함, 색: WANDER회색/SEARCH주황/CHASE빨강
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
devNoiseMarker    DEV 소음 발원지 마커 {wx, wy, timer, r}
```
