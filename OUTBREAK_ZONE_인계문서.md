# OUTBREAK ZONE — 통합 인계 문서

> **다음 세션 시작 시**: 이 파일 + game.js / index.html / config.js / sound.js 함께 제공하면 맥락 없이 바로 이어서 작업 가능.
> **배포**: https://baek2731.github.io/outbreak-zone
> **파일 규모**: game.js 5688줄 / index.html 982줄 / config.js 174줄 / sound.js 444줄
> **로컬 실행**: `python -m http.server` (file:// 는 CORS로 사운드 404)

---

## 1. 게임 개요 & 설계 철학

**장르**: 브라우저 탑다운 로그라이크 서바이벌. 지뢰찾기 메카닉 기반 병원체 회수 + 좀비 공포.
**출품 목표**: CrazyGames. **모바일 가로 고정** 확정.

**핵심 정체성**: 플레이어는 무기를 들지 않는다. 좀비를 "죽이는" 게 아니라 "뿌리치고 도망"이다. 유일하게 능동적으로 좀비에게 영향을 주는 수단은 **치료제(구원)** 뿐이다. "무력함"이 공포의 핵심이다.

### 세계관
- **상부조직(ORIGIN)** → 요원(플레이어)을 소모품으로 파견. 요원은 진실을 모름.
- **적 2종**:

| 구분 | 정체 | 전투 승리 | 치료제(Y) |
|------|------|----------|----------|
| **크리쳐** `[C]` 빨강 | ORIGIN 피조물, 인류의 적 | 워프로 이탈 | 무효 + 새 크리쳐 강제 스폰 |
| **감염자** `[I]` 보라 | 감염된 전 동료(전사자) | 소멸 + 크리쳐 대체 스폰 | 안식 + DNA보너스 + 전사자 풀 제거 |

**플레이어의 근본 질문**: "눈앞의 이것은 진짜 인간이었나, 크리쳐인가" — 정밀소나(G)로 식별한다.

### 치료제 이중구조
```
치료제 1개 어디에 쓸 것인가?
├── 내 감염도 회복(D키) → 생존 우선
├── 감염자(동료) 안식(Y키) → 구원 + 전사자 풀 청소 + DNA
└── 아낀다 → 다음을 대비
```
크리쳐에게 쓰면 낭비 → 정밀소나의 가치가 자원 관리와 직결됨.

### 엔딩
- **감염사**: 보라 오버레이 페이드인 → 좀비 전환 패널
- **ALL CLEAR (5층)**: 터미널 타이핑(ORIGIN 기밀 문서) → 빨간 눈 → TO BE CONTINUED

---

## 2. 전사자 시스템

**핵심**: 플레이어가 감염사하면 전사자로 기록 → 다음 런에 그 층에서 감염자(좀비)로 등장. **자신의 죽음이 자신의 미래를 위협**.

**악순환 방지 장치**:
1. 층당 최대 3명 상한 (`CONFIG.fallen.maxPerStage`)
2. 치료제 안식 = 전사자 풀 청소 (패널티를 플레이어가 직접 끊을 수 있음)
3. 전임자 사전등록으로 첫 런부터 감염자 조우 보장 (신규 플레이어 보호)

**사전등록된 전임자 (현재 8명)**:
| unit | stage | name | cause |
|------|-------|------|-------|
| 0 | 1 | ECHO | lost → 정밀소나 식별 시 swarmed로 갱신 |
| -1 | 2 | CIPHER | silence |
| -2 | 2 | NOMAD | lost |
| -3 | 3 | DRIFT | unknown |
| -4 | 3 | WISP | lost |
| -5 | 4 | FROST | silence |
| -6 | 4 | HALCYON | unknown |
| -7 | 5 | EMBER | lost |
| -8 | 5 | VESPER | silence |

> UNIT-00(ECHO)는 `goToLobbyFromTutorial()` 호출 시 전사자풀에 등록됨 (cause:'lost'로 시작, 본게임에서 정밀소나 식별 시 'swarmed'로 갱신). 다른 전임자는 `seedPredecessors()`가 스크립트 로드 시 자동 등록.

**코드네임 풀 (42개)**: ECHO, CIPHER, NOMAD, DRIFT, WISP, FROST, EMBER, ASHEN, HAZE, MIST, DUSK, DAWN, VESPER, LUMEN, HALCYON, GLEAM, HALO, SWIFT, WREN, LARK, FINCH, SPARROW, DOVE, HEATH, BRACKEN, THISTLE, CLOVER, REED, FERN, ASH, ELM, BIRCH, MAPLE, CEDAR, HAZEL, JUNIPER, MOSS, LICHEN, SPORE, ALOE, BRIAR, HOLLOW

---

## 3. 플레이어 코드네임 시스템

- 첫 기지 입장 시 + 사망/감염 후 재출격 시마다 `#name-input-modal` 표시 (건너뛰기 없음)
- 한글/영문/숫자, 최대 10자, 빈칸 제출 차단
- 사망/감염 시 이름이 전사자풀(`addToFallenPool`)과 런 기록(`saveRunRecord`)에 함께 저장
- 로비: 이름 위주 표시 (UNIT-NN 보조표기 없음)
- `getPlayerName()` / `setPlayerName()` — 현재 유닛 번호와 묶어서 저장 (유닛 바뀌면 이름도 새로 받아야 함)

---

## 4. 튜토리얼 (UNIT-00 = ECHO, 완료)

### 전체 흐름
```
world_intro (풀스크린 암전, Space/탭)
→ 도착보고(Space) → 산소안내("생존시간 약50초", Space) → 이동지시(자동진행)
→ moving → sonar_prompt (F차징, 자동진행)
→ sonar_result ("채집 시작. 병원체 위치로 이동 후 채집") → mine_collect(A) → mine_collect_2(B)
→ serum_prompt (Y/N, 5초 타임아웃→N)
   ├ Y → serum_use_wait (D키 안내, silent) → D입력 → 실제 치료제 적용
   └ N → "이건 내가 쓸 게 아니야. 그들을 위해..."
→ sonar_prompt_2 → sonar_result_2 ("탐지된 병원체 위치로 이동")
→ mine_collect_3 (C = 좀비 습격 트리거)
→ ambush ("제기랄, 괴물과 조우했다!!" — serum 유무로 대사 분기)
→ [전투: F연타 10번 안팎, 80% 시점 Y/N(7초), 결과 무관 크리쳐 제거로 수렴]
→ aftermath (화이트플래시 + 카메라컷 → 7×7 독립 개방 공간으로 이동)
→ precise_prompt ("정밀소나 사용" + [G]키 안내, 타이핑 완료 후 G키 활성화)
→ [G키 누르는 즉시 대화창 닫힘] → precise_revealed (좀비 28마리 배치, 식별 사운드 2~4회)
→ [2초 대기] → "...제기랄" (2.2초 체류) → 암전 → 비명 → 타이틀
```

### 맵 구조
```
TUT_MAP_W=36, TUT_MAP_H=9
TUT_START_TX=3, TUT_START_TY=4
TUT_SONAR_TRIGGER_TX = 7
TUT_MINE_TX = 9 (A: y=3, B: y=5)
TUT_MINE_C_TX = 12, TUT_MINE_C_TY = 4 (단독, 좀비 습격 트리거)
TUT_AMBUSH_SPAWN_TY = 7 (C에서 3칸 아래)
전투 후 이동 공간: TUT_VOID_ROOM_X0=15~X1=35, Y0=0~Y1=8 (중앙: TUT_VOID_ROOM_TX=25, TY=4)
```

### 중요 상수
```
TUT_COMBAT_TIME_MULT = 2.2    (8.8초, 본게임 4초보다 여유)
TUT_COMBAT_PLAYER_POWER = 11  (F 1회당 게이지. 본게임 18보다 낮음 — 10번 목표)
TUT_SERUM_CHOICE_TIME = 7.0   (전투 중 선택지 결정시간. 본게임 3초보다 여유)
```

### 진입/종료
- `getCurrentUnit() === 0` → `startTutorial()` 자동 진입
- 완주 시 `goToLobbyFromTutorial()` → UNIT-00(ECHO) 전사자풀 등록 → `incrementUnit()` → `showTitle()`

---

## 5. 키 매핑

| 컨텍스트 | 키 | 기능 |
|---------|----|------|
| 전역 | ESC | 일시정지 토글 |
| LOBBY | Space | 작전 개시 |
| PLAYING | 방향키 | 이동 / 미니게임 패턴 |
| PLAYING | F | 소나 차징/발사 / 전투 연타 |
| PLAYING | G | 정밀소나 (진영·인식표 식별) |
| PLAYING | E | 병원체 회수 미니게임 |
| PLAYING | D | 치료제 자가 사용 (마지막 1개면 중앙 Y/N 확인창) |
| 전투 80% 선택지 | Y / N | 치료제 투여 / 계속 싸우기 |

**입력창 포커스 가드**: keydown 핸들러 최상단에서 INPUT/TEXTAREA 포커스 시 게임 키 전부 무시.

**모바일**: 조이스틱(이동) + 액션버튼(G/D/E/F) + 일시정지. Y/N은 화면 중앙 패널로 통일.

---

## 6. 중앙 Y/N 패널 시스템 (모바일 핵심)

**모든 선택지를 `showTutChoiceCenter(yLabel, nLabel, subLabel)`로 통일** (튜토리얼 + 본게임):
- 튜토리얼 평시 치료제 선택 (5초 타임아웃)
- 튜토리얼/본게임 전투 강제선택 80% (3초/7초)
- 본게임 마지막 1개 자가사용 확인 (`PLAYER_SERUM_CONFIRM_ACTIVE`)

**모바일 버그 해결 과정 (중요 — 다시 건드리면 재발):**
1. **캔버스 GPU 합성 레이어 문제**: 패널 표시 시 `canvas.style.pointerEvents='none'` → 숨김 시 `''`로 복원 (`hideTutChoiceCenter()` + `resetTutorialVisualState()`에서 복원, 두 함수 모두 건드리면 복원 처리도 확인 필요)
2. **transform 터치 판정 불일치**: `left:50%; top:46%; transform:translate(-50%,-50%)` → `position:absolute; inset:0; display:flex; align-items:center; justify-content:center`로 교체. 이걸 다시 transform으로 되돌리면 모바일에서 터치가 canvas로 가버림.
3. **이벤트 위임 + Pointer Events 안전망**: `#tcc-panel`에 touchstart/click/pointerdown 세 가지 모두 걸어둠.

---

## 7. 유닛 번호 로직

- `advanceUnitIfNeeded()`: **사망/감염 시에만** `incrementUnit()` — 생존 귀환/첫 시작(null)은 유지
- `retire`/`early` 구분: `_exitChoiceMode = 'full'`(전부 회수) / `'partial'`(미회수 후 후퇴)
- **로컬스토리지**:
  - `outbreak_unit_number`: 현재 유닛 번호
  - `outbreak_player_name` + `outbreak_player_name_unit`: 이름 + 그 이름이 속한 유닛 (유닛 바뀌면 이름 무효화)
  - `outbreak_last_exit_type`: retire / early / death / infected

---

## 8. 통합 정리 함수 & 상태 관리

`resetTutorialVisualState()` — `showTitle()` / `startTutorial()` / `startGame()` / 예외 종료 경로 전부에서 호출:
- `TUT_VIGNETTE` 리셋
- `zombies = []`
- 미니맵 표시 복원
- 화이트플래시 opacity=0
- `hideTutorialBox()` + `hideTutChoiceCenter()` (캔버스 pointer-events 복원 포함)

`GAME_STATE` 흐름: `TITLE → TUTORIAL_INTRO → PLAYING(튜토) → TITLE → LOBBY → INTRO → PLAYING → ESCAPED/GAMEOVER/LOBBY`

---

## 9. 로컬스토리지 키 전체

| 키 | 내용 |
|----|------|
| `outbreak_unit_number` | 현재 유닛 번호 |
| `outbreak_player_name` | 현재 요원 이름 |
| `outbreak_player_name_unit` | 이름이 속한 유닛 번호 |
| `outbreak_last_exit_type` | retire / early / death / infected |
| `outbreak_fallen_pool` | 전사자풀 `[{unit, stage, cause?, ts?, name?}]` |
| `outbreak_run_records` | 런 기록 `[{exitType, unit, name?, stage, stageName, elapsed, rawCollected, collected, infection}]` |
| `outbreak_total_dna` | 누적 DNA |
| `outbreak_upgrades` | 강화 트리 |
| `outbreak_unit_actions` | 안식/소멸 행동 로그 `[{unit, action, stage, name?, ts}]` |

**초기화**: `localStorage.clear()` 후 Ctrl+Shift+R. 유닛만: `localStorage.removeItem('outbreak_unit_number')`.

---

## 10. 주요 코드 위치

| 기능 | 위치 |
|------|------|
| 튜토리얼 대사 배열 | game.js ~3040 (`TUT_*_LINES` 상수) |
| 중앙 Y/N 패널 표시/숨김 | `showTutChoiceCenter()` / `hideTutChoiceCenter()` |
| `handleChoiceY/N` | game.js ~1978 |
| 전사자풀 헬퍼 | `loadFallenPool` ~2616 |
| `fallenLabel(unitNum)` | game.js ~2639 (이름 있으면 이름, 없으면 UNIT-NN) |
| 전임자 시드 데이터 | `PREDECESSOR_SEED` ~2674 |
| 전임자 시드 함수 | `seedPredecessors()` ~2684 (마이그레이션 로직 포함) |
| 플레이어 이름 저장/조회 | `getPlayerName()` / `setPlayerName()` ~2715 |
| 이름 입력 모달 JS | `showNameInputModal()` / `confirmPlayerName()` ~2730 |
| 이름 입력 모달 HTML | `#name-input-modal` |
| 임무일지 표시 | `renderLobby('journal')` ~2990 |
| 런 기록 저장 | `saveRunRecord()` ~2552 |
| 유닛 번호 로직 | `advanceUnitIfNeeded()` ~2773 |
| 통합 정리 함수 | `resetTutorialVisualState()` ~2973 |
| 스테이지 인트로 | `showStageIntro()` ~3695 |
| 키보드 포커스 가드 | `window.addEventListener('keydown', ...)` 최상단 |
| 비네팅 시스템 | `TUT_VIGNETTE` ~975, `collapseVignetteTo()` ~1012 |
| CAUSE 라벨/아이콘 | game.js ~2984 (lost/silence/unknown/swarmed 4종) |

---

## 11. 남은 작업

### 🔴 최우선 — 본게임 플레이테스트
이번 대화에서 튜토리얼·모바일·코드네임 시스템이 전부 완성됐고, **본게임 자체(스테이지 1~5)가 아직 검증 안 된 상태**. 플레이하면서 메모해야 할 것:
- 스테이지별 난이도 곡선 (너무 쉽다/어렵다)
- 좀비 구성/패턴 (스테이지별 수/타입)
- DNA 보상 체계 적절성
- 산소/감염 곡선 체감
- 강화 트리 효과값
- 각 스테이지 적정 플레이 시간

### 🟡 출시 전 정리 (플레이테스트 후)
- `console.log('[RESIZE]', ...)` 제거 (game.js 1300줄)
- `#ts-test-reset` 버튼 제거 (index.html 637줄 + game.js 5493줄 부근) — "TEST ONLY" 마커 있음

### 🟢 선택 작업 (여유 있을 때)
- 사운드 파일 실존 여부 확인 (`sound.js`가 로드 시도하는 mp3들)
- `STALKER` 치료 미니게임 (피습사 감염체 전용 추가 패턴)
- 유물 시스템 (LOBBY 잠긴 탭)
- 스프라이트 교체 (현재 전부 도형)
- 감염 진행도별 치료/안식 분기 (기획에는 있으나 미구현)
- 타이핑 엔진 3중 복제 통합 (엔딩터미널/풀스크린인트로/하단대화창)

---

## 12. 작업 관습

- **매 코드 변경 후 한 줄 한글 커밋메시지** (feat/fix/refactor 접두사)
- `node --check game.js` + getElementById vs HTML id 무결성 + `<div>` 균형 검사 필수
- 코드 수정 없이 피드백만 요청받는 경우 — 코드 수정 안 함, 명시적 진행 지시 후 착수
- 캐시 이슈 잦음 → Ctrl+Shift+R / 모바일은 캐시 삭제 후 재접속

---

## 13. 시스템설계 문서 갱신 사항 (변경 내용만 기록)

구버전 `시스템설계.md`의 갭 항목 중 해결된 것:

| 항목 | 구버전 상태 | 현재 상태 |
|------|-----------|---------|
| UNIT-00 전사자풀 등록 | `goToLobbyFromTutorial()`에 없음 | ✅ 완료 |
| 치료제 이중구조 구현 | 설계 단계 | ✅ 완료 |
| 전투 80% 선택지 | 설계는 50% | ✅ 80%로 구현 완료 |
| 전사자풀 → 감염자 소환 | 구현됨 | ✅ 이름(코드네임)까지 반영 |
| 튜토리얼 완성 | 구현됨 | ✅ 완전 완료, 모바일도 검증 |
| 모바일 Y/N 입력 | 미검증 | ✅ 해결 (캔버스 터치 차단 + flex 정렬) |
| 모바일 타일/줌 이슈 (6-2) | 미해결 | ⚠️ 해결 여부 불명확 — 플레이테스트 중 확인 |
| ensureUnit00Fallen() 처리 | 재검토 필요 | ✅ goToLobbyFromTutorial에서 정식 처리, 해당 함수 역할 흡수됨 |
| 구현 우선순위 8번(튜토리얼) | "완료, 메타 연결 미구현" | ✅ 메타 연결도 완료 |

시스템설계.md의 **기획 철학(무력함, 식별, 치료제 이중구조, 전사자 시스템 설계 근거)** 은 여전히 유효하며 이 문서와 병용 가능.
