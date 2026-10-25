# 1단계 파일럿 기록 — 모듈 전환 실측 (PLAN §7.1)

파일럿 종료 시 "계속 여부 결정"에 쓸 실측치. 모듈마다 한 절씩 추가한다.
검증 도구: `node --experimental-default-type=module tools/smoke-static.mjs <모듈> [out.json]` — 설정·api·훅·lang 키 스냅샷(전환 전/후 diff). 전환 전 상태는 `backups/<모듈>-<버전>-pre-lib.zip`, 스냅샷은 `backups/snapshots/`.

## gatos-pf1-hero-points 0.1.0 → 0.2.0 (2026-10-25)

| 항목 | 결과 |
|---|---|
| JS 줄 수 | 281 → 288 (**+7**). PLAN §6 추정 −60. settings.js 48→17, 소켓 없음, 다이얼로그 골격은 유지. shim 7줄·라이브러리 비활성 경고 8줄·주석이 절감을 상쇄 |
| 교체된 것 | `i18n`×2→`mod.L`, `setting`→`mod.setting`, 설정 5개→선언형 테이블, 카드 2종→`postCard`, `DialogV2.prompt`→`formDialog`, `clamp`/`escapeHTML`→gatos-lib, 시트 주입→`pf1lib.injectSummaryBox`+`onActorSheetPF`, 플래그 경로→`mod.flagKey`, api 노출→`mod.exposeApi` |
| 유지한 것 | 사용 다이얼로그 마크업 전체(PLAN §6은 `pickList({multi:false})` 제안 — 아이콘·비용·설명 행과 버튼 라벨 실시간 갱신을 재현 못 하므로 `formDialog` + 자체 content 유지), `pf1ClassLevelChange` 훅, 모듈 CSS 전체 |
| 스모크 diff | 설정 5개(scope/type/default/range/name/hint) 동일 · api 7개 동일 · 훅 동일(+라이브러리 자체 init 2) · lang 미해결 0 · 동적 키 패턴 4개 모두 lang에 존재 |
| 독립 리뷰 | 동작 차이 없음. 저장되는 채팅 HTML에 `gatos-card` 클래스·`<i inert>`·공백 차이, 다이얼로그 창에 `gatos-dialog` 클래스 추가(PLAN §5.8 규약, 화면 변화 없음, 모듈 CSS가 라이브러리 CSS를 덮음을 서버 스타일 우선순위로 확인). 외부 매크로가 카드 HTML 문자열을 정확히 비교한다면 영향 |
| 회귀 | 0 (정적 검증 기준) |
| 두 라이브러리 경계 | 지켜짐. 모듈은 gatos-lib 6개 심볼 + gatos-pf1-lib 2개 심볼만 사용 |
| 소요 | 1세션(읽기·전환·도구 작성·리뷰 포함) |
| **미검증** | 실제 pf1 월드: 시트 박스 렌더, +/−, 사용 창, 카드, 레벨업 +1. 서버가 떠 있지 않아 못 함 |

관찰: 가장 작은 모듈에서는 줄 수 이득이 없다(PLAN §0 2항의 경고와 일치). 이득은 설정 테이블(−31줄)과 보일러플레이트 제거이고, 비용은 shim·경고·의존 선언이다. 소켓·설정이 많은 light/buff-finder/turn-control에서 실측해야 계속 여부를 판단할 수 있다.

## gatos-pf1-light 0.1.1 → 0.2.0 (2026-10-25)

| 항목 | 결과 |
|---|---|
| JS 줄 수 | 1,230 → 1,129 (**−101**, −8%). PLAN §6 추정 −180. socket.js 136→104, settings.js 54→17, vision.js 191→150(race 표·custom vision·토큰 시야 갱신이 pf1-lib로), use.js 133→107, compat.js 27→28, drop.js 157→150 |
| 교체된 것 | 소켓 릴레이 골격→`createSocket`(핸들러 4개·권한 검사·화이트리스트는 그대로), `owns`→`canControl`, `resolveActor`→gatos-lib, 설정 6개→테이블, `i18n`→`mod.L`, `isResponsible`→`isResponsibleClient`, 수제 디바운스→`keyedDebounce({restart:false, coalesce:false})`, `pickOne`·vision 리뷰 `DialogV2.wait`→`pickOne`/`formDialog`, HUD 버튼→`addTokenHudButton`×2, 시트 섹션→`pf1lib.injectItemDetailsSection`+`onItemSheetPF`, 프로토타입 패치→`wrapPrototypeMethod`, `-=`/마커→`mod.flagDeleteKey/mark/isSelfUpdate`, `actionDuration`·`buildBuffData`·재점화→`pf1lib`, RACE_SENSES·raceSenses·raceOf·customVisionTokens·resetCustomVision·refreshTokenVision→`pf1lib`, module.js의 settings 2회 import 정리(PLAN §9 #5) |
| 유지한 것 | `actorTokenDocs`(gatos-lib `tokensFor`는 비연결 토큰도 포함하고 가시성 필터가 있어 의미가 다름), `recipients`(원본은 중복 제거 안 함), `sensesEmpty`/`sensesUpdate`(원본은 준비 데이터를 읽고 라이브러리 `source:true`는 `_source`를 읽음), `isPhysical`(타입 집합 비교) |
| 스모크 diff | 설정 6개 동일 · api 21개 동일 · 훅 동일(+라이브러리 init 2, renderTokenHUD 1→2는 버튼당 훅) · lang 미해결 0 · 동적 키 5패턴 모두 존재 |
| 독립 리뷰 | **치명 1건 수정**: `registerHudButtons()`가 import 시점에 `L()`을 호출 → `game.i18n` 미존재로 TypeError, 그 뒤 훅(canvasReady·createToken) 미등록. gatos-lib `addTokenHudButton`에 함수형 tooltip 추가해 렌더 시점에 로컬라이즈. 정적 스모크 도구가 import 중에도 `game` 스텁을 제공해 놓쳤던 것 → 도구를 Foundry처럼 `game = {view}`로 import하게 고치고 역테스트로 잡히는 것 확인. **중간 1건 수정**: vision 리뷰 창 폭이 auto→400으로 바뀌던 것 `width:"auto"`로 복원. 나머지는 선택 다이얼로그 마크업(`.form-fields` 래퍼, `gatos-dialog` 클래스), HUD 버튼 aria-label·inert, 콘솔 로그 문구, `resolveActor`가 액터 id도 받는 것 등 비가시 차이 |
| **의도적 동작 변경 1건** | 자기 액터에 이미 켜진 광원 주문을 다시 쓰면 0.1.1은 **꺼졌다**(첫 update 뒤 `existing.isActive`를 다시 읽는데 소유자 경로에선 즉시 false가 되어 두 번째 update가 생략됨; GM 릴레이 경로에서는 켜진 채 유지 — 경로에 따라 달랐음). 0.2.0은 `reigniteBuff({toggle:true})`로 항상 다시 켜고 지속시간을 재시작한다(원본 주석의 의도). 되돌리려면 `use.js lightActor`에 첫 update 뒤 `existing.isActive` 재검사를 넣으면 된다 |
| 회귀 | 정적 검증 기준 0 (리뷰 발견 2건 수정 후) |
| 두 라이브러리 경계 | 지켜짐. gatos-lib 12개 심볼 + gatos-pf1-lib 11개 심볼 |
| 소요 | 1세션 |
| **미검증** | 실제 pf1 월드: 장착/드롭/줍기(GM+플레이어 2클라이언트), 주문 사용 → 버프 → 토큰 광원, HUD 버튼 툴팁, 비전 점검 창, 아이템 시트 섹션 |

관찰: 소켓·설정·vision 헬퍼가 있는 중형 모듈에서는 −8%가 나왔고, 가장 큰 이득은 소켓 골격(−32줄)과 vision 헬퍼(−41줄)였다. 정적 스모크만으로는 import 시점 전역 접근을 못 잡았으므로(도구 수정으로 보강) **파일럿 모듈 2개는 실제 월드 검증 전까지 "전환 완료"가 아니라 "전환 후 정적 검증 통과" 상태**로 본다.

## gatos-pf1-buff-finder 0.1.0 → 0.2.0 (2026-10-25)

| 항목 | 결과 |
|---|---|
| JS 줄 수 | 1,256 → 1,092 (**−164**, −13%). PLAN §6 추정 −150. socket.js 41→20, catalog.js 228→154(컴펜디움 순회·캐시·월드 아이템·normalize·stripEnrichers·localizeMaybe·durationLabel·conditionLabel이 라이브러리로), apply.js 201→157(findExisting·applyToActor가 pf1-lib로), buff-finder.js 620→587(싱글톤·위치 저장·타겟 해석·유저 플래그 리스트·confirm), module.js 165→125(씬 컨트롤·HUD·watchTargets·onAll) |
| 교체된 것 | 소켓 전체→`createSocket`(`noGMKey`), 설정 5개→테이블(`nameKey/hintKey`: 이 모듈의 lang 키는 `Key`/`KeyHint` 규약), 카탈로그 인덱스→`pf1lib.buffIndex({key})`+`invalidateItemIndex`, 버프 적용→`pf1lib.applyBuffFromSource`·`findBuffFromSource`·`setBuffActive`·`buffDurationLabel`·`conditionLabel`, `SingletonMixin`+`persistPosition`(resizable이라 left/top/width/height), `getTargetActors`→`resolveTargetActors`, recent/favorites→`userListFlag`, `DialogV2.confirm`→`confirm({skip})`, 씬 컨트롤→`addSceneControlTool`, HUD→`addTokenHudButton`, 타겟 추적 4훅→`watchTargets`, 아이템 3훅→`onAll`, api 노출→`exposeApi({global:"gatosBuffFinder"})` |
| 유지한 것 | `postChat`(원본 `getSpeaker({user})`는 코어가 user를 무시해 현재 클라이언트 화자를 쓰는데 `postCard`의 user 옵션은 alias 화자를 만들어 다름), `scoreEntry`/`describeChange`/`getTargetLabels`(Tier 2), 키바인딩 등록(라이브러리에 없음), `static open({query})`(믹스인 open은 최소화된 창을 maximize해 원본과 다름) |
| 스모크 diff | 설정 5개·키바인딩 1개·api 7개 동일 · 훅 동일(+라이브러리 init 2) · lang 미해결 0 |
| 독립 리뷰 | **높음 1건 수정**: `pf1lib.invalidateItemIndex`가 존재하지 않아(gatos-lib export) `invalidateCatalog`가 항상 TypeError → 월드 버프 변경·`api.rebuild()`마다 훅 에러, 새 버프가 리로드 전까지 안 보임. 이름 있는 import는 ESM 링크 시점에 잡히지만 네임스페이스 속성 접근은 조용히 undefined → 스모크 도구에 `pf1lib.X` 존재 검사를 추가해 역테스트로 잡히는 것 확인. **낮음 수정 2건**: 잘못된 `state.mode` 값이 라이브러리 "auto" 모드로 가던 것(원본은 targeted 아니면 selected) 매핑 복원; `buffDurationLabel`이 원시값 duration에 throw하던 것 라이브러리에서 방어 |
| **의도적 동작 변경** | (1) 씬 컨트롤 버튼: 0.1.0은 v13에서 `onChange`+`onClick`을 둘 다 설정해 클릭당 `toggle()` 2회(열린 창을 클릭하면 닫히고 다시 열림) → 1회로. (2) `stripEnrichers`: `[[1d4]]`→"1d4"(원본은 ""·`[[2d6+3]]`→"+3") — 효과 텍스트·툴팁·검색 보조키에 수식이 들어감. (3) "refreshed" 경로에서 추적 효과의 `duration.seconds`를 비우고 다시 적용 → 기간을 지운 버프가 계속 만료되던 것 수정. (4) 소켓 발신자를 페이로드 `userId` 대신 서버가 넘기는 id로 식별 → `allowPlayerTargets` 우회용 위조 불가(보안 개선). 전부 원본 버그 수정 성격 |
| 회귀 | 정적 검증 기준 0 (리뷰 발견 3건 수정 후) |
| 두 라이브러리 경계 | 지켜짐. gatos-lib 15개 심볼 + gatos-pf1-lib 6개 심볼 |
| 소요 | 1세션 |
| **미검증** | 실제 pf1 월드: 창 열기/검색/적용, 비소유 토큰 릴레이(GM+플레이어), 토글/제거 chip, 최근·즐겨찾기 플래그, 위치 저장, HUD·씬 컨트롤 버튼 |

관찰: 소켓·카탈로그·AppV2 싱글톤이 모두 있는 모듈에서 −13%로 세 모듈 중 가장 큰 절감이 나왔다. 세 파일럿 합계 2,767 → 2,512줄(−255, −9%). 리뷰 3회 모두 정적 스모크가 못 잡은 결함을 1건씩 찾았고(import 시점 전역 접근, 존재하지 않는 네임스페이스 멤버) 그때마다 도구를 보강했다. 네 번째 파일럿 turn-control(gatos-lib 단독 대조군) 뒤에 계속 여부를 결정한다.

## gatos-turn-control 0.2.0 → 0.3.0 (2026-10-25) — gatos-lib 단독 대조군

| 항목 | 결과 |
|---|---|
| JS 줄 수 | 1,455 → 1,322 (**−133**, −9%). PLAN §6 추정 −110. settings.js 215→139(13개 설정+메뉴 테이블), socket.js 35→20, visibility.js 96→92(수제 디바운스→`keyedDebounce({coalesce})`), tracker.js 191→174(`makeControlButton`·`htmlRoot`), chat.js 139→121(`postCard`·`speakerFor`·`esc`), module.js 42→45(라이브러리 경고 추가), generic.js 65→65(`MODULE_ID` 리터럴 재선언 제거, PLAN §9 #4) |
| 교체된 것 | 소켓→`createSocket({noGMKey})`, 설정 13개+메뉴→테이블(PF1 조건부 4개는 `config:false`여도 name/hint를 갖도록 명시, 메뉴는 `nameKey/labelKey/hintKey`), `getSetting`→`mod.setting`, `L`→`mod.L`, `esc`·`speakerFor`·`postCard`(whisper "gm"), `scheduleSync`→`keyedDebounce`, 트래커 버튼·푸터 버튼→`makeControlButton`(아이콘 클래스를 `classes`로 넘겨 v13 트래커 마크업 유지), `canControl`, 플래그 키→`mod.flagKey/flagDeleteKey`, AE 훅 3개→`onAll`, api→`exposeApi` |
| 유지한 것 | `systems/pf1.js` 전체(PLAN §5.0 규칙 3), `combat.js`·`rules.js` 전체, `options[MODULE_ID] = {resume, ended}` 객체 마커(`mod.mark()`의 true와 다름), 컨텍스트 메뉴 등록(라이브러리에 combatant 메뉴 헬퍼 없음), `BlockingConditionsConfig` AppV2, `foundry.utils.debounce` 리렌더 |
| 스모크 diff | 설정 13개(scope/config/type/default/choices/range/onChange)·메뉴·api 7개 동일 · 훅 동일(+gatos-lib init 1) · lang 미해결 0 · 네임스페이스 미존재 0 |
| 독립 리뷰 | **회귀 없음.** 차이: `api.*` 반환값(원본은 핸들러 결과/undefined, 지금은 boolean — 모듈 내부 호출자는 전부 반환값 무시), 채팅 카드에 `gatos-card` 클래스·`inert`·공백 차이(화면 변화 없음, 모듈 CSS가 우선), 소켓 와이어 포맷·발신자 식별(페이로드 userId 위조 불가), aria-label 2중 localize(라이브러리 `loc`가 `game.i18n.has`로 키 여부 확인하도록 수정), 푸터 버튼에 dblclick 전파 차단 추가 |
| 회귀 | 0 (정적 검증 기준) |
| 라이브러리 경계 | gatos-lib 11개 심볼만 사용, gatos-pf1-lib 미참조 → 시스템 무관 모듈에 gatos-lib 단독으로 충분함을 확인 |
| 소요 | 1세션 |
| **미검증** | 실제 월드(pf1 + dnd5e 각 1회): 턴 제외·자동 턴 종료·Delay 플레이어 릴레이(GM+플레이어)·사망 토큰 숨기기·대표 토큰 교체·차단 상태 설정 창 |

## 파일럿 종합 (4/4 완료, 2026-10-25)

| 모듈 | 전 | 후 | 절감 | PLAN 추정 | 리뷰가 잡은 결함 |
|---|---:|---:|---:|---:|---|
| hero-points | 281 | 288 | +7 | −60 | 0 |
| light | 1,230 | 1,133 | −97 | −180 | import 시점 `L()` 호출(치명), 창 폭 |
| buff-finder | 1,256 | 1,092 | −164 | −150 | 존재하지 않는 `pf1lib.*` 멤버(높음), 모드 매핑 |
| turn-control | 1,455 | 1,322 | −133 | −110 | 0 |
| **합계** | **4,222** | **3,835** | **−387 (−9%)** | **−500** | |

- **절감**: PLAN §0의 "−2~4%" 보수 추정보다 좋고 §6의 모듈별 추정(−500)의 77%. 작은 모듈은 이득이 없고, 소켓·설정·카탈로그·AppV2 싱글톤이 있는 모듈에서 −9~13%.
- **동작 보존**: 네 모듈 모두 설정 키·api·lang 키·플래그 동일. 의도적 변경은 전부 원본 버그 수정 성격(light 재점화, buff-finder 씬 컨트롤 2회 토글·stripEnrichers·refreshed seconds, 소켓 발신자 식별)이고 각 모듈 PILOT 절과 코드 주석에 기록.
- **검증 방법의 한계**: 정적 스모크(설정·api·훅·lang diff)만으로는 세 가지를 못 잡았고 각각 도구를 보강했다 — import 시점 `game.*` 접근(`game={view}`로 import), 존재하지 않는 네임스페이스 멤버(`pf1lib.X` export 검사), Foundry 전역 스텁 부족(CONFIG 문서 클래스·CONST). 독립 리뷰가 치명 1·높음 1을 잡았으므로 **리뷰 없는 전환은 권장하지 않는다.**
- **두 라이브러리 경계**: 네 모듈 모두 지켜짐. turn-control은 gatos-lib만으로 충분.
- **미완**: 실제 Foundry 월드 검증(4개 모듈 + 2개 라이브러리, pf1 월드와 비-pf1 월드), `modules/` git 저장소(PLAN §7.0). 두 가지가 끝나기 전에는 "전환 완료"가 아니라 "정적 검증 통과".
- **계속 여부 판단 자료**: 남은 모듈은 party-panel·monster-maker·item-crafting·vitalist(2단계), chat-tools·visual-novel(3단계), header-menu·coc7×2·spirit-totem(4단계). 2단계는 pf1-lib 사용 비중이 높아 buff-finder와 비슷한 −10% 내외, 3단계는 설정·다이얼로그·플래그 스토어 비중이 높아 chat-tools에서 가장 큰 절대 절감이 예상된다.

## 실제 월드 검증 (2026-10-25, Foundry 13.351, pf1 11.11 / dnd5e 5.2.5)

스크래치 월드 `gatos-lib-test`(pf1)와 `gatos-lib-test-5e`(dnd5e)를 새로 만들어 GM 한 클라이언트(내장 브라우저)로 검증. 기존 월드는 건드리지 않음. 두 월드는 `Data/worlds/`에 남아 있으며 지워도 된다.

| 대상 | 확인한 것 | 결과 |
|---|---|---|
| 로드 | 6개 모듈 활성, `api` 노출(gatos-lib 136·pf1-lib 91·모듈 7/7/21/7), 설정 등록 수(5/6/5/13), 키바인딩, lang 미해결 0, **콘솔 에러 0** | ✅ |
| hero-points | 서머리 `.info-box-header.gpf1hp-box`가 `.attributes.flexrow` 안에 렌더 · `+` 클릭 → 플래그 1→2 + 변경 카드(`gatos-card gpf1hp-card change`) · `spendHeroPoint(reroll, note "<b>")` → 사용 카드(메모 이스케이프, footer 1점 차감/남은 1/3) · 사용 창 렌더(효과 8행, 재굴림 기본 선택, OK 라벨 "사용 (1점 차감)", 창 480px) | ✅ |
| light | Torch 자동 감지(preset torch, equip) · 장착 → 토큰 20/40 + base 플래그 + 프로토타입 20 · 해제 → 0 복원 · `dropLight` → 0.5칸 토큰(20) 생성·수량 2→1 · `pickUpLight` → 토큰 제거·수량 2·장착 · 아이템 시트 `.tab.details`에 `fieldset.gpf1l-section`(프리셋 16개, 상태 문구) · HUD 왼쪽 열 `control-icon gpf1l-hud gpf1l-drop`(툴팁·aria) · 광원 2개일 때 `pickOne` 창(제목·옵션 Torch/Candle·확인 버튼) · Candle 병합 20/40 | ✅ |
| buff-finder | 카탈로그 74개 · "bless" → 2행 · `apply(level 5)` → Bless 활성·추적 효과 · 재적용(level 7) → 1개 유지·레벨 갱신 · 행 상태 "활성"·chip on · 창 닫기 → 위치 설정 저장·instance null · 창 렌더(서브타입 4, 70/74) | ✅ |
| turn-control (pf1) | `TurnControlCombat` 클래스 · 행 버튼 `inline-control combatant-control icon fa-* gtc-control`(툴팁·aria) · 푸터 지연 버튼 · `delay` → 플래그·"지연 중" 배지·지연 카드(`gatos-card gtc-card`) · 재개/큐 버튼 등장 · `toggleNoTurn` → "manual" · 차단 상태 설정 창(14행, 기본 9개 체크) | ✅ |
| **dnd5e 대조군** | gatos-pf1-lib는 `game.modules`에 **아예 나타나지 않음**(systems: pf1 잠금) · gatos-lib + turn-control 활성·콘솔 에러 0 · 설정 config: hpPath/hpDeathAt true, hpStates/confusion false · 트래커 버튼·푸터·지연 카드 · 차단 상태 창에 dnd5e 상태 43개, generic 기본값 7개 체크 · HP 0인 NPC가 hpDeath "npc"로 턴 제외되어 Hero로 되돌아오며 "지연 행동 상실" 카드(0.2.0 로직 그대로) | ✅ |
| 스모크 도구 | `tools/smoke-world.js`: 첫 실행에서 lang fetch가 상대 경로라 `/game/modules/...` 404 → `/modules/` 절대 경로로 수정 | 수정 |

**여전히 미검증**: GM+플레이어 2클라이언트 소켓 릴레이(light 드롭/줍기·버프 비소유 적용·turn-control 플레이어 Delay) — 내장 브라우저는 세션 쿠키를 공유해 두 번째 유저로 동시 접속할 수 없다. 레벨업 +1(pf1ClassLevelChange), 주문 사용→광원 버프(pf1PostActionUse), 혼란 굴림, 사망 토큰 숨기기·대표 토큰 교체는 이번에 트리거하지 않았다.

## 2단계 — gatos-pf1-party-panel 0.1.0 → 0.2.0 (2026-10-25)

| 항목 | 결과 |
|---|---|
| JS 줄 수 | 1,038 → 892 (**−146**, −14%). module.js 178→120(설정 테이블·씬 컨트롤·watchTargets·onAll), party-panel.js 779→706(싱글톤·위치·setTargets·impl·hpState·usesWoundsAndVigor·xp·levelInfo·defenses·activeConditions·allConditions·setBuffActive·formDialog×3·dialogRoot·byName·signed·clampPct·fmtNumber), party-manager.js 81→76 |
| 유지한 것 | `tokensFor`(placeable 반환, 라이브러리는 TokenDocument), `toggleTarget`/`panToActor`(알림 포함), hp 풀 계산(원본은 W&V에서도 hp 풀 표시), `#buffDuration`(라이브러리 `buffDurationLabel`은 turn 단위에서 값을 생략), `#onToggleCondition`(라이브러리 `setCondition`은 비-pf1 상태 효과를 전부 삭제), 다이얼로그 자체 마크업(`.pf1pp-pick`) — `formDialog`에 content로 넘김 |
| 스모크 diff | 설정 6개·키바인딩·api 9개 동일 · 훅 동일(+라이브러리 init 2) · lang 미해결 0 · 네임스페이스 미존재 0 |
| 독립 리뷰 | **낮음-중간 1건 수정**: 싱글톤 믹스인이 닫힐 때 인스턴스를 버려 다중 선택 체크가 사라짐(원본은 닫힌 인스턴스를 재사용) → 선택 집합을 모듈 범위 `SELECTED`로 옮겨 세션 유지. 나머지: `num()` 강제 변환(NaN→0, 준비된 pf1 데이터에선 무차이), `usesWoundsAndVigor`가 character/npc 외 타입에 false(해당 타입은 wounds/vigor 데이터가 없어 무차이), `gatos-dialog` 클래스, `instance`가 닫힌 뒤 null(원본은 닫힌 앱 객체) |
| 의도적 동작 변경 | 씬 컨트롤 2회 토글 → 1회(v13 onChange만) |
| **실제 월드** | pf1 스크래치 월드: 카드 2장(HP 상태 `state-disabled`·XP "0 / 2,000"·AC·상태 chip Shaken·버프 chip "Bless @item.level Minutes"), `targetActor` 토글 true→false, 창 닫기 시 `{left, top, width}`만 저장·instance null, 로스터 관리 창(2행·2체크), HP 조정 창(피해/회복 autofocus/취소, 320px), 상태 창(37행, Shaken 체크, 2열), 수정 후 닫기→열기 시 선택 유지 확인, **콘솔 에러 0** |
| 소요 | 1세션 (리뷰·월드 검증 포함) |

## 2단계 — gatos-pf1-monster-maker 0.1.0 → 0.2.0 (2026-10-25)

| 항목 | 결과 |
|---|---|
| JS 줄 수 | 884 → 897 (**+13**). module.js 54→46(exposeApi·addDirectoryHeaderButton·addActorSheetHeaderButton), dialog.js 318→316(mod.L·impl.FormDataExtended/FilePicker·mod.notify·pf1lib.featIndex), constants.js 신설 13, lib.js 8, builder.js 518 무변경 |
| 유지한 것 | `open()`(액터별 창 재사용), `apply`/`reconcileHp`/`resolveCompendiumFeats`, pf1.feats 우선 정렬과 이름 맵(라이브러리 `featIndex`는 걷기만 담당), 세션 캐시 무효화 없음(PLAN §9 #10 그대로) |
| 스모크 diff | 설정 0·api 6개 동일 · 훅 동일(+V2 헤더 컨트롤 훅 1, +라이브러리 init 2) · lang 미해결 0 · 네임스페이스 미존재 0 |
| 독립 리뷰 | **결함 0**. 지적: 라이브러리 설치-비활성 경고(의도된 추가, 하드코딩 ko/en 문구), `featIndex`가 필드 없는 기본 인덱스를 먼저 조회(결과 동일, 실패 팩은 warn 로그), 디렉터리 버튼 라벨이 innerHTML→textContent(현재 번역은 DOM 동일), 시트 버튼 condition 예외가 lib 로그로 (버튼 미표시는 동일) |
| 의도적 동작 변경 | V2 액터 시트에도 "몹 편집" 헤더 컨트롤(pf1 11.11은 V1 시트뿐이라 현재 무영향) |
| **실제 월드** | pf1 스크래치 월드: 액터 디렉터리 `button.gpmm-open`(아이콘 inert·라벨) · 창 렌더(프리셋·HD·공격·특수 능력 섹션) · `api.create({...})` → NPC 생성(HD 클래스·종족·compendium 피트 2개 `_stats.compendiumSource`·HP 30 정확) · 시트 헤더 `.gpmm-edit` 버튼 → 편집 창 · **콘솔 에러 0** |
| 소요 | 1세션 (리뷰·월드 검증 포함) |

## 2단계 — gatos-pf1-item-crafting 0.4.1 → 0.5.0 (2026-10-25)

| 항목 | 결과 |
|---|---|
| JS 줄 수 | 2,198 → 2,198 (**±0**). module.js 89→81(설정 테이블·preloadTemplates·exposeApi·onActorRest·addActorSheetHeaderButton), crafter.js 754→745(mod.L/setting/notify/warn·norm·num·fmtNumber·csvList·pf1lib.spellIndex/maxCasterLevel/extractRoll·confirm×2·postCard), dialog.js 379→377(PerDocumentMixin·readForm·impl.TextEditor·confirm·mod.notify), import-dialog.js 184→187(readForm·csvList·mod.notify), config.js +9(`mod`), lib.js 7. rules.js·statblock.js·템플릿·css·lang **바이트 동일**(cmp) |
| 유지한 것 | `matchTable`/`itemTags`(라이브러리 `matchByTagOrName`은 `system.tag`·괄호 제거·키당 1아이템 규칙이 달라 피트 감지가 바뀔 수 있음), 채팅 카드 마크업(헤더 없이 아이콘 인라인, `gatos-card` 클래스만 추가), `api.open`의 인스턴스 스캔(레지스트리 우선 + 0.4.1 스캔 폴백) |
| 스모크 diff | 설정 9개(키·scope·type·default·range·`PF1CRAFT.Settings.<key>.Name/.Hint`, keyStyle raw) 동일 · api 8개 동일 · 훅 +updateActor(onActorRest 폴백)·+init 2 · lang 미해결 0(`PF1CRAFT.Settings`는 접두어 문자열 오탐) · 네임스페이스 미존재 0 |
| 독립 리뷰 | **회귀 0, 낮음 4**: ① `new CraftingDialog()`로 직접 만든 창을 `api.open`이 못 찾음 → 0.4.1 스캔을 폴백으로 추가(수정) ② 같은 액터 2초 내 두 번째 휴식은 onActorRest가 중복으로 버림(pf1 11.11 performRest는 시간을 올리지 않고 updateActor→pf1ActorRest 순서라 폴백은 항상 중복 처리됨, 실질 무차이) ③ 채팅 메시지에 빈 `flags[module]={}` 추가(비가시) ④ `fmtNumber(undefined)`가 "NaN" 대신 "0"(템플릿이 해당 값을 숨겨 무차이). **원본 버그 발견(미수정, 동작 유지 원칙)**: 스탯 블록 가져오기 창에서 사용자가 고친 `edit.*` 값이 전부 버려짐 — v13 `FormDataExtended#object`는 점 키를 펼치지 않아 `fd.edit`가 항상 undefined. 고치려면 `readForm(this.form, { expand: true })` 두 곳 |
| 의도적 동작 변경 | V2 액터 시트 헤더 컨트롤 중복 방지(라이브러리 가드), 라이브러리 비활성 경고 |
| **실제 월드** | pf1 스크래치 월드(Tester에 Scribe Scroll·Brew Potion·Craft Wondrous Item + Magic Missile·Shield, CL 5, 500gp): 설정 9개 등록·lang 해석("기본 작업 시간") · 템플릿 2개 프리로드 · 창 렌더(`gatos-pf1-item-crafting-48`, 640×760, 종류 3·주문 2·기술 3 옵션, 미리보기 "Scroll of Magic Missile" 125gp/62.5gp/2h/DC 10) · 같은 액터 재오픈 시 동일 인스턴스 · 폼 변경(wondrous 전환 → 드롭 존·`missingSpellNamesText` " fly , haste,, "→["fly","haste"]·basePrice·upgradeExisting→slotItem 노출) · 시작 → 재료비 62.5gp 차감(437gp 5sp)·시작 카드(`gatos-card gatos-pf1-item-crafting chat-card`, speaker Tester)·Spellcraft 굴림·실패 카드(8 vs DC 10) · 포기 확인 창(`gatos-dialog`, 400px, 예/아니오, 아니오 기본) · 일일 제한 확인 창 · 시트 헤더 `.gatos-pf1-item-crafting-open` "제작"(2번째) · 스탯 블록 가져오기(Cloak of Resistance 파싱: CL 5·shoulders·abj·1000/500gp·피트·주문 resistance 누락 표시 → 콜백 itemData equipment/wondrous, slotItem) · `performRest({hours:8})` → 창 1개, restHours 8, 재휴식 시 동일 인스턴스, openOnRest false면 안 열림 · **콘솔 에러 0** |
| 소요 | 1세션 (리뷰·월드 검증 포함) |

## 2단계 — gatos-pf1-vitalist 0.1.1 → 0.2.0 (2026-10-26)

| 항목 | 결과 |
|---|---|
| JS 줄 수 | 2,644 → 2,442 (**−202**, −8%; 리뷰 수정 +18 포함, PLAN 추정 ~220). module.js 387→324(설정 테이블·exposeApi·preloadTemplates·pickOne·addActorSheetHeaderButton·addSceneControlTool·formDialog·postCard·sumAttackDamage), socket.js 113→82(createSocket 핸들러 4개·runAsGM·applyHealthDelta), collective.js 467→399(classByTagOrName·matchByTagOrName·resolveActorSync·setTargets·pf1lib health 4종 재export·정적 import), collective-panel.js 640→600(PerDocumentMixin·hpState·activeConditions·panToActor·impl·confirm·formDialog×5·postCard×3), spirit-of-many.js 215→173(pickList·sumAttackDamage·postCard), steal-health.js 256→226(touchAC/hitsTouchAC·sumAttackDamage·formDialog), steal-life.js 217→200(formDialog×2·confirm·extractRoll·postCard), collective-healing.js 106→100(changedHealth·isRestUpdate), distribute-dialog.js 243→247(postCard), constants.js 15·lib.js 7 신설. 템플릿·lang **바이트 동일**(cmp), css는 리뷰 수정으로 3줄 추가. 원본 파일 5개는 CRLF — 패치 도구가 줄끝을 보존 |
| 유지한 것 | `tokensFor`(placeable 반환)·`targetActors`·`getChooser`(localeCompare 정렬)·`maybeSync`의 최소 id 소유자(GM 포함; 라이브러리 `activeOwnerOf`는 플레이어 우선이라 의미가 다름)·`getPowerPoints/spendPowerPoints`·`isNetworkPower`·`DistributeDialog`(Tier 2)·공격 창 jQuery 주입. 보너스/분배량/재분배/리퀘스트 에이드/발현 창은 **원본 마크업 그대로 `formDialog`에 content로**(promptNumber는 빈 입력을 취소로 처리해 0.1.1의 "빈 값=0"과 다름) |
| 스모크 diff | 설정 6개 동일(첫 실행에서 name 키가 `.Name` 접미사로 어긋나 `nameKey`를 명시해 수정) · api 22개 동일 · 키바인딩 동일 · 훅 동일(+라이브러리 init 2) · lang 미해결 0 · 네임스페이스 미존재 0 |
| 의도적 동작 변경 | V2 시트 헤더 컨트롤에도 V1과 같은 권한 조건(PLAN §9 #9; pf1 11.11은 V1 시트뿐), 씬 컨트롤 v13 onChange만, GM 부재 알림 error→warn(createSocket), formDialog 계열 창에 취소 버튼·`gatos-dialog` 클래스 추가, 리더 선택 `pickOne`(select name "pick"), 스피릿 오브 매니 대상 선택 `pickList`(체크박스 name "gatosPick", 카운터 `.gatos-pick-counter`, 왕관 아이콘이 이름 span 뒤로; 행 클래스 `gatos-pick-row pf1vit-pick-row` 둘 다), 채팅 카드에 `gatos-card` 클래스·`inert` 아이콘 추가(h3 헤더는 lib.css 영향 없음), 동적 import 2곳 정적화(PLAN §9 #6), 닫힌 패널의 선택 집합을 모듈 범위 Map에 보관(0.1.1은 닫힌 인스턴스를 Map에 유지) |
| 라이브러리 매처 채택 | `getFeature`/클래스 감지를 `matchByTagOrName`/`classByTagOrName`으로 — 태그 우선·이름 폴백 순서는 같고, 라이브러리는 `system.tags`도 보고 괄호를 위치 무관하게 제거함(pf1-psionics 바이탈리스트 특성 16개 전부 동일 감지 확인) |
| 독립 리뷰 | **높음 1 수정**: steal-life.js가 `postCard`를 import하지 않아 스틸 라이프 명중 확정 뒤(사망 적용 후) ReferenceError — 카드·분배 창이 안 열림(정적 스모크는 호출 경로를 안 타서 못 잡음, 월드 검증도 포커스 필요로 그 경로를 안 돌림) → import 추가. **중간 1 수정**: pickList가 결과를 `max`로 잘라 0.1.1의 "대상이 너무 많습니다" 중단이 사라짐(패널에서 3명 선택 후 추가 대상 0인 파워 → max 1) → render 훅으로 체크 수를 세어 중단 유지(월드에서 "3 / 1" 경고·카드 없음 확인). **낮음 3 수정**: 재오픈 시 창 위치·크기 초기화(0.1.1은 닫힌 인스턴스를 재사용) → 리더별 POSITION 맵(월드에서 120/90/430 복원 확인); 리더 선택 OK 라벨 `GATOSLIB.Pick`→core "Confirm"; pickList 행의 이름 span에 `.name` 클래스가 없어 굵기·왕관 색이 빠짐 → vitalist.css에 `.pf1vit-pick-row.gatos-pick-row` 규칙 3줄 추가(css가 더 이상 바이트 동일이 아님). **낮음 1 미수정(기록)**: 라이브러리 매처가 태그 대소문자 무시·`system.tags`·괄호 위치 무관이라 번역/개명된 특성을 0.1.1보다 더 찾을 수 있음(pf1 자동 태그 `medicPowers` 등) — 동봉 pf1-psionics 아이템은 동일 감지 |
| **실제 월드** | pf1 스크래치 월드 + pf1-psionics 0.8.1 + lib-wrapper: 설정 6개·lang 해석, 키바인딩, 템플릿 2개 프리로드, 씬 컨트롤 도구, api 22·`pf1Vitalist` 전역 · VitTester(Vitalist 14레벨, 특성 16개 자동 추가) → autoSync가 Steal Health 액션 melee/ranged 2개 생성(`synced {version 1, ranged true, level 14}`) · 구성원 추가 2(Tester·Goblin, 플래그 members/bonus/psicrystals) · 패널 렌더(`gatos-pf1-vitalist-collective-<id>`, 360px, 제목 "컬렉티브 — VitTester", 카드 3 상태 healthy/critical/disabled, Shaken 아이콘, 툴바 14 액션, 헤더 "2/7 240 ft PP 50/198") · 재오픈 동일 인스턴스·레지스트리 · 체크 선택 → 닫기 → 열기 시 선택 유지(새 인스턴스) · 헬스 센스 카드(`gatos-card pf1vit-chat` h3, GM 귓속말) · 펄스(PP 50→49) · 수동 분배(even → VitTester +10, 카드 flags `{distribute:true}`) · 컬렉티브 힐링 프롬프트(Goblin +4 → 원래 대상 행·+4 유지·후보 2) · 스틸 헬스(타겟 Goblin 토큰, skipDialog → 확인 창 "명중 13 · Goblin (Touch 10)" 명중/빗나감 버튼, 피해 18 → 토큰 액터 4→−14, HD 0이라 분배 없음) · 스피릿 오브 매니(Vigor, promptNetworkTargets → pickList 창 "1 / 1", 리더 체크·나머지 disabled, applyHeal/targetTokens, 카드 flags spiritOfMany) · 리퀘스트 에이드(PP 2 → 카드 "HP 6") · 보너스 편집(2 → "2/9") · 해산 확인(아니오) · 재분배·분배량·발현 창 렌더/취소 · 시트 헤더 `.pf1-vitalist-open` "컬렉티브" · 스틸 라이프 포커스 확인 창 · 트랜스퍼 운즈(pending 대상 Goblin → 창 "굴린 회복량: 16" → 카드) · **콘솔 에러 0**. 미검증: 플레이어 클라이언트 소켓 릴레이(heal/damage/flags), 스틸 라이프 전체 흐름(포커스 필요), 공격 창 Spirit of Many 카운터 주입(skipDialog로 건너뜀) |
| 소요 | 1세션 (리뷰·월드 검증 포함) |

## 3단계 — gatos-chat-tools 0.5.2 → 0.6.0 (2026-10-26)

VN 호환 표면 체크리스트를 먼저 썼다: `CHECKLIST-chat-tools-vn.md`(api 10·훅 9+6·serializeMessage 스키마·DOM/식별자·훅 등록 순서). gatos-lib만 사용(시스템 무관).

| 항목 | 결과 |
|---|---|
| JS 줄 수 | 5,345 → 4,935 (**−410**, −8%; PLAN 추정 ~250 초과). settings.js 249→77(테이블), viewer.js 918→870(SingletonMixin·formDialog×4·confirm×2·promptText·readForm·jumpToMessage·addChatControl), module.js 180→175(exposeApi·preloadTemplates·onChatUiRender·onSettingChanged·userFlagStore.watch), edit.js 195→178(metadataButton·pushMessageContextOption·formDialog·rerenderVisibleMessages 재export), session.js 225→208(formDialog×2·postMarker·isLeadGM), bookmarks.js 101→72(userFlagStore·metadataButton·pushMessageContextOption×4), reorder.js 122→111(chatLogElements·pushMessageContextOption×3·toLocalInput 재export), portrait.js 126→127(providerRegistry), viewer-actions.js 37→33(actionRegistry), whisper.js 365→344(userFlagStore·addChatControl·formDialog·onChatUiRender·gmUsers), images.js 447→418(ensureDataDir·uploadToData·addChatControl·onChatUiRender·requireModule), archive.js 400→361(settingStore·uploadJson·cacheBust·safeFilename·download·renderMessageContent 재export), export.js 704→689(safeFilename·stamp·download·esc), constants.js 61→27(날짜 6종 재export), compat-chat-images.js 208→208, token-hud.js 230→219, speaker-bar.js 293→296, grouping.js 87→84, chitchat.js 131→132, export-dialog.js 130→127, lib.js 5. zip.js·ruby.js·lang·css·템플릿 7개 **바이트 동일** |
| 유지한 것 | `setting`(throw 의미 유지 — `mod.setting`은 미등록 시 undefined라 `imagesActive` 등 try/catch 분기가 달라짐), `grouping.scheduleRegroup`(가변 지연 디바운스), images.js `escapeAttr`·`fileNameOf`·zip/idb/FS Access(Tier 2), 이미지·chat-images 호환 설정은 원래 init 훅 자리(설정 등록 순서 유지), 뷰어 인스턴스 상태 보존(`kept` 객체 + SingletonMixin 레지스트리) |
| 스모크 diff | 설정 32개 동일(키·순서·scope·type·default·range·choices·lang 키; `portraitShape`/`favoriteChipMode`는 `hintKey:false`, GroupGap/Auto* 키 명시) · 키바인딩 2 동일 · api 67 동일 · 훅 +init 1(라이브러리) +createSetting/clientSettingChanged(onSettingChanged) · lang 미해결 0(images.js 지역 `L`→`Li` 개명으로 도구 오탐 제거) · 네임스페이스 미존재 0 |
| VN 표면 | 체크리스트 §2 api 10개 module.js에 존재 · §3 훅 14개 `Hooks.callAll` 유지(`gctViewerActionsChanged`는 라이브러리 actionRegistry가 발화) · `#gct-archive-viewer`·`.gct-speaker-bar` 유지 · 월드: 아카이브 메시지에 `vn` 필드·헤더 `vn`, 발화자 바 다음 형제 `.gvn-expr-strip`, 뷰어에 `gvn-replay` 버튼, 번들에 `*.player.html`·`log.json.vn` |
| 의도적 동작 변경 | formDialog 창에 `gatos-dialog` 클래스, 아카이브 이름 변경 창이 promptText(입력 name "value", 취소 버튼), `onSettingChanged`가 createSetting도 들음(첫 아카이브 저장에도 뷰어 재렌더), `jumpToMessage`가 팝아웃도 검색, 메타데이터 버튼에 aria-label, Blob 다운로드는 object URL 경유, `gctViewerActionsChanged` 발화 주체가 라이브러리 |
| 스모크 도구 | import 시점 `window.addEventListener`(token-hud)·init 훅의 `document.documentElement.style`(chitchat)·`CONFIG.TextEditor.enrichers`(VN) 때문에 window·document(훅 단계)·CONFIG.TextEditor 스텁 추가 |
| 독립 리뷰 | **중간 1 수정**: 이미지 업로드가 `uploadToData`를 거치며 `ensureDataDir`(FILES_BROWSE 필요)에 실패하면 업로드 자체를 안 함 → FILES_UPLOAD만 가진 플레이어(chat-images식 설정)는 매번 실패. 0.5.2처럼 폴더 생성은 best-effort, 업로드는 `FilePicker.upload` 직접 호출로 복원(월드에서 GM 업로드 재확인). **낮음 2 수정**: `api.openViewer()`가 Promise 대신 앱을 반환 → `render()` Promise 반환으로 복원(월드 확인); 초상 공급자를 `providers.all`로 전부 호출 → `providerRegistry.first(accept, …args)` 매퍼 지원을 라이브러리에 추가해 0.5.2의 지연 순회 복원(월드에서 VN 공급자 뒤의 공급자 미호출 확인). 그 외 동등: 설정 28+4·api 67·훅 순서·바 DOM 순서·다이얼로그 결과 형태·플래그 스토어·아카이브 형식. 부수 효과: 뷰어가 `renderGatosSingleton`/`renderGatosPersistPosition` 훅도 발화(AppV2 클래스 체인) |
| **실제 월드** | pf1 스크래치 월드(VN 0.3.0 활성 상태에서 먼저 검증): 설정 32·템플릿 6+partial·api 67 · 채팅 컨트롤 버튼(귓속말 `#roll-privacy` 뒤, 뷰어 append, 이미지 append+hidden input 1) · 잡담 `/p` → 플래그·`.gct-cc-name/.gct-cc-text`·스타일 OOC · 발화자 잠금(Tester) → 메시지 speaker/IC/포트레잇 플래그/VN expression 플래그·메타데이터 `gct-btn gct-edit` · 루비 `[[base|reading]]`→`<ruby>` · 북마크 아이콘·하이라이트 클래스 · 수정 창(formDialog 560px, 필드 5, 저장 → 내용 갱신) · 뷰어(`#gct-archive-viewer`, VN 액션 2, 검색 "Edited" 1건+mark, 닫고 열기 → 같은 객체·검색어 유지) · 삭제 범위 창(취소 기본)·저장 창(미리보기 21) · 세션 시작 창 → 마커(OTHER, alias "세션", flags sessionMarker, `.gct-marker`) → 종료 창 → 아카이브(3건, session 1, `worlds/gatos-lib-test/chat-archives/*.json`) → 이름 변경(promptText) → 삭제 창(취소 기본) · 귓속말 창 → GM → 바 `GM에게만→ GM만`·메시지 whisper 1·flags whisperTo → 해제 · 내보내기 창(모드 7, txt 실행 → lastExportMode) · 이미지 추가(8px PNG 업로드 `uploaded-chat-images/<id>.png`, 트레이 `ready`) · 순서 이동(타임스탬프 교환)·복제 · **콘솔 에러 0**(창 크기 경고만) |
| 소요 | 1세션 |

## 3단계 — gatos-visual-novel 0.3.0 → 0.4.0 (2026-10-26)

| 항목 | 결과 |
|---|---|
| JS 줄 수 | 4,897 → 4,835 (**−62**; 순수 파일 4개 2,385줄 불변이라 분모가 작음). settings.js 121→101(테이블+menu 항목), socket.js 88→68(createSocket broadcast×2·request), compat.js 36→18(라이브러리 재export), constants.js 29→30(requireModule), module.js 114→119, keyword-manager.js 124→126(SingletonMixin·debounce·impl.TextEditor), log-player.js 111→109(formDialog·esc), expression-config.js 322→306(PerDocumentMixin·addActorSheetHeaderButton·canControl), stage.js 415→410(addChatControl·onChatUiRender·debounce), links.js 261→262, archive-ext.js 319→319, lib.js 6. 순수 파일 4개·entries·expressions·expression-picker·display-config·lang·css·템플릿 **바이트 동일** |
| 라이브러리 변경 | `addActorSheetHeaderButton`의 `label`·`position`이 `{v1, v2}` 객체도 받음(VN은 V1 버튼을 짧은 라벨로 맨 앞, V2 컨트롤을 긴 라벨로 맨 뒤에 둠) — 테스트 26건 통과, README 갱신 |
| 유지한 것 | `display/displayOverrides/setDisplayOverrides`(overridesStore는 Tier 2 자리만), 액터 디렉터리 컨텍스트 메뉴(라이브러리 헬퍼 없음), `collapseSidebar → measure(350ms)`, 키워드 매니저 상태 보존(`kept` 객체), 소켓 실패 코드를 모듈 lang 키(`Keywords.NoGM`/`Keywords.Timeout`)로 되돌림 |
| 스모크 diff | 설정 23개 + 메뉴 1 동일(typewriterMs는 `Typewriter` 키 명시, 메뉴 위치 동일) · 키바인딩 동일 · api 17 동일 · 훅 +init 1 · lang 미해결 0 |
| 의도적 동작 변경 | formDialog 창에 `gatos-dialog` 클래스, `chatTools()`가 requireModule(동일 조건), 소켓 와이어 포맷이 라이브러리 형식(`kind/action/data`; 양쪽 모두 0.4.0이면 무관) |
| 독립 리뷰 | **높음·중간 0, 낮음 2 수정**: ① `requestKeywordOp`가 라이브러리의 `error`/`unknownAction` 코드를 그대로 넘겨 예외 문구가 `GVN.<문구>`로 표시될 수 있음 → 나머지 코드는 `Keywords.Timeout`으로(0.3.0에서 플레이어가 보던 결과) ② `api.openKeywordManager()`가 Promise 대신 창을 반환 → `render()` Promise로 복원. 지적만(무수정): `chatTools()`의 멤버 검사가 `!== undefined`(0.3.0은 truthy; chat-tools는 함수라 무차이). 라이브러리 `{v1,v2}` 확장은 문자열 호출자(item-crafting·monster-maker·vitalist)에 영향 없음 확인 |
| **실제 월드** | pf1 스크래치 월드(chat-tools 0.6.0): 설정 23·메뉴·lang("타자 효과(글자당 ms)") · 스테이지 마운트(slots 6, dialogue) · 토글 버튼 `ui-control icon fa-solid fa-masks-theater gvn-toggle active`+aria → 클릭 시 설정 토글·스테이지 hidden · `broadcastStage(true)` · 발화자 바 뒤 `.gvn-expr-strip` · 키워드 매니저(`#gvn-keyword-manager`, 검색 "gob" 입력 → 닫기 → 열기 시 같은 객체·검색어 유지, 닫힌 뒤 `instance` null) · 키워드 추가(폼 submit → GM 로컬 경로 → 설정 list ["고블린"] → 행 1·`resolveKeyword` 성공) · 표정 설정 창(`gvn-expressions-<id>`, 재오픈 동일·레지스트리, 닫은 뒤 null) · pf1 시트 헤더 `gvn-expressions|표정`(2번째) · 로그 플레이어 창(`gatos-dialog gvn-player-dialog`, 소스 2, autoplay, 재생/취소) · 내보내기 번들에 `*.player.html`·`log.json.vn` · **콘솔 에러 0**. 미검증: 플레이어 클라이언트 소켓(stage/remove 브로드캐스트 수신, keyword 요청) |
| 소요 | 1세션 |

## 4단계 — gatos-header-menu 0.1.0 → 0.2.0 (2026-10-26)

| 항목 | 결과 |
|---|---|
| JS 줄 수 | 376 → 374 (**−2**) + lib.js 4. 설정 7개를 `mod.registerSettings(table, { keyStyle: "raw" })`로(camelCase 키·`GATOSHM.Settings.<key>.Name/Hint` 유지, `known`은 hidden, `configure` 메뉴는 `menu:` 항목으로 같은 위치), 설정 창은 `formDialog`(0.1.0 마크업 그대로, `cancel: false`로 저장 버튼만), `_renderOuter` 래핑은 `wrapMethod`, `csvList`/`esc`/`mod.setting`/`mod.setSetting`/`mod.exposeApi`. css·lang **바이트 동일** |
| 라이브러리 변경 | **libWrapper는 호출 파일의 패키지 id만 허용**(스택을 읽음) — 라이브러리 안에서 `libWrapper.register(mod.id, …)`를 부르면 `LibWrapperPackageError: Module gatos-lib is not allowed to call libWrapper with package_id='gatos-header-menu'`(실제 월드에서 발견; 토글이 시트 렌더 시 주입되지 않음). `wrapMethod(mod, path, fn, type, { register, unregister })`로 확장: 모듈이 자기 파일에서 정의한 콜백을 넘기면 자기 id로 등록(0.1.0과 동일), 없으면 `gatos-lib` id로 등록, libWrapper가 거부하면 경고 후 수동 래퍼로 폴백. README 갱신, 테스트 26건 통과 |
| 유지한 것 | 헤더 버튼 수집·숨김·드롭다운·`refreshHeader` 전부 자기 코드, `closeApplication` 정리, api(`hiddenFor` 등) ready에 노출, `setup`에서 래핑 |
| 스모크 diff | 설정 7 + 메뉴 1 동일 · api 동일 · 훅 +init 1 |
| 의도적 동작 변경 | 설정 창에 `gatos-dialog` 클래스(스타일 영향 없음 — 라이브러리 css는 `.gatos-pick-row`/`.gatos-check-row`만), module.json `maximum: 13` 제거(완화) |
| 독립 리뷰 | **중간 1, 낮음 1 수정**: ① libWrapper 등록 주체가 gatos-lib로 바뀜(충돌 알림·사용자 우선순위가 라이브러리 이름으로) → `register/unregister` 콜백으로 0.1.0과 동일하게 복원 ② 설정 창에 취소 버튼이 생김(DialogV2.prompt는 확인만) → `cancel: false`. 수동 폴백의 호출 규약(`fn.call(this, original.bind(this), ...args)`)은 0.1.0과 일치 확인 |
| **실제 월드** | pf1 스크래치 월드: Tester 시트 헤더 `configure-token · gatos-header-menu-toggle · close`, 숨김 3(`configure-sheet`·`gvn-expressions`·`gatos-pf1-item-crafting-open`), 툴팁 "헤더 버튼 3개 더 보기" · 드롭다운 4항목(+"표시할 버튼 고르기…", z-index 102) · 설정 창(`gatos-dialog gatos-header-menu-config`, 460px, 행 5, 체크 close/configure-token, 저장) → keep `"close, gatos-pf1-item-crafting-open, configure-token, my-extra, other"` 저장 후 헤더 즉시 갱신 · 숨긴 항목 클릭 시 원래 핸들러(표정 설정 창 열림) · `_renderOuter`에 libWrapper 래퍼 존재("WARNING: libWrapper wrappers present!") · 콘솔 에러 0 |
| 소요 | 1세션 |

## 4단계 — gatos-pf1-spirit-totem 0.1.0 → 0.2.0 (2026-10-26)

| 항목 | 결과 |
|---|---|
| JS 줄 수 | 32 → 39 (**+7**; init 가드 추가) + lib.js 5. 두 훅의 변경 제거 루프를 `pf1lib.stripRollChanges(changes, parts, { keepIds: ["_bab"], dropParts: ["@sizeBonus"] })` / `stripRollChanges(changes, undefined, { keepIds: [] })`로 |
| 스모크 diff | 설정 0·api 0 동일 · 훅 +init 1 |
| 독립 리뷰 | 결함 0. 지적만: `changes`가 배열이 아니면 0.1.0은 예외(훅 로그), 0.2.0은 조용히 건너뜀 — pf1은 항상 배열 |
| **실제 월드** | pf1 스크래치 월드: 무기 "Spirit Slam"(플래그 spiritTotem) 공격 시 changes `["_bab"]`, parts `[]`, proficient true, secondaryPenalty "0"; 피해 changes 0; "Plain Club"은 무변화 · 콘솔 에러 0 |
| 비고 | PLAN §10 #3의 유보 그대로 — 이 크기의 모듈은 의존성이 느는 만큼의 이득이 거의 없음(줄 수는 오히려 +7). 통일성 목적으로만 전환 |

## 4단계 — gatos-coc7-ko 0.2.0 → 0.3.0 (2026-10-26)

| 항목 | 결과 |
|---|---|
| JS 줄 수 | 39 → 48 (**+9**; init 가드·주석) + lib.js 4. `renderJournalPage(doc, pageId)`(v13 `render({force, pageId})`/v12 분기), `HOOKS.journalRender` 두 훅, `mod.registerSettings`(하드코딩 한국어 name/hint 그대로 — lang/ko.json은 시스템 번역 전용), `mod.exposeApi({ open })`. module.json 최소 12 → 13. 백업 zip은 module.json/scripts/lang/README만(packs 제외) |
| 스모크 diff | 설정 1 동일 · api `open` 동일 · lang 미해결 = 하드코딩 문구(이전과 동일) |
| 독립 리뷰 | 결함 0 |
| **실제 월드** | **CoC7 스크래치 월드 `gatos-lib-test-coc7`(CoC7 8.16) 신규 생성**: `api.open()` → "크툴루의 부름 7판 시스템 매뉴얼 [ko]"(21페이지) 열림·`open(pageId)` 페이지 점프 일치 · 시스템 매뉴얼(`CoC7.system-doc`) 열기 → redirect on: 시스템 시트 닫힘+한국어판 열림 / off: 시스템 시트 그대로 · 설정(client, default true) · 콘솔 에러 0(서버의 무효 패키지 경고 2건은 기존) |

## 4단계 — gatos-coc7-free-occupation 0.2.0 → 0.3.0 (2026-10-26)

| 항목 | 결과 |
|---|---|
| JS 줄 수 | 95 → 102 (**+7**; init 가드) + lib.js 4. 마법사 프로토타입 1회 패치를 `patchPrototypeOnce(mod, app, "_prepareContext", fn)`로(심볼 마커·언랩 반환 → `!!`로 "방금 패치됨"), `mod.setting("worldOccupationsOnly")`, `mod.registerSettings`(하드코딩 한국어) |
| 스모크 diff | 설정 1 동일 · 훅 +init 1 |
| 독립 리뷰 | 결함 0. 지적만: 마커가 own property 검사(0.2.0은 프로토타입 체인) — 마법사 서브클래스가 있으면 두 번 감쌀 수 있으나 CoC7에는 클래스가 하나 |
| **실제 월드** | CoC7 스크래치 월드: 월드 직업 "자유 직업 테스트"(기능 0, personal 0, CoC ID) 생성 → 액터 디렉터리 "탐사자 생성 마법사" 클릭 → 프로토타입에 `_prepareContext` own + `Symbol(gatos-coc7-free-occupation._prepareContext)` 마커 1회 · 직업 페이지: freeOccupation true, 옵션 2(월드 직업 포함), `.occupation-skills` 앞에 "모든 기능 (자유 선택)" · `worldOccupationsOnly` true → 옵션 월드 1개만 · 직업 기능 페이지: canNext true, 첫 form-group이 안내 문구·나머지 제거·status-block 제거 · 포인트 페이지: 모든 기능 isOccupation(빈 월드라 기능 0개 — 분기만 확인) · 콘솔 에러 0 |

## 4단계 종합 (4/4 완료, 2026-10-26)

- 전환 대상 14개 모듈 중 **14개 완료**(파일럿 4 + 2단계 4 + 3단계 2 + 4단계 4). 공통 라이브러리 gatos-lib 1.0.0-alpha.1 / gatos-pf1-lib 1.0.0-alpha.1.
- 4단계에서 배운 것: libWrapper 등록은 반드시 모듈 자기 파일에서 — 라이브러리 헬퍼는 콜백을 받는 형태여야 함(`wrapMethod` 확장). 작은 모듈(spirit-totem·coc7 두 개)은 줄 수가 오히려 늘어남 — PLAN §10 #3 유보 확인.
- 여전히 미검증: 플레이어 클라이언트 소켓 중계(단일 클라이언트 브라우저), `modules/` git 저장소 여부(사용자 결정 대기).
- 2026-10-26: 검증이 끝나 backups/*.zip(전환 전 소스)은 삭제하고 저장소에서도 뺌(*.zip 무시). 전환 전 코드는 header-menu·item-crafting의 git 이력에만 남음.
