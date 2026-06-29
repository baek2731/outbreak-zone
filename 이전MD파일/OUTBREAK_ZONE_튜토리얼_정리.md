# OUTBREAK ZONE — 튜토리얼 개발 정리 (인계 문서)

> 이 문서는 길어진 대화를 정리해 다음 대화에서 이어서 작업하기 위한 인계 자료입니다.
> 파일 위치: 작업본 `/home/claude/work/`, 출력본 `/mnt/user-data/outputs/` (game.js, index.html, config.js, sound.js)
> 배포: https://baek2731.github.io/outbreak-zone

---

## 1. 게임 개요

브라우저 탑다운 3/4뷰 로그라이크. 지뢰찾기 메카닉(인접 병원체 수=숫자) 기반 병원체 회수 + 좀비 공포. 출품 목표 CrazyGames(모바일 가로).
로컬 실행: `python -m http.server` (file://는 CORS로 사운드 404 발생).

**세계관**: 상부조직 → ORIGIN(건물, 크리쳐 생성) → 요원(플레이어, UNIT번호).
적 2종 — **크리쳐**(치료제 무효, 전투승리 시 워프이탈) / **감염자**(전 동료=전사자, 치료제로 안식+DNA보너스). 정밀소나(G키)로 식별. "무력함"이 핵심 재미.

**작업 관습**:
- 매 코드변경 후 한 줄 한글 커밋메시지(fix/feat/refactor 접두사)
- `node --check game.js` + DOM id 무결성(getElementById 참조 vs 실제 id) + `<div>` 균형 검사 필수
- 캐시 이슈 잦음 → Ctrl+Shift+R 안내
- **초기화 콘솔명령**: `localStorage.clear()` 후 Ctrl+Shift+R (유닛 번호만 지우려면 `localStorage.removeItem('outbreak_unit_number')`)

---

## 2. 튜토리얼 전체 흐름 (현재 최종본)

```
world_intro (풀스크린 암전, Space)
 → move_intro (도착보고, Space) → 산소안내(Space) → 이동지시(자동진행, 이동시작시 닫힘)
 → moving → sonar_prompt (F차징, 자동진행)
 → sonar_result (오렌지+옐로우 언급, 자동진행) → mine_collect (1번째 A)
 → mine_collect_2 (2번째 B) → [결과표시 1초 대기]
 → serum_prompt (Y/N 선택, 플레이어 위 UI, 5초 타임아웃→N)
    ├─ Y → serum_use_wait (D키 안내, silent) → D입력 → useSerumSelf() 실제 적용
    └─ N → "이건 내가 쓸 게 아니야..." (timer 자동진행)
 → sonar_prompt_2 (소나 재사용 안내, 자동진행)
 → sonar_result_2 → mine_collect_3 (3번째 C = 좀비 습격 트리거)
 → ambush (전투 시작: "코드레드!" timer → player.serum 분기 timer)
 → [전투: F연타 10번 안팎, 80%서 Y/N선택지(7초), 시간초과/N선택 모두 페널티없이 좀비 제거로 수렴]
 → aftermath (화이트플래시→정적→비네팅강한수렴)
 → precise_prompt ("미확인 크리쳐 접근...정밀소나 사용" + [G]키 안내, silent)
 → [G입력] → precise_revealed (좀비 6마리 스폰, 비네팅을 소나 핑 확산 비율에 직접 연동해 해제)
 → "...제기랄" (timer) → 암전 → 비명 → 타이틀
```

**진입조건**: `localStorage.outbreak_unit_number === 0` → `startTutorial()`. 완료 시 `incrementUnit()` → `showTitle()` → 정상 플로우(타이틀→기지).

---

## 3. 맵 구조 (현재 최종본)

```
TUT_MAP_W=18, TUT_MAP_H=9
TUT_START_TX=3, TUT_START_TY=4          시작점(십자 1칸 개방)
TUT_SONAR_TRIGGER_TX = START+4 = 7      소나 안내 트리거 지점
TUT_MINE_TX = TRIGGER+2 = 9             병원체 A/B의 x좌표
TUT_MINE_TY_A = START_TY-1 = 3          병원체 A(통로 위) — 1번째 회수
TUT_MINE_TY_B = START_TY+1 = 5          병원체 B(통로 아래) — 2번째 회수
TUT_MINE_C_TX = MINE_TX+3 = 12          병원체 C(단독 배치)
TUT_MINE_C_TY = START_TY = 4
TUT_CORRIDOR_END_TX = MINE_C_TX+1 = 13  통로 끝
TUT_AMBUSH_SPAWN_TY = MINE_C_TY+3 = 7   습격 좀비 출발지(C 아래 3칸, 멀리서 달려옴)
```

A/B는 인접 배치 → 통로 타일에서 danger=2(오렌지) 시연. 통로 전이구간 일부는 danger=1(옐로우)이 자연 발생 — 텍스트에서 "약한 반응(옐로우)도 감지됩니다"로 언급. C는 단독 배치(주변 병원체 없음), 좀비 습격 트리거. **맵 생성 시 좀비 습격통로 루프는 `MINE_TY_B/C + 1`부터 시작해야 함**(과거 버그: +0부터 시작하면 MINE 타일 자체를 FLOOR로 덮어씀).

`mineCount: 3` (맵 객체 자체 — HUD 표시는 별도 하드코딩, 아래 5-3 참조).

---

## 4. 핵심 시스템/상수

### 텍스트 진행 방식 (`showTutorialLine(lines, onDone, autoAdvance)`)
- `autoAdvance` 생략(false): Space 대기. 타이핑 완료 후에만 힌트(`[Space-다음]`) 표시 + Space로 진행. **타이핑 중 Space로 즉시완성하는 기능은 제거됨**(요청에 따라 — 템포 유지).
- `true`: 자동진행. 타이핑 완료 즉시 `onDone()` 호출(텍스트는 화면에 남음, 별도 트리거로 닫힘).
- `'timer'`: 시간기반 자동진행. 최소체류시간(글자수×35ms, 최소 1.3초) 후 자동으로 fade-out + onDone.
- `'silent'`: 외부 키 입력(G/D)으로만 진행. 힌트 표시 안 함.

텍스트는 `textNode`(텍스트노드) + `cursorEl`(커서 span, **텍스트노드 옆이 아니라 텍스트 div 안쪽**) 구조. `typeNext()`에 `if (typingDone) return` 가드 — 즉시완성 후 예약된 타이머가 중복 출력하는 것 방지.

`_tutBoxToken`: `'timer'` 모드 연속 호출 시(예: 코드레드→치료제유무 대사 연달아) 첫 텍스트의 뒤늦은 정리 setTimeout이 이미 새로 뜬 두 번째 텍스트의 `show` 클래스를 지워버리는 버그 방지용 토큰.

### 비네팅 (`TUT_VIGNETTE = {active, mode, radius, pulseT}`)
- `mode:'mild'` — 회수 중 약한 비네팅(반경 약 2.2칸)
- `mode:'aftermath'` — 전투 후 강한 비네팅, 0.15~0.35 사이 펄스(숨쉬듯)
- `mode:'precise_release'` — 정밀소나 핑 확산 비율(`sonar.pulseR/sonar.pulseMaxR`)에 비네팅 반경을 직접 매핑해 1:1로 풀림

`drawTutorialVignette()`는 `render()`에서 미니게임보다 먼저(카메라 변환 일시 해제 후 화면좌표로) 그려야 미니게임이 비네팅 위에 보임.

### 전투 난이도 (F 10번 안팎 목표)
- `TUT_COMBAT_PLAYER_POWER = 11` (F 1회당 게이지 증가. 본게임은 18에서 스테이지별 감소)
- `combatDrain`은 **본게임 그대로**(1.0배) — 위기감 유지. 한때 0.55배로 줄였다가 "너무 쉽게 끝난다"는 피드백으로 되돌리고 playerPower만 낮추는 쪽으로 전환.
- `TUT_COMBAT_TIME_MULT = 2.2` — `mashTimer`(제한시간) 배율. 4초→8.8초.
- 70% 강제안내(F연타 팝업) 임계값도 **늘어난 총량 기준**(`MG.combatMashTime * TUT_COMBAT_TIME_MULT * 0.3`)으로 계산해야 함 — 원본 4초 기준으로 계산하면 비율이 깨짐(과거 버그).
- 게이지 바 그리는 `timeRatio`의 분모도 동일하게 늘어난 총량 기준이어야 함(과거 버그: 분모가 원본 4초라 비율이 2.2를 넘어 박스 밖으로 삐져나감).
- 시뮬레이션 검증: 연타 간격 0.15~0.35초 가정 시 9~12회로 80% 도달 — 목표(10회 안팎) 달성 확인됨.

### 치료제 선택 시스템 (2종류, 구분 필요)
1. **전투 중 강제선택**(80% 게이지 도달, 식별 안 된 위협): Y/N, `TUT_SERUM_CHOICE_TIME=7.0`초(본게임 3초보다 여유). `useSerumInCombat()`.
2. **평시 자율선택**(2번째 회수 직후): Y→`serum_use_wait`(D키로 실제 사용, `useSerumSelf()` 재사용)/N→"이건 내가 쓸 게 아니야...". `TUT_SERUM_PROMPT_TIMER`로 5초 자동 N 타임아웃. UI는 `drawTutorialSerumPrompt()`로 플레이어 머리 위에 그림(미니게임 비활성 상태에서도 동작).

둘 다 선택지 표시 중엔 `mashTimer`/게이지 감소가 멈추므로(`return`으로 일찍 빠져나감) 시간을 늘려도 다른 진행에 영향 없음.

### 좀비 습격 관련
- `spawnTutorialAmbushZombie()`: C 회수 시작(`onTutorialMineCollectStart`, `TUT_STEP==='mine_collect_3'`)이 트리거. `tutBoost=2.4`로 급속 접근, `memoryTimer=999`.
- 전투 승리(N선택 100%/시간초과) 시 **`warpZombie()`(본게임 워프 로직) 대신 즉시 `zombies.splice`로 제거** — 좁은 맵엔 워프 후보지(거리 9칸 이상 FLOOR)가 없어 스턴만 걸리고 다시 인식하던 버그 때문.
- `onTutorialCombatStart()`: "코드레드!" → `player.serum` 값으로 분기("치료제를 사용해야 하나?" / "제길 치료제가...!") — 평시에 치료제를 미리 썼는지에 따라 대사가 갈림.

### 정밀소나 연출
- `precise_prompt` 단계에서 G키만 허용(`TUT_LOCKED`가 true여도 예외 통과). 좀비는 **G 입력 후(발사 직후)** 스폰 — 미리 스폰하면 `VISIBLE` 잔존으로 비네팅과 무관하게 보일 위험 있어서 타이밍을 늦춤. `spawnTutorialPreciseZombies()`는 WALL 타일 회피하며 배치(벽에 박혀 안 보이는 문제 방지). `TUT_FREEZE_ZOMBIES=true`로 AI 동결(다가오지 않음).

### CONFIG 격리
- `applyUpgradeEffects()`(본게임 특성 적용)를 튜토리얼은 호출하지 않음. 대신 `resetConfigToDefaults()`로 항상 기본값 보장 — 이전엔 사용자가 본게임 특성을 산 상태로 튜토리얼 재실행하면 패턴 길이/산소량 등이 오염됐었음.
- 미니게임 패턴 길이도 `TUT_ACTIVE`면 고정값 3.

### 산소/감염
- `updateOxygenInfection()`: `if (TUT_ACTIVE && TUT_LOCKED) return` — **대화창을 보는 동안만** 자연 감소 정지, 그 외(자유 이동/전투/연출 등)는 정상 감소. (과거 시행착오: 처음엔 안 멈췄다가 → 튜토리얼 전체를 멈추는 걸로 과하게 갔다가 → 현재 "대화창 볼 때만" 으로 정정됨.)
- 도착보고 다음 산소안내 텍스트: "가용 산소 100%. 생존 가능 시간 약 50초입니다." (1층 `drainPerStage[0]=2`%/s 기준 실측값).

### 말투 통일
- 캐릭터 보고체는 **"~합니다"**로 통일(직전에 "~한다"로 잘못 바꿨다가 정정함). 지시문(`[F]~하세요`)과 질문문(`~하시겠습니까?`)은 명령형/의문형이라 예외. 절규성 대사("코드레드", "제기랄")도 원래 형태 유지.

---

## 5. 알려진 미해결 이슈 / 개선 후보 (다음 작업 우선순위)

### 5-1. [높음] 모바일 터치 입력 — 튜토리얼 신규 입력 미확인
출품 타깃이 모바일(CrazyGames 가로)인데, 튜토리얼에서 새로 만든 입력(평시 치료제 Y/N, D키, G키 정밀소나)이 터치 버튼(`#touch-y`, `#touch-n` 등)과 제대로 연결되는지 미확인. `_updateTouchUI()`가 `minigame.serumChoice` 기준으로 버튼을 노출하는데, **평시 치료제 선택은 `TUT_STEP` 기준**이라 버튼이 안 뜰 가능성이 있음. 실기기/터치 에뮬레이션 확인 필요.

### 5-2. [중간] `startTutorial()` 상태 초기화 누락
다음 변수들이 `startTutorial()`에서 초기화되지 않음:
- `TUT_FREEZE_ZOMBIES` (좀비 AI 동결 플래그)
- `TUT_VIGNETTE.active` / `TUT_VIGNETTE.mode`
- `TUT_FORCE_MASH_SHOWN`
- `TUT_SERUM_PROMPT_TIMER`

정상 완주 후엔 일부 정리되지만(`onTutorialFinalBlackout`, `showTitle`), **콘솔로 강제 초기화 후 재실행하는 워크플로우**에서 이전 잔여값이 남아 예측 못 한 버그를 만들 수 있음. `startTutorial()` 시작부에 명시적 리셋 추가 권장.

### 5-3. [낮음] 병원체 개수 HUD 하드코딩
`updateHUD()` 내부 `const total = TUT_ACTIVE ? 3 : CONFIG.stages[...].mineCount;` — 맵의 실제 `MAP.mineCount`(3)와 별개로 숫자가 따로 적혀 있음. 맵 구조를 또 바꾸면 이 값을 깜빡할 위험(실제로 2→3 변경 때 한 번 발생했던 버그). `MAP.mineCount` 참조로 교체 권장.

### 5-4. [중간] 습격 후 시퀀스 setTimeout 가드 부재
`onTutorialAmbushResolved()`의 중첩 setTimeout(700ms+2600ms, 총 3.3초)과 `onTutorialPreciseFired()`의 setTimeout(1300ms) 콜백 내부에 `TUT_ACTIVE`/`TUT_STEP` 가드가 없음. 그 사이 상태가 바뀌면(극단적 케이스) 예약된 콜백이 엉뚱한 타이밍에 실행될 수 있음.

### 5-5. [구조개선] 타이핑 엔진 3중 복제
엔딩 터미널(2441줄대) / 풀스크린 인트로(`showTutorialIntroScreen`) / 하단 대화창(`showTutorialLine`)에 거의 동일한 타이핑 엔진이 복제되어 있음. 이번 대화에서 같은 버그(타이핑 중 중복출력, 즉시완성 제거)를 두 곳에 각각 따로 적용해야 했던 게 이 중복의 실제 비용. 공용 함수로 추출하면 유지보수 부담이 줄어듦.

### 5-6. [낮음] 디버그 출력 잔존
`resize()` 내부 `console.log('[RESIZE]', ...)` (1345줄) — 프로덕션 빌드에 남으면 안 되는 순수 디버그 출력. `devLog()`(73곳, DEV 패널용)는 의도된 것으로 보이나 출품 빌드 시 비활성 플래그 검토 권장.

### 5-7. [보류 — 사용자 합의됨] 튜토리얼에서 다루지 않는 시스템
캡슐(산소회복), 출구탈출(스테이지 클리어), 위험도 색상 체계(빨강/danger=3) 등은 "본게임 플레이하며 자연 체득 가능"으로 튜토리얼 범위에서 제외하기로 합의됨. 추가 필요 시에만 재검토.

### 5-8. [확인 필요] 사운드
`gameover_infected`를 최종 암전 직전 "비명"으로 재사용 중 — 실제로 비명처럼 들리는지 사용자 직접 청취 필요(코드로 판단 불가).

---

## 6. 다음 대화 시작 체크리스트

1. 위 5-1(모바일 터치)부터 확인 — 출품 직결 이슈
2. 5-2(상태 초기화) 보강 — 개발 중 재현 버그 예방
3. 실제 플레이 테스트로 최신 변경(전투 난이도, 치료제 선택 시퀀스, 정밀소나 연출) 체감 확인 — 특히 타이밍(7초/5초 타임아웃, 8.8초 전투시간)이 실제로 적당한지는 아직 실플레이 피드백 미수신
4. 5-5(타이핑 엔진 통합)는 여유 있을 때 리팩토링으로 진행
