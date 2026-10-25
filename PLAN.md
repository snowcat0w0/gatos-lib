# gatos-lib 기획안 — Gato's 모듈 공통 라이브러리

작성일 2026-10-25 · 상태: **기획 (코드 수정 없음)** · 대상 Foundry v13 (verified 13)

이 문서는 `G:\FoundryVTT\Data\modules\gatos-*` 14개 모듈(JS 약 22,000줄)을 전부 읽고, 공통 코드를 하나의 라이브러리 모듈 `gatos-lib`로 묶을 수 있는지 분석한 결과와 설계안이다. 이 폴더에는 아직 이 문서만 있다(module.json 없음 → Foundry 가 패키지로 인식하지 않음).

---

## 0. 결론 요약

1. **묶을 수 있다.** 14개 모듈은 같은 사람이 같은 시기에 같은 관례로 작성해 구조가 거의 동일하다. 소켓 릴레이 5종, 설정 등록, `L()`/`setting()`, 씬 컨트롤 버튼, 시트 헤더 버튼 V1/V2 쌍, 싱글톤 창 + 위치 저장, DialogV2 폼 추출, 선택 리스트 다이얼로그, PF1 체력/상태 조회 등이 2~9개 모듈에 복제돼 있다.
2. **줄 수 압축 효과는 크지 않다.** 정직하게 추정하면 실제로 제거되는 중복은 **약 1,200~1,500줄**, 라이브러리 자체가 **약 900~1,100줄**이므로 전체 코드량은 22,000 → 약 21,600줄(−2~4%)이다. 에이전트 분석에서 "라이브러리 후보"로 분류된 약 5,800줄(26%) 대부분은 *일반화는 가능하지만 현재 소비자가 한 모듈뿐*인 코드다. 이런 코드는 옮기면 줄 수가 줄지 않고 간접 참조만 늘어난다. `game.i18n.localize("X.Y")` → `mod.L("Y")` 같은 치환도 글자만 줄고 줄 수는 그대로다.
3. **비용은 코드가 아니라 재검증이다.** 라이브러리는 디스크에 한 벌만 설치되므로 라이브러리의 모든 변경은 14개 모듈에 동시에 퍼진다. 각 모듈을 전환할 때마다 기존 검증 시나리오를 다시 돌려야 하고, 소켓이 있는 5개 모듈은 GM+플레이어 2클라이언트가 필요하다. 대략 **라이브러리 0단계 2~3세션 + 모듈당 1세션(14) + 전체 회귀 1~2세션**으로 보면 20세션 안쪽이다. −2~4%의 줄 수를 위해 치를 비용으로는 크다.
4. **진짜 이득은 다른 곳에 있다.**
   - 버전 호환(v13→v14) 분기점을 한 곳(`compat`)으로 모음. 현재 각 모듈이 `foundry.applications.ux.TextEditor.implementation ?? TextEditor` 류를 제각각 처리.
   - **소켓 보안 모델 통일.** 5개 모듈이 3가지 설계를 쓰고, 발신자 검증 유무가 모듈마다 다르다(§3.2, §5.4).
   - 새 모듈 작성 시 보일러플레이트 0에서 시작. 설정·소켓·버튼·다이얼로그를 선언형으로.
   - (라이브러리와 무관하게 지금 고칠 수 있는 것) 분석 중 발견한 버그 2건 — vitalist의 `pf1-party-panel` id 오타, light 소켓 권한 미검사(§9). 이것은 라이브러리의 이득으로 세지 않는다.
5. **구조는 두 라이브러리로 나눈다(§5.0).** `gatos-lib`(시스템 무관: 보일러플레이트·소켓·호환·UI·데이터·유틸)와 `gatos-pf1-lib`(PF1 전용: 체력·상태·버프·아이템 매칭·굴림·휴식·시트 앵커·규칙 데이터). PF1 모듈 8개는 둘 다, 시스템 무관 모듈 6개(chat-tools, visual-novel, turn-control, header-menu, coc7 ×2)는 `gatos-lib`만 의존한다. 줄 수는 한 라이브러리 안의 `pf1/` 하위 폴더와 같지만, 시스템 무관 라이브러리가 `pf1` 전역을 전혀 모르게 되고, pf1 시스템 내부 API 변동의 영향 범위가 14개가 아니라 8개로 줄며, 같은 패턴으로 나중에 `gatos-coc7-lib`를 붙일 수 있다.
6. **권고:** Tier 1(2개 이상 모듈에서 실제 중복인 코드)만 라이브러리화하고, Tier 2(단일 소비자지만 범용)는 두 번째 소비자가 생길 때 옮긴다. **선행 조건으로 `modules/` 폴더에 git 저장소를 만들고**(현재 없음), 소형 PF1 모듈 4개로 파일럿한 뒤 계속할지 결정한다(§7).

---

## 1. 분석 범위와 방법

| 항목 | 내용 |
|---|---|
| 대상 | `gatos-chat-tools`, `gatos-visual-novel`, `gatos-pf1-vitalist`, `gatos-pf1-item-crafting`, `gatos-turn-control`, `gatos-pf1-buff-finder`, `gatos-pf1-light`, `gatos-pf1-party-panel`, `gatos-pf1-monster-maker`, `gatos-header-menu`, `gatos-pf1-hero-points`, `gatos-coc7-ko`, `gatos-coc7-free-occupation`, `gatos-pf1-spirit-totem` |
| 읽은 것 | 모든 `scripts/**/*.js`, `src/*.mjs` 전문. `module.json`, `templates/*.hbs`, `styles/*.css`, `lang/*.json`, `PLAN.md`/`README.md`는 훑어봄 |
| 방법 | (1) 전 모듈 grep 교차 분석(훅, API, 관용구) (2) 5개 그룹 병렬 심층 분석 (3) 중복 매트릭스 작성 (4) 정량화 |
| 제외 | `packs/`(컴펜디움 DB), 이미지, 번역 데이터 JSON |

---

## 2. 현황 인벤토리

| 모듈 | JS 줄 | 시스템 | socket | 설정 수 | DialogV2 호출 | AppV2 클래스 | Hooks | lang 접두 | CSS 접두 | 모듈 의존 |
|---|---:|---|:-:|---:|---:|---:|---:|---|---|---|
| gatos-chat-tools | 5,345 | any | – | 28(+images/compat 4) | 12 | 1 | 67 | `GCT.` | `gct-` | – |
| gatos-visual-novel | 4,897 | any | Y | 4(+메뉴) | 1 | 3 | 27 | `GVN.` | `gvn-` | requires chat-tools ≥0.2.0 |
| gatos-pf1-vitalist | 2,644 | pf1 | Y | 6 | 13 | 2 | 20 | `PF1VITALIST.` | `pf1vit-` | requires pf1-psionics |
| gatos-pf1-item-crafting | 2,198 | pf1 | – | 9 | 3 | 2 | 4 | `PF1CRAFT.` | `gatos-pf1-item-crafting*` | – |
| gatos-turn-control | 1,455 | any(+pf1 어댑터) | Y | 13 | 0 | 1 | 15 | `GTC.` | `gtc-` | – |
| gatos-pf1-buff-finder | 1,256 | pf1 | Y | 5 | 1 | 1 | 9 | `GPF1BF.` | `gpf1bf-` | – |
| gatos-pf1-light | 1,174 | pf1 | Y | 6 | 2 | 0 | 15 | `GPF1L.` | `gpf1l-` | – |
| gatos-pf1-party-panel | 1,038 | pf1 | – | 6 | 3 | 2 | 13 | `PF1PARTY.` | `pf1pp-` | – |
| gatos-pf1-monster-maker | 884 | pf1 | – | 0 | 0 | 1 | 3 | `GPMM.` | `gpmm-` | – |
| gatos-header-menu | 376 | any | – | 7 | 1 | 1 | 4 | `GATOSHM.` | `gatos-header-menu-` | recommends lib-wrapper |
| gatos-coc7-ko | 322 | CoC7 | – | 1 | 0 | 0 | 3 | (하드코딩) | – | – |
| gatos-pf1-hero-points | 281 | pf1 | – | 5 | 1 | 0 | 3 | `PF1HP.` | `gpf1hp-` | – |
| gatos-coc7-free-occupation | 95 | CoC7 | – | 1 | 0 | 0 | 2 | (하드코딩) | – | – |
| gatos-pf1-spirit-totem | 32 | pf1 | – | 0 | 0 | 0 | 2 | – | – | – |
| **합계** | **21,997** | | 5 | 96 | 41 | 15 | 187 | | | |

관찰:
- lang 접두와 CSS 접두 체계가 **모듈마다 다르다**(축약형 `GTC.`/`gtc-`, 모듈 id 기반 `.gatos-pf1-item-crafting`, 시스템 접두 `PF1VITALIST.`). 라이브러리와 무관하게 통일 가이드가 필요하지만, 기존 모듈의 접두를 바꾸는 것은 이 기획의 범위 밖(§10).
- `game.modules.get(id).api` 노출 시점이 `init`(대부분)과 `ready`(header-menu)로 갈린다.
- 템플릿 프리로드 시점이 `init`(chat-tools, crafting, VN)과 `setup`(vitalist)으로 갈린다.
- libWrapper는 header-menu만 선택 사용. light(`ItemScriptCall.prototype.execute`), free-occupation(`InvestigatorWizard.prototype._prepareContext`)은 수동 패치.

---

## 3. 공통 패턴 카탈로그 (중복 매트릭스)

표기: 모듈 약칭 CT=chat-tools, VN=visual-novel, VIT=vitalist, CRF=item-crafting, TC=turn-control, BF=buff-finder, LT=light, PP=party-panel, MM=monster-maker, HM=header-menu, HP=hero-points, CK=coc7-ko, FO=free-occupation, ST=spirit-totem.

### 3.1 A. 모듈 보일러플레이트

| 패턴 | 등장 | 현재 모습 | 비고 |
|---|---|---|---|
| `MODULE_ID` 상수 파일 | 전부 | `constants.js:1` 또는 도메인 파일에 | TC는 `systems/generic.js:22`에 리터럴 재선언 |
| localize 헬퍼 `(k,d)=> d ? format : localize` | CT `constants.js:18`, VN `constants.js:15`, TC `tracker.js:5`, LT `sources.js:14`, CRF `crafter.js:10`, HM `module.js:20`, MM `dialog.js:9`, HP `sheet.js:3` **와** `hero-points.js:5`(같은 모듈 2회) | 이름이 `L`/`i18n`/`loc`로 다르고, 접두 자동 붙임 여부도 다름 | VIT·BF·PP는 `game.i18n.*` 직접 호출(VIT 약 150회, PP 40회) |
| `setting(key)` getter | CT, VN, LT, HP(`settings.js` 끝), TC(`getSetting`), HM(try/catch 판) | 1~7줄 | BF·PP·MM·VIT는 `game.settings.get(MODULE_ID, …)` 인라인 |
| 설정 등록 verbose 반복 `game.settings.register(MODULE_ID, k, {name:"X.Settings.K.Name", hint:…, scope, config, type, default})` | CT 240줄(28개), TC 125줄(13개), PP 53줄, VIT 48줄, LT 48줄(**6개 전부 Boolean world true**), HP 44줄, BF 29줄 | 이미 sugar를 쓰는 곳: CRF `reg()`(1줄), VN `reg()/name()`(2줄), HM `reg()`(3줄) | name/hint 키 규약이 `K.Name/K.Hint`(대부분) vs `K`/`KHint`(PP, BF)로 갈림 |
| `TEMPLATES` 경로 테이블 + `loadTemplates` | CT, VN, VIT, CRF, BF(PARTS 인라인), TC | | CRF만 `foundry.applications.handlebars?.loadTemplates ?? loadTemplates` 폴백 |
| `esc = foundry.utils.escapeHTML(String(s ?? ""))` | CT 5회(viewer/whisper/token-hud/session/export), TC `chat.js:5`, LT `sheet.js:9`·`vision.js:152`, BF 2회(폴백형), VN 2회, HP, PP, HM | 모듈 내부에서도 반복 | MM `builder.js`는 순수성 유지를 위해 자체 구현 |
| API 노출 `game.modules.get(id).api = {…}` (+`globalThis` 별칭) | 전부(ST 제외) | BF `globalThis.gatosBuffFinder`, PP `globalThis.pf1PartyPanel`, VIT `globalThis.pf1Vitalist` | |
| 키바인딩 토글 등록 | CT 2개, BF, PP, VIT, VN | 8~17줄 동일 골격 | |
| `${MODULE_ID} \|` 콘솔 접두 | 전부 | | |

### 3.2 B. 소켓 / GM 릴레이 (5개 모듈, 설계 3종)

| 모듈 | 파일 | 설계 | GM 게이트 | 발신자 검증 | 반환 | GM 없음 알림 |
|---|---|---|---|---|---|---|
| TC | `socket.js` 35줄 | `handlers Map` + `registerHandler(action, fn(data,user))` + `runAsGM(action,data)` | `game.user.isActiveGM` | `game.users.get(msg.userId)` (null 미검사) | void | warn `GTC.Warn.NoGM` |
| BF | `socket.js` 41줄 | TC와 동일 설계 | `game.user.isActiveGM` | `if(!user) return` 있음 | **boolean** (apply.js:158가 사용) | warn `GPF1BF.Warn.NoGM` |
| LT | `socket.js` 80줄 | `switch(msg.type)` 4종 + owner-else-emit 래퍼 | `game.users.activeGM?.isSelf` | **없음** (userId 미전송) | boolean | error `GPF1L.Notify.NoGM` |
| VIT | `socket.js` 113줄 | `switch(msg.type)` 4종 + owner-else-emit 래퍼 + `applyHealthLocal`(PF1 로직) | `activeGM?.isSelf` | 서버가 붙여 주는 2번째 인자 `senderId`로 `testUserPermission(sender,"OWNER")` (flags만) | – | error `PF1VITALIST.Notify.NoGM` |
| VN | `socket.js` 88줄 | `switch(data.type)` + **요청/응답**(`requestId`, 8초 타임아웃, `requests Map`) | 타입별(`isGMUser(sender)` / `isActiveGM()`) | `userId` 페이로드 첨부 | `{ok, error}` | 설정 변경 브로드캐스트 포함 |

Foundry v13 서버 사실(`resources/app/dist/server/sockets.mjs` `handleCustomSocket` 확인): 모듈 소켓 `module.<id>`는 `socket.broadcast.emit(event, data, senderUserId)` 로 릴레이되어 **수신 핸들러의 2번째 인자가 발신자 User id**다. 또 `game.socket.emit(event, data, { recipients: [userId, …] })` 로 특정 유저에게만 보낼 수 있다. 따라서 VIT/LT의 `(msg, senderId)` 시그니처는 올바르고, TC/BF/VN이 페이로드에 `userId`를 따로 넣는 것은 중복이다. 라이브러리는 서버가 주는 `senderId`를 쓰고, 응답은 `recipients`로 요청자에게만 보낸다.

→ 하나의 `createSocket(mod)` 로 통일 가능. BF판(user null 가드, boolean 반환)을 기본으로, VN의 요청/응답을 `request()`로 추가. **LT는 전환 시 핸들러별 권한 검사를 반드시 추가해야 한다**(§5.4, §9). 5개 파일 합계 357줄 중 릴레이 골격은 약 250줄이고, 나머지(VIT `applyHealthLocal` ~30, VN stage/keyword 업무 로직 ~40, LT 래퍼 ~35)는 각 모듈 또는 `gatos-pf1-lib/health.js`로 간다.

### 3.3 C. Foundry 버전 호환 심

| 패턴 | 등장 |
|---|---|
| `html instanceof HTMLElement ? html : html?.[0]` (render 훅 jQuery/HTMLElement 양쪽 수용) | CT 11곳, TC 2, BF 1, LT 2, MM 1, HP 1, VN 1 → **19곳** |
| `foundry.applications.ux.TextEditor.implementation ?? TextEditor` | PP `party-panel.js:31`, VIT `collective-panel.js:43`, VN `compat.js:9` |
| `foundry.applications.ux.DragDrop.implementation ?? DragDrop` | PP, VIT |
| `foundry.applications.apps.FilePicker.implementation` | CT 3곳, MM, VN |
| `foundry.applications.ux.FormDataExtended` | CT 5곳, LT, MM, VN |
| `foundry.applications.handlebars.renderTemplate` | CT 5곳, VN compat |
| 씬 컨트롤 `Array.isArray(controls)` v12/v13 분기 | BF `module.js:100-108`, PP `module.js:109-117`, VIT `module.js:229-234` — **3곳 거의 동일 21줄** |
| `canvas.tokens.setTargets(ids,{mode})` v13 / `updateTokenTargets` v12 | PP `party-panel.js:44-62`, VIT `collective.js:426-439` |
| `bringToFront?.() ?? bringToTop?.()` | BF |
| `foundry.appv1?.api?.Application ?? globalThis.Application` | HM 2곳 |
| 액터 시트 헤더 훅 쌍 `getActorSheetHeaderButtons`(V1) + `getHeaderControlsActorSheetV2`(V2) | CRF `module.js:66-89`, VIT `module.js:189-212`, VN `expression-config.js:287-309`, MM(V1만) — **24줄 × 3** |
| 저널 `sheet.render({force,pageId})` v13 / `render(true,{pageId})` v12 | CK(분기 있음), PP(v12식만), VN keyword-manager(v13식만) |
| 저널 훅 쌍 `renderJournalEntrySheet`/`renderJournalSheet` | CK |
| `effect.name ?? effect.label`, `effect.img ?? effect.icon` | TC generic.js |
| VN `compat.js` 전체 36줄 (generation, FilePicker, TextEditor, renderTemplate, ContextMenu, 훅 이름 표, mountPoint, isChatPopout) | **그대로 라이브러리 시드** |

### 3.4 D. Application / Dialog 패턴

| 패턴 | 등장 | 줄 |
|---|---|---|
| **싱글톤 AppV2** `static instance` + `open()`/`toggle()`/`_onClose`에서 null | BF, PP, CT viewer(`static get instance`), VN keyword-manager, VIT(`static instances Map` per-actor), VN expression-config(`#open Map` per-doc), CRF(`foundry.applications.instances` 스캔) | 6~35줄 × 7 |
| **창 위치/크기 저장** client 설정 `position` ← `close()`/`_onClose` | BF(`left/top/width/height`), PP(`left/top/width`) | 10줄 × 2 |
| **DialogV2 폼 추출** `callback:(ev,button)=> button.form ?? button.closest("form")` + `querySelector` 또는 `new FormDataExtended(button.form).object`, `rejectClose:false` | CT 9, VIT 11, PP 3(+`#dialogRoot`), CRF 3, LT 2, HP 1, HM 1, VN 1, BF 1 → **41곳**, 각 15~25줄 골격 | ≈600 |
| **체크박스/라디오 선택 리스트 다이얼로그** `<label class="X-pick"><input type=checkbox\|radio name=id><img><span>` + checked 수집 | PP 2(버프/상태, 45+50줄), HP(라디오 효과 15), HM(keep 체크 20), VIT spirit-of-many(**최대 N개 강제** 55), VIT 라디오 피커 54, LT vision(3버튼 10) | ≈250 |
| `pickOne(list, labelFn, title)` select 프롬프트(1개 이하면 즉시 반환) | LT `drop.js:32-42`, VIT 리더 선택 `module.js:169-183`, VIT Transfer Wounds | 11~15 × 3 |
| `DialogV2.confirm({rejectClose:false})` | CT 2, VIT 2, CRF 3, BF 1(Shift로 생략) | 5 × 8 |
| 폼 변경 → 상태 머지 → `render()` 라이브 프리뷰 (`_onChangeForm` + `FormDataExtended` + `expandObject`) | MM `dialog.js:122-128`, CRF `dialog.js:201-220`, CRF import-dialog | |
| 설정 메뉴 AppV2 (`registerMenu` + form + `templates/generic/form-footer.hbs`) | TC `BlockingConditionsConfig`(체크박스 리스트), VN `DisplaySettingsConfig`(월드 기본값+개인 덮어쓰기), HM(DialogV2 런처) | |
| 디바운스 검색 입력 + 커서 복원 후 부분 렌더 | CT viewer, VN keyword-manager, BF(재렌더 없이 DOM 재정렬) | |
| 액터/아이템 드롭 → `fromDropData` | PP(DragDrop), VIT(DragDrop + `getDragEventData`), CRF(수동 `JSON.parse(text/plain)`), VN keyword-manager | 방식 불일치 |
| 부분 렌더 디스패치 `_preparePartContext(partId)` | BF, CT | |

### 3.5 E. 액터 / 토큰 / 유저 해석

| 패턴 | 등장 |
|---|---|
| 선택/타겟 토큰 → 고유 액터 (`canvas.tokens.controlled` / `game.user.targets`, Set 중복 제거, `user.character` 폴백) | BF `getTargetActors` 14줄, BF module 1줄, VIT 4곳 인라인, LT `recipients`, CT whisper `tokensForTarget` |
| `tokensFor(actor)` 현재 씬 토큰(visible or owner) | PP 4줄, VIT 4줄, LT `actorTokenDocs` 5줄 + vision.js 중복, TC group.js |
| `resolveActor(uuid)` → Actor 또는 Token.actor | VIT 12줄, CT whisper, VN speakerDocs |
| 토큰 타겟 토글/패닝 `token.control({releaseOthers}) + canvas.animatePan` | PP 24줄, VIT 10줄 |
| **활성 GM 자기 판정** `game.user.isActiveGM` vs `game.users.activeGM?.isSelf` | TC 6곳(isActiveGM), BF 1, LT 2(isSelf), VIT 1(isSelf), CT `isLeadGM`(혼합), VN `isActiveGM()` |
| **"한 클라이언트만 쓴다" 게이트** `actor.activeOwner?.isSelf ?? activeGM?.isSelf` | LT `isResponsible`, TC combat.js:193, VIT `maybeSync`(id 최솟값 소유자), VIT `getChooser` |
| GM-or-OWNER 권한 `user.isGM \|\| doc.testUserPermission(user,"OWNER")` | TC `canControl`, BF `gmMayActFor`, VN `canEdit` 3회, CT `canEdit/canDelete`, VIT 6곳, PP 2곳 |
| `actor.isOwner` 가드 + `ui.notifications.warn(…NotOwner)` | HP 4, PP 6, LT 3, CRF 4, VIT 21 |
| 소유자/GM 유저 목록 `game.users.filter(u => u.isGM \|\| actor.testUserPermission(u,"OWNER"))` | CT `tokenOwners`/`gmUsers`, VIT HealthSense, CRF GM 귓속말 |
| 이름순 정렬 `localeCompare(b.name, game.i18n.lang)` | PP 5, BF 3, VIT 1, HM 1(lang 없음) |

### 3.6 F. 시스템 고유(PF1) 헬퍼 — 8개 PF1 모듈

| 패턴 | 등장 |
|---|---|
| **Wounds&Vigor 변형 감지** `game.settings.get("pf1","healthConfig")` 2~3단 폴백 | VIT `collective.js:353-362`, PP `party-panel.js:243-250`, TC `pf1.js:24-32` |
| **체력 요약** `{value,max,temp,nonlethal,path}` hp 또는 vigor | VIT `getHealth` 14줄, PP 19줄, TC `getHealth` 8줄 |
| HP 상태 분류 dead/dying/disabled/unconscious/critical/wounded | PP 9줄, VIT panel 9줄, TC `hpStateBlockers` |
| `hp.offset` 저장 방식 gotcha | VIT collective-healing(value **또는** offset 변경 감지), TC pf1.js 주석 |
| 조건 레지스트리 `pf1.registry.conditions.get(id)` → `{name,texture,journal}` | PP, VIT, TC, BF |
| 버프 아이템 생성/활성 `type:"buff"`, `system.{active,level,duration.start}`, `item.setActive()`, `isActive` | BF `apply.js:37-77`, LT `use.js:30-68`(재점화 트릭), PP(드롭→`system.active`), TC pf1.js |
| 피트/클래스 **이름·태그 매칭** | VIT `getFeature`(`system.tag` **단수**, 괄호 제거 이름), CRF `matchTable`(`system.tags` **배열**, `prefix:key`, 설정 오버라이드), TC pf1.js(diehard/ferocity), LT 종족명 | **pf1 필드가 `tag`/`tags` 두 가지** — 통합 매처는 둘 다 검사 |
| 능력치 `system.abilities[k].{total,mod}` | PP, VIT, MM `abilityMod` |
| 방어/세이브/이니셔티브/CMD 경로 | PP 13줄 |
| XP/레벨/클래스/종족 | PP 16줄, VIT `getHitDice`, LT `raceOf`, MM |
| 굴림 결과 정규화 `result?.rolls?.[0] ?? result?.roll` | VIT `steal-life.js:139`, CRF `extractRoll` |
| 휴식 감지 | CRF `pf1ActorRest` 훅, VIT `options.pf1?.action==="rest"` 폴백 3종 — **같은 이벤트 다른 경로** |
| 컴펜디움 아이템 인덱스 캐시 (`pack.getIndex({fields})`, `pack.visible`, 월드 아이템 포함, 메모이즈) | BF `catalog.js:19-69`, CRF 주문 인덱스 `crafter.js:166-211`, MM `featIndex` `dialog.js:251-274` |
| 액션 피해 합산 `shared.chatAttacks[0].damage.rolls` | VIT 3곳(모듈 내부 중복) |
| 터치 AC 명중 판정 | VIT 2곳(모듈 내부 중복) |
| `RollPF.safeRollSync` 5인자, `action.duration` 해석 | LT `actionDuration` |
| 감각 경로 `system.traits.senses.*`, `flags.pf1.customVisionRules` | LT |
| 시스템 어댑터 인터페이스 `conditions()/hint()/getHealth()/hpStateBlockers()/rollStabilize()` + 기능 플래그 | TC `systems/index.js` — **라이브러리 레벨 개념으로 승격 후보(Tier 2)** |
| PF1 roll change 스트리핑 (`changes._id==="_bab"`, `@sizeBonus`) | ST |
| 아이템 boolean flag `hasItemBooleanFlag` | ST |

### 3.7 G. 채팅 메시지 헬퍼

| 패턴 | 등장 |
|---|---|
| **채팅 카드 생성** `ChatMessage.implementation.create({speaker: getSpeaker({actor}), content:<div class="X-card"><header><i class=fa…> 제목</header>…, flags:{[MODULE_ID]:{…}}})` | HP 2, TC `post()` 14줄(+GM 귓속말 `visibility`), CRF `postChat`(GM 귓속말 옵션), VIT **8곳**, BF 1(`author`, `getSpeaker({user})`) |
| 시스템 마커 카드 `speaker:{alias}`, `style: OTHER` | CT `postMarker` |
| 메시지 메타데이터 버튼 `<a class="X-btn"><i inert>` | CT 3곳(edit/bookmarks/token-hud) |
| 컨텍스트 메뉴 옵션 `options.push({name,icon,condition(li),callback(li)})` + `li.dataset.messageId` | CT 3곳, TC(combatant), VN(actor directory) |
| `rerenderVisibleMessages()` `.chat-message[data-message-id]` → `ui.chat.updateMessage` | CT 2곳 |
| `renderMessageContent(message)` | CT(VN이 API로 소비) |
| `htmlToText(html)` / `plainText` / `stripTooltips` | CT 2종, VN 3종(순수 파일 중복) |
| 채팅 입력 버튼 바인딩 `button[data-actor-uuid]` → `fromUuid` → `isOwner` | TC chat.js, HP, VIT |

### 3.8 H. 시트 / UI 주입

| 패턴 | 등장 | 줄 |
|---|---|---|
| **씬 컨트롤 툴 추가**(token 레이어, `button:true`, `onChange`+`onClick`) | BF, PP, VIT | 21 × 3 |
| **액터 시트 헤더 버튼 V1+V2** | CRF, VIT, VN, MM(V1) | 24 × 3 + 11 |
| **토큰 HUD 버튼** `.col.left|right` + `button.control-icon.X` + 클래스로 중복 방지 + tooltip + click preventDefault/stopPropagation | BF `module.js:114-136`, LT `drop.js:131-158`(`make()` 팩토리) | 23 + 28 |
| 전투 트래커 버튼/배지 `inline-control combatant-control icon` | TC `makeButton/makeBadge` 24줄 | |
| **`#chat-controls` 버튼 주입** `button.ui-control.icon.fa-*` + 클래스 idempotent | CT **3곳**(viewer/images/whisper), VN stage(+ContextMenu) | 11~22 × 4 |
| 채팅 UI 재렌더 훅 세트 `renderChatInput`+`renderChatLog`(+`collapseSidebar` 지연) | CT 5세트, VN 1 | |
| 입력창 위 바 마운트 `textarea.before(bar)` — **적재 순서 상호 의존**(speaker bar → whisper bar → image tray → VN strip) | CT 3, VN 1 | |
| 시트 섹션/탭 주입 (`.tab.details` fieldset / `.tab.summary .attributes` 박스, 중복 방지 클래스, `isEditable`→disabled) | LT `sheet.js`, HP `sheet.js`, VIT `spirit-of-many.js`(AttackDialog, jQuery) | |
| 디렉터리 헤더 버튼 `.directory-header .header-actions ?? .action-buttons` | MM | |
| **libWrapper-or-manual 래핑** | HM `installWrapper()` 12줄(libWrapper 분기), LT `compat.js` 12줄(수동), FO `patchPrototypeOnce` 8줄(미export 클래스 프로토타입 1회 패치) | |
| 오버레이 마운트 `#interface` + 사이드바/핫바 인셋 측정 + `ResizeObserver` | VN stage, CT token-hud(상단 고정) | |
| 범용 popover 메뉴(위치 클램프, 외부 클릭/Esc 닫기) | HM `openMenu/closeMenu` 73줄 | Tier 2 |

### 3.9 I. DOM / 문자열 / 날짜 / 수학 유틸

| 패턴 | 등장 |
|---|---|
| **키별 디바운스** `pending Map<key, timeout>` (+실행 중 재요청 병합) | TC `scheduleSync` 22줄(병합 있음), LT `refreshActor` 16줄, VN `scheduleRebuild` 5, CT 수제 debounce 3곳 |
| `foundry.utils.debounce` 리렌더 | TC, BF 2, PP, VIT, CT |
| 날짜 포맷 `pad`/`fmtDate`/`fmtDateTime`/`startOfDay`/`parseDateInput` | CT `constants.js:21-61`(41줄), CT reorder `toLocalInput`(pad 재정의), CT export `stamp`(pad 3번째), VN 2곳 |
| 텍스트 정규화 | BF `normalize`(NFKD+소문자+공백), VIT `slug`(영숫자만), CRF `norm`(trim/lower/공백) — 3종 |
| 검색 점수 `scoreEntry`/`isSubsequence` | BF 34줄 (Tier 2) |
| `stripEnrichers`, `localizeMaybe` | BF |
| 숫자 강제 `Number(x ?? 0) \|\| 0`, `num/numOrNull/bool/str/toArray`, `clamp`, `clampPct`, `signed`, `fmt` | MM 21줄, HP, PP 3개, VIT, CRF 3개(+`fmt` 중복 정의), TC `round6` |
| `escapeRegExp`, `mdEscape`, `shortHash`, `safeFilename`(CT 내부 2회), `fileNameOf`(CT, VN) | CT, VN |
| Data 폴더 보장 + 업로드 `FilePicker.browse/createDirectory/upload` | CT **내부 2종**(`ensureFolder`/`ensureDirectory`), CT `uploadJson` |
| 파일 다운로드 `saveDataToFile` / Blob `<a download>` | CT, VN(순수) |
| CSV 설정 파싱 `split(",").map(trim).filter(Boolean)` | HM 2, CRF 1, CRF dialog 3 |
| EN/KO 겸용 정규식 테이블 | LT 25줄, TC 1, MM damage alias |
| TTL 맵, 재진입 가드 Set, 직렬 작업 큐 | VIT, VN |

### 3.10 J. 데이터 / 플래그 / 저장

| 패턴 | 등장 |
|---|---|
| 플래그 읽기 기본값+정규화 `getFlag(id,k) ?? default` → 숫자/배열 검증 | HP, VIT, CRF, MM, VN `getExpressions`, TC `getDelay` |
| **플래그 삭제 키** `` `flags.${id}.-=${k}` `` | TC 4곳, LT 3곳, CT 2곳, VN 2곳 |
| **자기 발신 업데이트 마커** `options[MODULE_ID]` 쓰기/읽기 | TC(객체), LT(`true`, 15곳), VIT(`pf1Vitalist` 객체), CT(`gctDuplicate`) |
| `hasProperty(changes, path)` 변경 감지 / `WATCHED` 경로 목록 | LT 3, TC 2, CT, VN |
| **유저 플래그 스토어**(set/unset/`-=`삭제, `updateUser` 훅으로 `flags.<id>.<k>` 감시) | CT 3종(bookmarks/whisperTarget/lockedSpeaker·favorites), BF(recent MRU 8개/favorites), VN(`current` 표정 맵) |
| **설정을 JSON 스토어로** (`config:false, type:Object`) + `updateSetting` 훅 비교 | CT(`archiveIndex`,`session`), VN(`keywords`), TC(`blockingConditions`), BF(`uiState`,`position`), PP(`party` Array,`position`), VN(`displayOverrides`) |
| 월드 기본값 + 클라이언트 덮어쓰기 `display(key)` | VN `settings.js:102-121` + `DisplaySettingsConfig` 68줄 — 범용 컴포넌트 후보(Tier 2) |
| 토큰 필드 원본 보관/복원 `flags.X.base` | LT |
| 버전 플래그 `{data, version}` + 정규화 겸 마이그레이션 | MM, VIT steal-health `synced`, CT `ARCHIVE_VERSION`, VN 3종 |
| 월드 Data 폴더 JSON 저장소 + 설정 인덱스 + 캐시버스터 + 툼스톤 | CT archive(Tier 2) |

### 3.11 K. 모듈 간 API / 확장점

| 패턴 | 등장 |
|---|---|
| 프로바이더 레지스트리(등록 순 호출, 첫 non-null 승, try/catch 격리) | CT `registerPortraitProvider` 24줄 |
| 액션 레지스트리(Map, `visible()` 필터, 변경 훅) | CT `registerViewerAction` 31줄 |
| 의존 모듈 게이트 `game.modules.get(id)?.active && api?.member` + `isNewerVersion` | VN `chatTools()/chatToolsHooksAvailable()` 11줄, CT `chatImagesActive`, VIT psionics 확인, **VIT→party-panel(id 오타로 항상 실패)** |
| 커스텀 훅 접두 규약 | CT `gct*` 16종, VN `gvn*` 5종 |
| 훅 폴백 선택(새 훅 있으면 그것, 없으면 코어 훅) | VN `gctSpeakerResolved` vs `preCreateChatMessage` |

### 3.12 M. Node 빌드 스크립트 (CK만)

`createRequire("G:/Foundry Virtual Tabletop/resources/app/")` → `classic-level`, Windows `import.meta.url` 경로 변환, BOM 제거 읽기, 컴펜디움 UUID `relink`, `JournalEntryPage.slugifyHeading` 미러, 테이블 결과 동기화. 번역 모듈이 하나뿐이라 **Tier 2**. 라이브러리 런타임과는 별개 `tools/` 디렉터리 후보.

---

## 4. 압축 가능성 정량 평가

### 4.1 분류 기준

- **Tier 1 — 실제 중복**: 2개 이상 모듈에 같은 목적의 코드가 있음. 라이브러리로 빼면 복제본이 사라짐. *이것만이 줄 수를 줄인다.*
- **Tier 2 — 단일 소비자 범용 코드**: 한 모듈만 쓰지만 재사용 가치가 있음(zip 작성기, 분배 다이얼로그, 검색 점수, popover 메뉴, 월드 JSON 저장소, 시스템 어댑터). 옮겨도 줄 수는 그대로. **두 번째 소비자가 생길 때** 옮긴다.
- **Tier 3 — 모듈 고유**: 규칙·데이터·UI 본문. 건드리지 않음.

### 4.2 Tier 1 절감 추정 (보수적)

| # | 패턴 | 현재 합계(줄) | 라이브러리(줄) | 전환 후 모듈 잔여(줄) | **순절감** |
|---|---|---:|---:|---:|---:|
| 1 | 소켓 릴레이 5종(골격만, 업무 로직 제외 — §3.2 끝) | ~250 | 90 | 5모듈 × ~10 핸들러 등록 | **~110** |
| 2 | 설정 등록 verbose → 선언형 테이블 | ~670 | 40 | 약 55%(name/hint 자동, 공통 기본값) | **~300** |
| 3 | `L`/`setting`/`esc`/`MODULE_ID`/api 노출 보일러플레이트 | ~110 | 30 | 14 × 2 | **~50** |
| 4 | 씬 컨트롤 툴 ×3 | 63 | 15 | 3 × 5 | **~33** |
| 5 | 시트 헤더 버튼 V1/V2 쌍 ×3 + V1 ×1 | 83 | 25 | 4 × 6 | **~34** |
| 6 | 싱글톤 AppV2 + 위치 저장 ×7 | ~115 | 50 | 7 × 3 | **~45** |
| 7 | 토큰 HUD 버튼 ×2, 트래커 버튼 | 75 | 25 | 3 × 6 | **~30** |
| 8 | DialogV2 폼 추출/확인/프롬프트 골격 ×41 (content HTML은 모듈 고유라 제외; 사이트당 골격 6~8줄 중 3~5줄 절감) | ~300 | 60 | 41 × 3 | **~170** |
| 9 | 선택 리스트 다이얼로그 ×7 | ~250 | 70 | 7 × 10 | **~110** |
| 10 | PF1 체력/W&V/HP 상태 ×3 | ~80 | 35 | 3 × 2 | **~40** |
| 11 | PF1 조건·버프·매처·굴림 정규화·휴식 감지 | ~120 | 60 | ~20 | **~40** |
| 12 | 타겟/선택 추적 → 리렌더 훅 묶음 ×3 + 액터 해석(resolve/tokensFor/setTargets) | ~150 | 60 | ~30 | **~60** |
| 13 | 활성 GM / 책임 클라이언트 / 권한 가드 | ~60 | 20 | ~15 | **~25** |
| 14 | 채팅 카드 ×13 | ~110 | 25 | 13 × 4 | **~35** |
| 15 | 키별 디바운스 + 수제 debounce | ~65 | 25 | ~10 | **~30** |
| 16 | 유저 플래그 스토어 ×3, 설정 JSON 스토어 감시 | ~110 | 40 | ~20 | **~50** |
| 17 | html 루트 정규화 ×17, compat 심 ×20곳 | ~45 | 40(VN compat 승격) | 0 | **~5** |
| 18 | 날짜/pad ×3, 텍스트 정규화 ×3, 숫자 강제, safeFilename ×2, ensureDir ×2 | ~120 | 60 | ~10 | **~50** |
| 19 | 레지스트리(provider/action) + 의존 모듈 게이트 | ~70 | 50 | ~10 | **~10** |
| 20 | 플래그 헬퍼(`-=` 키, self-update 마커, getFlagOr) | ~40 | 15 | ~15 | **~10** |
| | **합계** | **~2,900** | **~835** | **~900** | **≈1,200** |

여기에 Tier 1 전환 시 함께 정리될 모듈 내부 중복(VIT 터치 AC ×2·피해 합산 ×3, CT esc ×5·pad ×3·ensureDir ×2, HP i18n ×2, CRF fmt ×2)을 더하면 **총 순절감 약 1,200~1,500줄**, 라이브러리 **약 850~1,000줄**(+ lang/css ~100줄). `game.i18n.*` → `mod.L` 같은 호출 치환(VIT ~150회, PP ~40회)은 **줄 수에 넣지 않았다**. CSS와 hbs는 거의 공유되지 않는다(공유 가능한 CSS는 선택 행 `.X-pick-row`, 카드 `.X-card` 정도 ~40줄).

### 4.3 Tier 2 후보 (옮겨도 줄 수 불변, 두 번째 소비자 대기)

| 후보 | 출처 | 줄 | 예상 2번째 소비자 |
|---|---|---:|---|
| `DistributeDialog` N포인트 분배 | VIT | ~200 | 치유 분배가 필요한 다른 PF1 모듈 |
| `SearchableList`(normalize/scoreEntry/키보드 네비/DOM 재정렬) | BF | ~130 | 컴펜디움 검색이 필요한 모듈(MM 피트 검색) |
| 컴펜디움 인덱스 캐시 `buildItemIndex({type, fields})` | BF/CRF/MM 3곳 | ~90 | **이미 3곳** → 사실상 Tier 1 경계. 단 필드·필터가 달라 통합 설계 필요 |
| 시스템 어댑터 레지스트리 | TC | ~30 | PF1 전용 모듈을 시스템 공용으로 넓힐 때 |
| 월드 기본값+개인 덮어쓰기 설정창 | VN | ~95 | 화면 설정이 있는 다른 모듈 |
| popover 메뉴 | HM | ~73 | 컨텍스트 메뉴가 필요한 모듈 |
| 오버레이 마운트 + 인셋 측정 | VN | ~22 | CT token-hud |
| 월드 JSON 저장소(Data 폴더 + 설정 인덱스) | CT | ~50 | 로그/스냅샷을 파일로 남기는 모듈 |
| zip 작성기, 이미지 번들링, FS Access, IndexedDB KV | CT | ~250 | 내보내기 기능이 있는 모듈 |
| 하이라이트 TreeWalker | CT | 33 | 검색 UI |
| Node 빌드 도구(LevelDB, relink, slug) | CK | ~90 | 다음 번역 모듈 |
| PF1 액터 요약(능력/방어/XP) | PP | ~60 | 파티·컬렉티브 카드가 있는 VIT |

### 4.4 Tier 3 — 공유 불가 (참고)

VN의 순수 파일 4개(`stage-state`, `stage-dom`, `player-core`, `player-editor`, 2,385줄)는 내보낸 HTML에 `toClassicScript`로 인라인되므로 **라이브러리를 import할 수 없다**. VN 내부 중복(`el`, `plainText`, `stripTooltips`, `escapeHtml`)은 이 제약의 결과다. 공유하려면 §5.7의 별도 전략이 필요하다.

---

## 5. gatos-lib / gatos-pf1-lib 설계

### 5.0 두 라이브러리 구조 (단일 라이브러리 + `pf1/` 하위 폴더와의 비교)

| 관점 | A. 단일 `gatos-lib` + `pf1/` 하위 폴더 (초안) | B. `gatos-lib` + `gatos-pf1-lib` (채택) |
|---|---|---|
| 줄 수 | 동일 | 동일 + 두 번째 module.json/index/README 오버헤드 ~50줄 |
| 시스템 무관 모듈(CT, VN, TC, HM, CK, FO)이 받는 것 | PF1 코드가 같은 패키지에 실림(사용은 안 함) | PF1 코드 0. `gatos-lib`는 `pf1` 전역·`actor.system.*` 경로·PF1 훅을 **전혀 참조하지 않는다**는 규칙을 기계적으로 검사 가능(`grep -r "pf1" gatos-lib/scripts` = 0) |
| pf1 시스템 업데이트로 내부 API가 바뀔 때 | 라이브러리 전체 버전 범프, 14개 모듈 영향 범위 재검증 대상 | `gatos-pf1-lib`만 범프, 영향 범위 PF1 모듈 8개 |
| 시스템 호환 선언 | `gatos-lib`는 `systems` 선언 불가(시스템 무관이어야 함) → `pf1/`가 pf1 아닐 때 안전 폴백을 코드로 보장해야 함 | `gatos-pf1-lib`가 `relationships.systems: [{id:"pf1"}]`를 선언 → pf1 아닌 월드에서 Foundry가 활성화 자체를 막음. 폴백 코드 불필요 |
| 다른 시스템 확장 | `coc7/` 하위 폴더 추가 → 한 패키지가 여러 시스템 지식을 품음 | 같은 패턴으로 `gatos-coc7-lib`(CoC ID 규약: `flags.CoC7.cocidFlag`, 기능 id 생성 — CK·FO가 이미 공유) 추가 가능. 1차 범위 밖 |
| 테스트 | Node 테스트가 `pf1` 전역 스텁을 요구 | `gatos-lib`의 `pure/`·`util/`는 Foundry 전역만 스텁; PF1 전역 스텁은 `gatos-pf1-lib/test`에만 |
| 소비 모듈 의존 선언 | `requires` 1개 | PF1 모듈은 `requires` 2개(gatos-lib, gatos-pf1-lib), shim 1파일에 두 import |
| 병렬 작업 | 라이브러리 변경은 한 세션에서만 | **라이브러리당** 한 세션 — `gatos-lib` 세션과 `gatos-pf1-lib` 세션이 동시에 가능(후자는 전자를 수정하지 않는 조건) |
| 로드 순서 | `library:true` 1개 | 둘 다 `library:true`. `gatos-pf1-lib`가 `gatos-lib`를 정적 import하므로 두 라이브러리 간 순서는 무관 |

**의존 그래프**

```
gatos-lib  (library, 시스템 무관)
  ▲            ▲
  │            │ requires + static import
  │        gatos-pf1-lib  (library, systems: pf1)
  │            ▲
  │            │
  ├── gatos-chat-tools, gatos-visual-novel, gatos-turn-control, gatos-header-menu, gatos-coc7-ko*, gatos-coc7-free-occupation*
  └────────────┴── gatos-pf1-hero-points, -light, -buff-finder, -party-panel, -monster-maker, -item-crafting, -vitalist, -spirit-totem*
                                                                                  (* = §10 결정: 의존을 붙일 가치가 작은 소형 모듈)
```

**배치 규칙** (어느 라이브러리에 두는가)

1. `pf1` 전역(`pf1.config`, `pf1.registry`, `pf1.documents`, `pf1.components`, `RollPF`), `game.settings.get("pf1", …)`, PF1 훅(`pf1ActorRest`, `pf1PostActionUse`, `pf1ToggleActorBuff`, `pf1ClassLevelChange`, `pf1Pre*Roll`, `renderActorSheetPF`, `renderItemSheetPF`), `actor.system.*`/`item.system.*`의 PF1 스키마 경로, PF1 규칙 데이터(종족 감각, 조건 표, 아이템 타입 집합, HP 상태 분류)를 **하나라도** 참조하면 → `gatos-pf1-lib`.
2. Foundry 코어 API만 쓰면 → `gatos-lib`. 액터/토큰/타겟 해석(`resolveTargetActors`, `tokensFor`, `setTargets`), 채팅 카드, 다이얼로그, 주입 헬퍼, 소켓, 설정, 플래그, 컴펜디엄 인덱스 캐시(`itemIndex({type, fields})` — fields는 호출자가 줌)는 전부 코어 API만 쓴다.
3. 경계 사례:
   - `injectSheetSection(app, html, {tab, cls, build})` 일반형 → `gatos-lib`; PF1 시트 앵커를 아는 `injectSummaryBox(app, html, …)`(`.tab.summary .attributes.flexrow`, HP sheet.js) / `injectItemDetailsSection`(`.tab.details`, LT sheet.js) → `gatos-pf1-lib`.
   - 컴펜디엄 인덱스: 캐시·순회·`pack.visible`·월드 아이템 포함 골격 → `gatos-lib/data/compendium.js`; PF1 fields 프리셋 `buffIndex()`(BF `INDEX_FIELDS`), `spellIndex()`(CRF 5필드), `featIndex()`(MM `system.subType`) → `gatos-pf1-lib/compendium.js`.
   - 이름/태그 매칭: 이름만 보는 `matchByName(items, names)` → `gatos-lib`; `system.tag`(단수)/`system.tags`(배열) 를 아는 `matchByTagOrName` → `gatos-pf1-lib`.
   - 시스템 어댑터 레지스트리(Tier 2, TC에서 승격 시): 인터페이스·레지스트리 → `gatos-lib/systems/adapter.js`; PF1 구현 → `gatos-pf1-lib/adapter.js`가 `registerSystemAdapter("pf1", …)` 호출. **turn-control은 1차 범위에서 자기 `systems/pf1.js`(23줄의 PF1 헬퍼 포함)를 그대로 유지**한다 — `gatos-pf1-lib`에 의존시키면 dnd5e 월드에서 활성화가 막히고, 소프트 의존(`requireModule`)은 23줄 때문에 둘 가치가 없다. 허용된 중복으로 기록.
   - pf1-psionics 접근(VIT `getPowerPoints/spendPowerPoints/focus`) → 소비자가 vitalist 하나이므로 vitalist에 남긴다(Tier 2, 장래 `gatos-pf1-lib/psionics.js`).
   - PF1 코어 lang 키 상수(`PF1.Ability*`, `PF1.TempHP`, `PF1.CreateItem*Of` 등) → `gatos-pf1-lib/i18n.js`.
4. `gatos-pf1-lib`는 `gatos-lib`를 **정적 import로 사용**하되 re-export하지 않는다(소비 모듈이 두 라이브러리를 각각 import). 이유: 어떤 코드가 어느 라이브러리에 의존하는지 import 문에서 보이게.

### 5.1 설계 원칙

1. **정적 ESM import.** 소비 모듈은 `scripts/lib.js` 한 파일에 shim을 두고 내부에서는 `./lib.js`만 import한다(깊은 폴더의 `../../../` 실수 방지, 라이브러리 경로 변경 시 한 곳만 수정). 상대 경로이므로 routePrefix 환경에서도 안전하다. 브라우저가 import를 먼저 해석하므로 **init 순서 문제가 없다**. `game.modules.get("gatos-lib").api` / `("gatos-pf1-lib").api` 는 매크로/콘솔 편의용으로만 추가 노출한다.
   ```js
   // 시스템 무관 모듈의 scripts/lib.js
   export * from "../../gatos-lib/scripts/index.js";
   // PF1 모듈의 scripts/lib.js
   export * from "../../gatos-lib/scripts/index.js";
   export * as pf1 from "../../gatos-pf1-lib/scripts/index.js";
   ```
2. **모듈 id 주입.** 라이브러리는 전역 상태를 갖지 않는다. 모든 진입점은 `defineModule(id)` 가 돌려주는 핸들 또는 `moduleId` 인자를 받는다(libWrapper는 등록자 패키지 id를 검증하므로 특히 필수).
3. **Foundry 전역 경계.** `scripts/pure/` 아래는 `game`/`foundry`/`ui`/`canvas`를 쓰지 않는다(VN 인라인 및 Node 테스트용). 그 밖은 자유.
4. **시스템 분리.** `gatos-lib`는 `pf1` 전역과 PF1 스키마 경로를 **참조하지 않는다**(§5.0 배치 규칙; `grep -r "pf1" gatos-lib/scripts` 가 0이어야 하고 이를 테스트로 둔다). PF1 지식은 전부 `gatos-pf1-lib`에 있고, 그 모듈은 `relationships.systems: pf1`로 pf1 월드에서만 활성화된다.
5. **명시적 선택(opt-in).** 라이브러리가 훅을 자동 등록하거나 DOM을 건드리지 않는다. 모든 동작은 소비 모듈이 호출해야 일어난다. 예외: 없음.
6. **기존 공개 표면 불변.** 각 모듈의 `api`, 커스텀 훅 이름(`gct*`, `gvn*`), 플래그 네임스페이스, 설정 키, lang 키, CSS 클래스는 **그대로 유지**한다. 라이브러리 도입은 내부 구현 교체다.
7. **동작 변경 금지, 단 두 가지 예외.** (a) 소켓 권한 검사 추가(§5.4) (b) 명백한 버그 수정(§9). 둘 다 별도 커밋으로 분리한다.

### 5.2 패키지 구조

```
modules/gatos-lib/
├── module.json              id "gatos-lib", title "Gato's Library", library: true,
│                            esmodules ["scripts/index.js"], styles ["styles/lib.css"],
│                            languages ko/en, compatibility {minimum 13, verified 13}
├── PLAN.md                  (이 문서)
├── README.md                API 요약 + 마이그레이션 가이드
├── scripts/
│   ├── index.js             시스템 무관 공개 표면 re-export + LIB_VERSION
│   ├── core/
│   │   ├── module.js        defineModule(id, {langPrefix, settingsPrefix})
│   │   ├── settings.js      registerSettings(table), settingStore, onSettingChanged, overridesStore
│   │   ├── compat.js        impl.*, htmlRoot, generation, HOOKS 표, renderJournalPage
│   │   ├── socket.js        createSocket(mod, {noGMKey}) → {registerHandler, init, runAsGM, request}
│   │   ├── hooks.js         onAll(hooks, fn), watchTargets, watchActors, keyedDebounce
│   │   └── wrap.js          wrapMethod(mod, target, name, fn, type), patchPrototypeOnce(mod, instance, name, fn)
│   ├── users.js             isActiveGM, hasActiveGM, isLeadGM, isResponsibleClient, canControl, gmUsers, ownersOf
│   ├── actors.js            resolveActor, resolveTargetActors, tokensFor, setTargets, toggleTargetActor, panToActor, byName
│   ├── chat.js              postCard, speakerFor, messageOf, rerenderVisibleMessages, jumpToMessage, chatLogs,
│   │                        addChatControl, onChatUiRender, metadataButton, pushMessageContextOption
│   ├── ui/
│   │   ├── app.js           SingletonMixin, PerDocumentMixin, persistPosition, readForm, dialogRoot
│   │   ├── dialogs.js       formDialog, confirm, promptText, promptNumber, pickOne, pickList
│   │   ├── inject.js        addSceneControlTool, addActorSheetHeaderButton, addTokenHudButton,
│   │   │                    injectSheetSection, addDirectoryHeaderButton, makeControlButton
│   │   └── dom.js           el, esc, debounce, trackModifierClass
│   ├── data/
│   │   ├── flags.js         getFlagOr, flagKey, flagDeleteKey, isSelfUpdate, userFlagStore, userListFlag, stashField
│   │   ├── registry.js      providerRegistry, actionRegistry, requireModule
│   │   └── files.js         ensureDataDir, uploadToData, uploadJson, download, safeFilename, fileNameOf
│   ├── util/
│   │   ├── text.js          normalize, slug, norm, stripEnrichers, localizeMaybe, escapeRegExp, csvList
│   │   ├── time.js          pad, fmtDate, fmtDateTime, fmtTime, startOfDay, endOfDay, parseDateInput, toLocalInput, stamp
│   │   └── num.js           num, numOrNull, bool, str, toArray, clamp, clampPct, signed, fmtNumber
│   ├── data/compendium.js   itemIndex({type, fields, includeWorld, packFilter}) 캐시 + invalidate  (BF/CRF/MM 골격; fields는 호출자)
│   ├── systems/
│   │   └── adapter.js       registerSystemAdapter / getAdapter   (Tier 2 — 1차 범위 밖, 자리만; PF1 구현은 gatos-pf1-lib가 등록)
│   └── pure/
│       ├── dom.js           el, escapeHtml, plainText, stripTooltips
│       └── fn.js            debounce, keyedDebounce (Foundry 무의존 버전)
├── styles/lib.css           .gatos-pick-row, .gatos-check-row, .gatos-card, .gatos-dim, .gatos-danger (~40줄)
├── lang/ko.json, en.json    GATOSLIB.{NoGM,NotOwner,GMOnly,Pick,None} (코어에 없는 문구만, ~8키)
└── test/*.test.mjs          node --test (pure/, util/, settings 테이블 변환, choices 변환, "pf1" 문자열 0건 검사)

modules/gatos-pf1-lib/
├── module.json              id "gatos-pf1-lib", title "Gato's PF1 Library", library: true,
│                            relationships: { requires: [{id:"gatos-lib", compatibility:{minimum:"1.0.0"}}], systems: [{id:"pf1", compatibility:{minimum:"11"}}] },
│                            esmodules ["scripts/index.js"], compatibility {minimum 13, verified 13}
├── README.md                API 표 + 의존하는 pf1 내부 API 목록(버전 민감 지점)
├── scripts/
│   ├── index.js             아래 re-export + PF1LIB_VERSION. `import { … } from "../../gatos-lib/scripts/index.js"` (re-export 안 함)
│   ├── health.js            usesWoundsAndVigor(3단 폴백), getHealth → {value,max,temp,nonlethal,missing,path,raw}, hpState, applyHealthDelta(dualHeal), changedHealth(offset gotcha)
│   ├── conditions.js        conditionInfo(id) → {name,texture,journal}, activeConditions(actor)
│   ├── buffs.js             buildBuffData, applyBuffFromSource, setBuffActive, reigniteBuff, activeBuffs, buffDurationLabel
│   ├── items.js             PHYSICAL_TYPES, SHEET_TYPES, matchByTagOrName(items, {tags, names}) — `system.tag`/`system.tags` 모두, classByTagOrName
│   ├── actor.js             abilityMod, abilities(actor), defenses(actor), xp(actor), getHitDice, hasConstitution, raceOf, isCharacter
│   ├── rolls.js             extractRoll, sumAttackDamage(actionUse), hitsTouchAC(attackRoll, actor), stripRollChanges(changes, parts, {keepIds, dropParts}), actionDuration(action, rollData)
│   ├── rest.js              onActorRest(cb) — pf1ActorRest 훅 1차 + updateActor options.pf1 폴백, 중복 억제
│   ├── spells.js            spellbooks(actor), maxCasterLevel(actor)
│   ├── compendium.js        buffIndex(), spellIndex(), featIndex() — gatos-lib itemIndex에 PF1 fields 프리셋
│   ├── senses.js            SENSE_PATHS, readSenses, writeSenses, refreshTokenVision(_syncSenses)
│   ├── sheets.js            injectSummaryBox(app, html, …) [.tab.summary .attributes.flexrow], injectItemDetailsSection(app, html, …) [.tab.details], onActorSheetPF/onItemSheetPF(V1 훅 래퍼)
│   ├── i18n.js              PF1 코어 lang 키 상수(PF1.Ability*, PF1.TempHP, PF1.Nonlethal, PF1.CreateItem*Of …)
│   ├── data.js              RACE_SENSES(LT), HP 상태 분류표, 조건 id 표(TC pf1 CONDITIONS 중 공용 부분)  — Tier 2, 자리만
│   └── adapter.js           registerSystemAdapter("pf1", …)  — Tier 2, 자리만
└── test/*.test.mjs          pf1 전역 스텁 + 순수 수학(abilityMod, hp 상태, 통화 환전 등)
```

### 5.3 API 명세 (주요 시그니처)

아래는 1차 범위(Tier 1). 각 항목 뒤 괄호는 흡수되는 원본.

**core/module.js**
```js
const mod = defineModule("gatos-pf1-light", { langPrefix: "GPF1L", settingsPrefix: "GPF1L.Settings" });
mod.id                      // "gatos-pf1-light"
mod.L(key, data?)           // `${langPrefix}.${key}` localize/format      (CT/VN L, TC L, LT i18n, CRF L, HM L, MM loc, HP i18n)
mod.Lraw(key, data?)        // 접두 없는 전체 키
mod.setting(key)            // game.settings.get(id, key)                   (CT/VN/LT/HP setting, TC getSetting, HM try/catch판)
mod.setSetting(key, v)
mod.registerSettings(table) // §아래
mod.template(name)          // `modules/${id}/templates/${name}.hbs`       (CT/VN/VIT/BF TEMPLATES)
mod.preloadTemplates(names, partials?)
mod.flag(doc, key, dflt?)   // getFlagOr
mod.flagKey(key)            // `flags.${id}.${key}`
mod.flagDeleteKey(key)      // `flags.${id}.-=${key}`
mod.isSelfUpdate(options)   // options[id] 마커 검사
mod.mark(options?)          // {...options, [id]: true}
mod.exposeApi(obj, {global?})  // game.modules.get(id).api = obj (+globalThis[global])
mod.log/warn/error(...)     // `${id} |` 접두
mod.notify.info/warn/error(key, data?)  // ui.notifications.*(mod.L(key, data))
```

**core/settings.js** — 선언형 테이블
```js
mod.registerSettings({
  autoDetect:   { type: Boolean, default: true },                       // scope "world", config true, name/hint 자동
  portraitSize: { scope: "client", type: Number, default: 40, range: {min:24, max:80, step:4}, onChange: "portraitsChanged" },
  portraitShape:{ scope: "client", type: String, default: "square", choices: ["square", "circle"] },
  archiveIndex: { hidden: true, type: Object, default: { list: [] } },  // config:false, name/hint 생략
  blockingMenu: { menu: { type: BlockingConditionsConfig, icon: "fa-solid fa-face-dizzy", restricted: true } },
});
// 키 규약: name `${settingsPrefix}.${PascalKey}.Name`, hint `.Hint`. 기존 모듈 중 PP/BF는 `Key`/`KeyHint` 규약 → 전환 시 lang 키 이름 변경 또는 `nameKey/hintKey` 명시 옵션 사용.
// choices: 배열은 `game.settings.register`에 그대로 넘기면 깨진다(StringField가 Object.entries로 읽어 value가 "0","1"이 됨).
//   라이브러리가 등록 **전에** `{ square: "GCT.Settings.PortraitShape.Square", circle: "…Circle" }` 객체로 변환한다(값 키 → PascalCase, `topLeft`→`TopLeft`).
//   저장값은 키 그대로이므로 기존 데이터 마이그레이션 없음. 객체를 직접 넘기면 그대로 사용.
// onChange: 함수 대신 문자열을 주면 `Hooks.callAll(`${id}.${name}`, value)` 로 디스패치 → settings.js가 기능 파일을 import하는 순환(CT/VN/TC에 존재)을 끊는 선택지.
settingStore(mod, key)            // {get(), set(v), update(fn)} deepClone 기반      (CT archiveIndex/session, VN keywords, TC blockingConditions)
onSettingChanged(mod, key, fn)    // updateSetting 훅에서 `${id}.${key}` 비교        (CT viewer, VN keyword-manager)
overridesStore(mod, {worldKeys, clientKey})  // VN display()/displayOverrides 패턴 (Tier 2 — 자리만)
```

**core/socket.js**
```js
const socket = createSocket(mod, { noGMKey: "Warn.NoGM" });   // 기본 GATOSLIB.NoGM
socket.registerHandler(action, async (data, user) => {...});  // GM 측. user = 서버가 붙여 준 senderId로 조회한 User(없으면 핸들러 미호출)
socket.init();                                                // ready에서 game.socket.on(`module.${id}`, (msg, senderId) => …)
await socket.runAsGM(action, data) → boolean                  // GM이면 로컬 실행, 아니면 활성 GM에 릴레이. false = GM 없음  (TC/BF runAsGM, LT/VIT emit 래퍼)
await socket.request(action, data, { timeout = 8000 }) → any  // 요청/응답. 응답은 emit(…, { recipients: [senderId] })로 요청자에게만   (VN requestKeywordOp)
socket.broadcast(action, data)                                // 전원(GM 발신 검증은 핸들러가 `user.isGM`로)                 (VN stage/remove)
// 권한 헬퍼(핸들러 안에서 사용)
assertOwner(user, doc)        // user.isGM || doc.testUserPermission(user, "OWNER") 아니면 throw
asOwnerOrRelay(doc, localFn, action, data)  // doc.isOwner ? localFn() : runAsGM(action, data)   (LT createItems/updateItems, VIT applyHealth/applyDamage)
```

**core/compat.js**
```js
impl.TextEditor() / impl.FilePicker() / impl.DragDrop() / impl.FormDataExtended() / impl.ContextMenu() / impl.ImagePopout()
renderTemplate(path, data) / loadTemplates(paths)                 // 폴백 포함
htmlRoot(html)              // html instanceof HTMLElement ? html : html?.[0]      (17곳)
generation()                // game.release.generation
HOOKS.actorSheetHeader = { v1: "getActorSheetHeaderButtons", v2: "getHeaderControlsActorSheetV2" }
HOOKS.actorContext = "getActorContextOptions"
HOOKS.journalRender = ["renderJournalEntrySheet", "renderJournalSheet"]
renderJournalPage(doc, pageId)   // v12/v13 시그니처 분기                            (CK, PP, VN)
bringToFront(app)                // bringToFront?.() ?? bringToTop?.()
mountPoint(), isChatPopout(app)  // VN compat 그대로
```

**core/hooks.js**
```js
onAll(["createItem","updateItem","deleteItem"], fn)                               // for-루프 7곳
watchTargets(fn, { selected = true, targeted = true, character = true })        // controlToken/targetToken(user.id 검사)/canvasReady/updateUser.character 묶음  (BF/PP/VIT)
watchActorDocs(fn, { items: ["buff","class"], effects: true, tokens: true })    // 액터 관련 CRUD 묶음 (PP/VIT/TC)
keyedDebounce(fn, ms, { coalesce = true })  → (key, ...args)                     // TC scheduleSync(실행 중 재요청 병합) + LT refreshActor 통합
```

**core/wrap.js**
```js
wrapMethod(mod, "foundry.appv1.api.Application.prototype._renderOuter", fn, "WRAPPER")  // libWrapper 활성 시 libWrapper.register(mod.id, …), 아니면 수동 (HM installWrapper)
wrapPrototypeMethod(mod, cls.prototype, "execute", fn)                                   // 경로 문자열이 없는 대상 (LT compat)
patchPrototypeOnce(mod, instance, "_prepareContext", fn)                                 // 미export 클래스, Symbol(mod.id) 마커 (FO)
```

**users.js / actors.js**
```js
isActiveGM()                       // game.user.isActiveGM                        (TC/BF/LT/VIT/VN/CT 6종 표기 통일)
hasActiveGM()
isLeadGM()                         // CT
isResponsibleClient(actor, { fallbackGM = true })  // actor.activeOwner?.isSelf ?? (fallbackGM && activeGM?.isSelf)   (LT isResponsible는 폴백 있음, TC combat.js:193은 비GM 분기에 폴백 없음 → fallbackGM:false)
canControl(user, doc)              // GM || OWNER                               (TC canControl, BF gmMayActFor 기반, VN canEdit, CT canEdit)
gmUsers(), ownersOf(doc, {includeGM})   // CT tokenOwners/gmUsers, VIT HealthSense, CRF
resolveActor(uuidOrId)             // Actor | Token.actor | null                (VIT, CT, VN)
resolveTargetActors({ mode: "selected"|"targeted"|"auto", fallbackCharacter = true }) → Actor[]   (BF getTargetActors, VIT 4곳, LT recipients)
tokensFor(actor, { scene = canvas.scene, visibleOrOwned = true })   // PP/VIT/LT/TC
setTargets(tokenIds, { mode: "replace"|"acquire"|"release" })       // v13 canvas.tokens.setTargets, v12 폴백  (PP/VIT)
toggleTargetActor(actor, { exclusive }), panToActor(actor)          // PP/VIT
byName(a, b)                                                        // localeCompare(game.i18n.lang)  (PP 5, BF 3, VIT, HM)
```

**chat.js**
```js
postCard(mod, { actor?, speaker?, user?, icon, title, body, cls = `${mod.id}-card`, flags = {}, whisper: "gm"|"owners"|User[]|null, rolls? })
      // → ChatMessage.implementation.create                                    (HP 2, TC post, CRF postChat, VIT 8, BF 1)
speakerFor(combatantOrActorOrToken)
messageOf(li)                      // li.dataset.messageId → game.messages.get   (CT 3)
pushMessageContextOption(options, { name, icon, condition(message), callback(message) })
rerenderVisibleMessages(), chatLogs(), jumpToMessage(id)                        (CT)
addChatControl({ cls, icon, label, onClick, position: "append"|"prepend"|{after} })   // #chat-controls 버튼  (CT 3, VN 1)
onChatUiRender(fn, { deferCollapse = true })                                    // renderChatInput+renderChatLog(+collapseSidebar)  (CT 5, VN 1)
metadataButton({ cls, icon, label, onClick })                                   // (CT 3)
```

**ui/app.js**
```js
class BuffFinder extends SingletonMixin(HandlebarsApplicationMixin(ApplicationV2)) {
  static DEFAULT_OPTIONS = { …, gatos: { persistPosition: { mod, key: "position", fields: ["left","top","width","height"] } } };  // 옵션은 정적 필드로(HandlebarsApplicationMixin과 합성 규약 일치)
}
BuffFinder.open(opts) / .toggle() / .instance(null 가능) / .refresh(parts?)    // (BF, PP, VN keyword-manager)
// CT viewer는 `static get instance`가 즉시 생성하는 getter라 의미가 다름 → 전환 시 호출부(`ChatArchiveViewer.instance.render`)를 `.open()`으로 바꿔야 함(§6 CT 행).
class CollectivePanel extends PerDocumentMixin(…) { static DEFAULT_OPTIONS = { …, gatos: { keyFn: (actor) => actor.id } } }
CollectivePanel.open(actor) / .refreshFor(actor) / .refreshAll() / .instances   // (VIT, VN expression-config, CRF instances 스캔)
readForm(formOrButtonOrApp) → object      // FormDataExtended(...).object + multi-select/CSV 처리   (CT 3, CRF 2, MM, LT, VN, VIT 11)
dialogRoot(button)                        // button.form ?? closest("form") ?? closest("dialog")  (PP #dialogRoot, HP, HM)
```

**ui/dialogs.js** — 모두 `rejectClose:false`, 취소 시 `null`. 기본 버튼 라벨은 **Foundry 코어 lang 키**(`Save`, `Cancel`, `Confirm`, `Yes`, `No`, `Close`)를 쓴다 — 라이브러리가 비활성인 반쪽 상태(§5.6)에서도 라벨이 깨지지 않도록. `GATOSLIB.*`는 코어에 없는 문구(NoGM, NotOwner, GMOnly, Pick, None)에만.
```js
await formDialog({ title, icon, content, width, classes, render?, ok: { label, icon, read? = readForm }, cancel? })   // 41곳 골격
await confirm({ title, content, yes?, no? }) → boolean
await promptText({ title, label, value }) → string|null
await promptNumber({ title, label, value, min, max }) → number|null
await pickOne(items, { title, label: (x) => string, value: (x) => string }) → item|null        // 1개 이하면 다이얼로그 없이 반환  (LT/VIT)
await pickList(items, { title, multi = true, max?, img?, label, checked?, buttons? }) → item[]|null   // 체크박스/라디오 행, max 강제 + 카운터  (PP 2, HP, HM, VIT 2, LT)
```

**ui/inject.js**
```js
addSceneControlTool({ layer = "tokens", name, title, icon, order, onClick, visible? })          // v12 배열/v13 record 분기  (BF/PP/VIT)
addActorSheetHeaderButton(mod, { action, cls, icon, label, condition: (actor, sheet) => boolean, onClick, position: "start"|"end" = "start" })
      // V1: buttons.unshift/push({label, class: cls, icon, onclick}); V2: controls.unshift/push({action, icon, label, onClick}); 둘 다 중복 가드(class / action)
      // `cls`는 필수·모듈 고유·결정적 — gatos-header-menu가 V1 버튼을 `class`로 keep/hide 판정하고 known 목록에 저장하므로.  V2 드롭다운은 HM 범위 밖.
      // 기존: CRF/VIT는 unshift, VN은 V2에서 push(expression-config.js:292) → VN은 position:"end"로 전환해 위치 불변  (CRF/VIT/VN/MM)
addTokenHudButton({ side: "left"|"right", cls, icon, tooltip, condition?: (token) => boolean, onClick })   // (BF/LT)
injectSheetSection(app, html, { tab: ".tab.details", cls, build: (actor) => HTMLElement, position = "append" })   // (LT sheet, HP sheet)
addDirectoryHeaderButton(app, html, { cls, icon, label, onClick })      // (MM)
makeControlButton({ classes, icon, label, active?, onClick })           // HUD/트래커 공용  (TC makeButton, BF, LT make)
```

**data/flags.js, data/registry.js, data/files.js**
```js
userFlagStore(mod, key, { default, onChange })   // get/set/unset/toggle + updateUser 감시   (CT 3, BF 2, VN 1)
userListFlag(mod, key, { max })                  // MRU 리스트  (BF recent)
stashField(doc, path, mod, key) / restoreField   // LT light.base
providerRegistry() → { register(fn), first(...args), all(...args) }        (CT portrait)
actionRegistry(hookName) → { register(def), list(ctx), get(id) }           (CT viewerActions)
requireModule(id, { minVersion?, members?: string[] }) → api|null          (VN chatTools, CT chatImagesActive, VIT psionics/party-panel)
ensureDataDir(path), uploadToData(dir, file), uploadJson(dir, name, obj), download(data, type, name), safeFilename(s, dflt), fileNameOf(url)   (CT 2종 통합, VN)
```

**gatos-pf1-lib** — 시그니처는 §5.2 트리 참고. 소비 모듈에서는 `import { pf1 } from "./lib.js"; pf1.health.getHealth(actor)` 형태. 핵심 통합 지점:
- `health.getHealth(actor)` 는 VIT판(`{value,max,temp,nonlethal,missing,path}`)을 채택하고 PP의 wounds/vigor 분리 표시용 `raw` 필드를 추가.
- `health.usesWoundsAndVigor(actor)` 는 VIT의 3단 폴백(`getActorConfig` → `[pc|npc].rules` → `variants`)을 채택.
- `items.matchByTagOrName(items, { tags, names })` 는 `system.tag`(문자열)와 `system.tags`(배열, `[name]` 쌍 허용)를 **모두** 검사. VIT `getFeature` 테이블과 CRF `matchTable` 설정 오버라이드는 각 모듈에 남긴다.
- `rest.onActorRest((actor, {hours}) => …)` 는 `pf1ActorRest` 훅을 1차로, `updateActor` options 폴백을 2차로 등록하고 중복 호출을 억제한다.
- `compendium.itemIndex({ type, fields, includeWorld, packFilter })` 는 BF catalog의 캐시 골격을 채택하고 CRF 주문 인덱스·MM 피트 인덱스를 호출자별 fields로 받는다.

### 5.4 소켓 보안 모델 (통일 후 규칙)

| 규칙 | 내용 |
|---|---|
| 게이트 | 핸들러는 `game.user.isActiveGM`인 클라이언트에서만 실행 |
| 발신자 | 서버가 릴레이 시 2번째 인자로 붙여 주는 `senderId`를 사용(페이로드의 userId는 신뢰하지 않음). `game.users.get(senderId)`가 없으면 **폐기** |
| 권한 | 문서를 쓰는 핸들러는 반드시 `assertOwner(user, doc)` 또는 모듈 자체 정책(BF `allowPlayerTargets` 설정) 호출. 라이브러리는 강제하지 않지만 README에 체크리스트로 명시 |
| 마커 | GM이 대신 쓰는 업데이트는 `mod.mark(options)`로 자기 발신 표시 |
| 응답 | `request()`는 `{ok, error?, data?}` 규약, 타임아웃 기본 8초 |

**LT 전환 시 추가되는 검사**(현재 없음): `createItems`/`updateItems` → `assertOwner(user, actor)`; `createToken` → 발신자가 해당 씬에 토큰 생성 권한(또는 `flags[id].dropped` 마커 유지 + 발신 유저가 원 소유자인지) ; `deleteToken` → 마커 + 발신 유저가 집어 가는 액터의 소유자. 플레이어가 **타인의 액터**에 아이템을 생성하는 경로가 실제로 쓰이는지(횃불 줍기 = 자기 액터) 전환 전에 확인.

### 5.5 버전 / 호환 정책

- 두 라이브러리 각각 semver. `gatos-lib/scripts/index.js`가 `LIB_VERSION`, `gatos-pf1-lib/scripts/index.js`가 `PF1LIB_VERSION` export. 소비 모듈 `module.json`: 시스템 무관 모듈은 `requires: [gatos-lib]`, PF1 모듈은 `requires: [gatos-lib, gatos-pf1-lib]`(둘 다 `compatibility.minimum` 명시). `gatos-pf1-lib` 자신은 `requires: [gatos-lib]` + `systems: [pf1]`.
- **단일 설치본 규칙.** 디스크에는 각 라이브러리 한 벌만 있으므로 소비 모듈이 버전을 고를 수 없다. `gatos-lib` 변경은 14개(의존을 붙인 모듈 전부), `gatos-pf1-lib` 변경은 PF1 8개에 **원자적으로** 퍼진다. 따라서 (a) 라이브러리를 바꾸는 세션은 그 변경에 영향받는 소비 모듈을 **같은 세션에서** 고치고 전부 검증한다, (b) deprecated 별칭 정책은 외부 사용자가 생길 때까지 두지 않는다, (c) 라이브러리 변경은 **라이브러리당** 한 세션 — `gatos-lib` 세션과 `gatos-pf1-lib` 세션은 동시 가능하되 후자는 `gatos-lib`를 수정하지 않는다(필요하면 전자에 요청).
- **pf1 버전 민감 지점은 `gatos-pf1-lib/README.md`에 목록으로 유지**(healthConfig 구조, `setActive`, `getRawEffectData`, `_syncSenses`, `rollAbilityTest`/`rollSkill` 반환형, `ItemScriptCall`, action 스키마). pf1 시스템 업데이트 때 이 목록만 점검하면 된다 — 단일 라이브러리였다면 14개 모듈 재검증 대상이 되는 것을 8개로 줄이는 것이 분리의 실질 이득.
- **`library: true`의 실제 효과**(서버 뷰 코드 확인): `library: true`인 모듈의 `esmodules`/`scripts`는 별도 버킷에 들어가 **일반 모듈보다 먼저** `<script>` 태그로 나온다. 즉 gatos-lib의 최상위 코드와 `Hooks.once("init")` 등록이 모든 소비 모듈보다 먼저 실행된다. `relationships.requires`는 런타임 순서를 바꾸지 않고 모듈 관리 UI에서만 동작한다(미설치 시 `MISSING_DEPENDENCY`로 활성화 차단, 비활성화 시 의존 모듈 안내).
- 라이브러리는 Foundry **13만** 지원(현재 모듈 중 12 호환은 BF/PP/VIT/CRF/HM/CK만, 실제 검증은 전부 13). v12 분기(씬 컨트롤 배열, setTargets 폴백)는 **보존**하되 v12 검증은 비목표.
- v14 대응은 `core/compat.js` 한 곳에서. VN PLAN §10/§16의 v14 미검증 항목이 그대로 라이브러리의 v14 체크리스트가 된다.

### 5.6 로딩 / 의존 선언 패턴

두 가지 실패 상태를 구분한다.

| 상태 | 무슨 일이 일어나는가 | 대응 |
|---|---|---|
| **미설치** (폴더 없음) | 정적 import가 404 → 소비 모듈의 그 `<script type="module">` 전체가 평가되지 않고 콘솔 에러만 남음 | Foundry가 `relationships.requires`로 **활성화 자체를 차단**(모듈 관리창에서 체크박스 비활성 + 툴팁). 실제로 도달하기 어려운 상태 |
| **설치됐지만 비활성** | 서버가 `Data/` 전체를 정적으로 서빙하므로 **import는 성공**한다. 그러나 gatos-lib의 `languages`/`styles`/`esmodules`는 로드되지 않아 `GATOSLIB.*` 키가 원문으로 보이고 `.gatos-*` 스타일이 없고 `game.modules.get("gatos-lib").api`가 undefined인 **반쪽 상태** | 소비 모듈 `Hooks.once("init")` 첫 줄에서 `game.modules.get("gatos-lib")?.active` 검사 → `ui.notifications.error(…, {permanent:true})` + 기능 비활성. 라이브러리 다이얼로그 기본 라벨은 코어 lang 키 사용(§5.3) |

따라서 **정적 import 하나로 충분하고, 2단 동적 `import()` 부트스트랩은 쓰지 않는다**(검토에서 기각: 모듈 최상위에서는 `game`이 아직 선언되지 않아 `ReferenceError`가 나고, `import()` 완료가 `init` 전에 보장되지도 않는다). 사용자에게 보이는 안내가 더 필요하면 `esmodules: ["scripts/guard.js", "scripts/module.js"]` 처럼 **라이브러리를 import하지 않는 독립 guard 스크립트**를 앞에 둔다 — 각 `<script type="module">`는 독립적으로 실패하므로 `module.js`의 import가 실패해도 `guard.js`는 실행되어 `Hooks.once("ready")`에서 알림을 띄울 수 있다.

```js
// scripts/guard.js (선택) — 라이브러리 import 없음
Hooks.once("init", () => {
  const lib = game.modules.get("gatos-lib");
  if (!lib?.active) Hooks.once("ready", () => ui.notifications.error("Gato's PF1 Light: gatos-lib 모듈을 설치·활성화해야 합니다.", { permanent: true }));
});
// scripts/module.js — 기존 진입점. `import { defineModule, … } from "./lib.js";` 정적 import.
```

### 5.7 VN 순수 파일 전략

선택지 두 가지. 1차 범위에서는 **(b)** 로 두고 VN은 건드리지 않는다.
- (a) 라이브러리 `scripts/pure/*.js`를 VN의 `PLAYER_SOURCES`(archive-ext.js:170)에 추가해 같은 `toClassicScript`로 인라인. 조건: `pure/`는 `import * as NS from` 형태 외의 import 금지, export는 `function/const/class` 선두형만. **또한** `toClassicScript`의 경로 정규식(archive-ext.js:205-206)이 `"./name.js"`만 제거하므로 `../../gatos-lib/scripts/pure/x.js` 를 받도록 정규식을 넓히거나, VN 빌드 시 파일을 복사해야 한다.
- (b) VN 순수 파일은 현재 중복을 유지. 라이브러리 `pure/`와 내용만 동기화(수동).

### 5.8 lang / CSS 공용

- lang 공용 키는 `GATOSLIB.*` 15개 내외(Save/Cancel/Confirm/NoGM/NotOwner/GMOnly…). 다이얼로그 헬퍼의 기본 버튼 라벨에만 쓰고, 모듈이 자기 키를 넘기면 그것을 우선.
- CSS는 다이얼로그 선택 행(`.gatos-pick-row`), 카드(`.gatos-card`), 유틸(`.gatos-dim`, `.gatos-danger`)만. 모듈별 접두 클래스는 유지하고, 라이브러리 마크업은 두 클래스를 함께 붙인다(`class="gatos-pick-row pf1pp-pick"`).

---

## 6. 모듈별 마이그레이션 맵

**의존 선언 요약**

| 라이브러리 | 의존 모듈 | 비고 |
|---|---|---|
| `gatos-lib`만 | gatos-chat-tools, gatos-visual-novel, gatos-turn-control, gatos-header-menu, (gatos-coc7-ko, gatos-coc7-free-occupation — §10) | turn-control의 `systems/pf1.js` 23줄 PF1 헬퍼는 허용 중복(§5.0 규칙 3) |
| `gatos-lib` + `gatos-pf1-lib` | gatos-pf1-hero-points, -light, -buff-finder, -party-panel, -monster-maker, -item-crafting, -vitalist, (-spirit-totem — §10) | 8개 모두 이미 `relationships.systems: pf1` 선언 → `gatos-pf1-lib`의 pf1 잠금과 충돌 없음 |

각 모듈에서 교체되는 것과 남는 것. "절감"은 Tier 1 기준 보수적 추정. 아래 표에서 `pf1.*`로 적은 API는 `gatos-pf1-lib`, 나머지는 `gatos-lib`.

| 모듈 | 교체 대상 → 라이브러리 API | 절감(줄) | 주의 |
|---|---|---:|---|
| **gatos-pf1-hero-points** | `i18n`×2→`mod.L`; `setting`; 설정 5개→테이블; `postChange`/사용 카드→`postCard`; 라디오 효과 선택→`pickList({multi:false})`; `DialogV2.prompt` 폼→`formDialog`; `sheet.js` html 정규화→`htmlRoot`, 섹션 주입→`injectSheetSection`; `clamp`→`num.clamp` | ~60 | `renderActorSheetPF` V1 전용 훅은 그대로 |
| **gatos-pf1-light** | `socket.js` 80줄→`createSocket` + 핸들러 4개(**권한 검사 추가**); 설정 6개→테이블 1블록; `i18n`(sources.js)→`mod.L`; `esc`; `pickOne`; vision `DialogV2.wait`→`pickList`; HUD 버튼→`addTokenHudButton`; 시트 섹션→`injectSheetSection`; `refreshActor` 디바운스→`keyedDebounce`; `actorTokenDocs`(2곳)→`tokensFor`; `isResponsible`→`isResponsibleClient`; `recipients`→`resolveTargetActors`; `compat.js` 래핑→`wrapPrototypeMethod`; `-=`/마커→`mod.flagDeleteKey/mark/isSelfUpdate`; 버프 생성/재점화→`pf1.buffs` | ~180 | 소켓 전환은 동작 변경(권한) 포함 → 별도 커밋. `module.js`가 settings.js를 2번 import하는 것도 정리 |
| **gatos-pf1-buff-finder** | `socket.js`→`createSocket`; 설정→테이블; `L`/`setting` 신설; 씬 컨트롤→`addSceneControlTool`; HUD 버튼→`addTokenHudButton`; 싱글톤+위치→`SingletonMixin`; `getTargetActors`→`resolveTargetActors`; 타겟 추적 훅→`watchTargets`; recent/favorites→`userListFlag`/`userFlagStore`; `gmMayActFor`→`canControl`+설정; 카탈로그 캐시→`pf1.compendium.itemIndex`; `normalize`→`util.text`; `postChat`→`postCard`; `escapeHTML` 폴백→`esc` | ~150 | `globalThis.gatosBuffFinder` 유지 여부 결정(§10). `scoreEntry`/키보드 네비는 Tier 2로 남김 |
| **gatos-turn-control** | `socket.js`→`createSocket`; 설정 13개→테이블(`config: pf1` 조건 유지); `getSetting`/`L`/`esc`; `scheduleSync`→`keyedDebounce({coalesce})`; `canControl`; `makeButton`→`makeControlButton`; `post`→`postCard`; html 정규화; `-=`/마커; pf1.js `usesWoundsAndVigor/getHealth`→`pf1.health`; `pf1.registry.conditions`→`pf1.conditions`; `generic.js:22` MODULE_ID 리터럴 제거 | ~110 | `CONFIG.Combat.documentClass` 교체와 어댑터는 그대로. `systems/adapter` 승격은 Tier 2 |
| **gatos-pf1-party-panel** | 설정 6개→테이블; `L`/`setting` 신설; 씬 컨트롤; 싱글톤+위치; `setTargets`/`tokensFor`/`toggleTarget`/`panTo`→`actors`; 타겟·액터 추적 훅→`watchTargets`/`watchActorDocs`; `#dialogRoot`+`DialogV2.wait`×3→`formDialog`/`pickList`×2/`promptNumber`; HP/W&V/능력/방어/XP 요약→`pf1.health`/`pf1.actor.summaries`; 조건→`pf1.conditions`; `getDragEventData/DragDrop` 심→`impl.*`; `signed/fmt/clampPct`→`util.num`; `localeCompare`×5→`byName` | ~200 | PP/BF의 설정 lang 키 규약(`Key`/`KeyHint`)이 라이브러리 기본과 달라 `nameKey/hintKey` 옵션 또는 lang 키 리네임 필요 |
| **gatos-pf1-vitalist** | `socket.js`→`createSocket` + `asOwnerOrRelay`; `applyHealthLocal`→`pf1.health.applyHealthDelta`; 설정 6개(48줄)→테이블; `game.i18n.*` ~150회→`mod.L`(기계적 치환, **줄 수 절감 없음**, 오타 회귀 위험 → 스모크 매크로로 lang 키 미해결 검출 필수); 헤더 버튼 V1/V2→`addActorSheetHeaderButton`; 씬 컨트롤; `instances Map`→`PerDocumentMixin`; `DialogV2.prompt`×11 `button.form` 패턴→`formDialog`/`pickOne`/`promptNumber`; spirit-of-many 체크박스 max 피커→`pickList({max})`; `getHealth/usesWoundsAndVigor/getHitDice/hasConstitution`→`pf1.health`/`pf1.actor`; `resolveActor/tokensFor/targetActors/setTargets`→`actors`; `getChooser`/`maybeSync` 최솟값 소유자→`users`; 채팅 카드 8곳→`postCard`; 터치 AC ×2·피해 합산 ×3→`pf1.rolls`; `slug`→`util.text`; `getFeature` 매처→`pf1.items.matchByTagOrName`(테이블은 유지); `localeCompare` | ~220 | **`pf1-party-panel` id 오타 수정**(§9) → `requireModule("gatos-pf1-party-panel", {members:["getPartyActors"]})`. `collective.js`↔`socket.js` 순환 import는 `applyHealth`가 라이브러리로 가면 해소. `DistributeDialog`는 Tier 2로 남김 |
| **gatos-pf1-item-crafting** | `L`/`reg`/`fmt`×2/`norm`/`num`→`mod`/`util`; 템플릿 폴백→`preloadTemplates`; 헤더 버튼 V1/V2; `foundry.applications.instances` 스캔→`PerDocumentMixin`; `#readForm`×2→`readForm`; 아이템 드롭 수동 파싱→`impl.TextEditor().getDragEventData`; `DialogV2.confirm`×3→`confirm`; `postChat`→`postCard({whisper:"gm"})`; `matchTable`→`pf1.items.matchByTagOrName`(설정 오버라이드는 유지); 주문 인덱스→`pf1.compendium.itemIndex`; `extractRoll`→`pf1.rolls`; `pf1ActorRest`→`pf1.rest.onActorRest`; `settingJSON`/CSV→`util.text.csvList`; 폴더 find-or-create→`data/files` | ~120 | `ItemSpellPF.toConsumable` 등 pf1 내부 API는 모듈에 남김(라이브러리가 pf1 버전 의존을 흡수하지 않음) |
| **gatos-pf1-monster-maker** | `loc`→`mod.L`; `renderActorDirectory` 버튼→`addDirectoryHeaderButton`; V1 헤더 버튼→`addActorSheetHeaderButton`(V2도 자동 획득); `_readForm`→`readForm`; `foundry.applications.instances.get(id)`→`PerDocumentMixin`; `featIndex/resolveCompendiumFeats`→`pf1.compendium.itemIndex`; `escapeHtml`(순수 builder.js)는 **유지**(순수성) | ~50 | `builder.js`는 Foundry 무의존 — 건드리지 않음. `reconcileHp`의 change id는 모듈 전용 |
| **gatos-header-menu** | `L`/`setting`/`reg`→`mod`; `installWrapper`→`wrapMethod(mod, …)`; `DialogV2.prompt` 설정 폼→`formDialog`+`pickList`; `keepList` CSV→`csvList`; AppV1 shim 2곳→`impl` | ~40 | `popoverMenu`는 Tier 2로 남김. libWrapper 등록 id는 `mod.id` |
| **gatos-chat-tools** | `L`/`setting`/`esc`×5/`pad`×3/`TEMPLATES`→`mod`/`util.time`; 설정 25개(240줄)→테이블(~100줄 절감); `html` 정규화 ×9→`htmlRoot`; `DialogV2` 11곳→`formDialog`/`confirm`/`promptText`; `formOf/readForm/readRangeForm`→`readForm`; 채팅 컨트롤 버튼 ×3→`addChatControl`; 재렌더 훅 세트 ×5→`onChatUiRender`; `makeButton`+인라인 2곳→`metadataButton`; 컨텍스트 메뉴 `msg(li)`×2→`messageOf`; 유저 플래그 스토어 ×3→`userFlagStore`; `ensureFolder/ensureDirectory`→`ensureDataDir`; `safeName/safeFilename`→`safeFilename`; 수제 debounce ×3→`debounce`/`keyedDebounce`; `registerPortraitProvider`/`registerViewerAction`→`providerRegistry`/`actionRegistry`(**api 이름·동작 동일 유지**); `chatImagesActive`→`requireModule`; `isLeadGM/tokenOwners/gmUsers`→`users`; viewer `static get instance`(즉시 생성 getter)→`SingletonMixin` 전환 시 호출부 `ChatArchiveViewer.instance.render(…)`→`.open()`으로 변경 | ~250 | **VN 호환 표면 불변**(api 10개, 훅 9개, `.gct-speaker-bar`, `gct-archive-viewer`, `serializeMessage` 스키마, 번들 구조). 훅 등록 **순서 의존**(module.js 주석)을 깨지 않도록 `onChatUiRender` 등은 호출 순서 보존. 입력창 위 바 적재 순서는 그대로(공용 슬롯 도입은 Tier 2, VN 동시 수정 필요). zip/이미지 번들링/idb/FS Access/highlight는 Tier 2 |
| **gatos-visual-novel** | `compat.js` 36줄→라이브러리 `core/compat`(**이 파일이 시드**); `L`/`reg/name`/`setting`→`mod`; `socket.js` 요청/응답→`createSocket().request`; `chatTools()/chatToolsHooksAvailable()`→`requireModule`; 헤더 버튼 V1/V2+컨텍스트 메뉴→`inject`; keyword-manager 싱글톤→`SingletonMixin`; expression-config per-doc→`PerDocumentMixin`; `#chat-controls` 토글→`addChatControl`; `canEdit`×3→`canControl`; 디바운스 ×4→`debounce`; `esc`×2; `DialogV2.wait`→`formDialog`; `displayOverrides` 패턴은 Tier 2(자리만) | ~200 | **순수 파일 4개 불변**(§5.7). settings.js의 순환 import(onChange 콜백)는 `Hooks.callAll` 또는 콜백 등록으로 끊을지 별도 판단 — 라이브러리와 무관 |
| **gatos-coc7-ko** | `renderJournalPage` 분기, 훅 쌍 상수 → `compat`; 설정 라벨 하드코딩→lang 파일(선택) | ~8 | `src/*.mjs` 빌드 도구는 Tier 2 (`gatos-lib/tools/`) |
| **gatos-coc7-free-occupation** | `patchWizard`→`patchPrototypeOnce(mod, …)` | ~8 | 나머지는 CoC7 wizard 내부 결합 — 그대로 |
| **gatos-pf1-spirit-totem** | `changes` 스트리핑→`pf1.rolls.stripRollChanges({keepIds:["_bab"], dropParts:[/^@sizeBonus/]})` | ~8 | 32줄 모듈에 라이브러리 의존을 붙일 가치가 있는지 §10 |
| **합계** | | **≈1,200~1,500** (호출 치환 제외, §4.2와 일치) | |

---

## 7. 단계별 로드맵

### 7.0 선행 조건 (0단계 전에)

1. **버전 관리.** `G:\FoundryVTT\Data\modules`는 현재 git 저장소가 아니다. 롤백 수단이 폴더 백업뿐이므로 `modules/` 에 `git init` 하고 `gatos-*` 14개만 추적(`.gitignore`로 나머지 모듈 제외), 전환 전 상태를 태그(`pre-lib`)로 고정한다. 이 문서의 "별도 커밋"은 모두 이 저장소를 전제한다.
2. **테스트 자산.**
   - `gatos-lib/test/*.test.mjs` — `scripts/pure/`와 `scripts/util/`은 Foundry 전역이 없으므로 `node --test`로 돌린다(normalize, slug, 날짜, 숫자 강제, keyedDebounce, choices 변환, settings 테이블 → register 인자 변환).
   - **스모크 매크로**(스크래치 월드용 스크립트 매크로 1개): 활성 gatos 모듈마다 `game.modules.get(id).api`의 키 집합, `game.settings.settings`에서 `${id}.` 접두 키 집합, `Hooks.events`에서 모듈 소스가 등록한 훅 수, 미해결 lang 키(`game.i18n.localize(k) === k`인 `X.*` 키) 목록을 JSON으로 출력. **전환 전** 1회 저장해 두고 전환 후 diff — api/설정 키 집합은 동일, 콘솔 에러 0, 미해결 lang 키 0이 합격.
   - **2클라이언트 소켓 체크리스트**(모듈별, GM 1 + 플레이어 1): LT 횃불 드롭/줍기·타인 액터 아이템 생성 거부, BF 비소유 토큰에 버프 적용 릴레이, TC 플레이어 Delay/턴 종료, VIT 비소유 멤버 치유 분배·리더 플래그 변경, VN 키워드 등록 요청/응답·무대 강제 토글.
3. **완료 정의(모듈당).** 콘솔 에러 0 · 스모크 diff 통과 · 해당 모듈의 메모리 "verified" 시나리오 재현 · 소켓 모듈은 2클라이언트 체크리스트 전부 통과 · 커밋 2개 이상으로 분리(라이브러리 전환 / 동작 변경·버그 수정).

### 7.1 단계

각 단계는 "라이브러리 추가 → 모듈 전환 → 스크래치 월드 검증 → 버전 범프 → 커밋" 순서. 검증 환경은 `foundry-local-test-setup` 메모리(스크래치 Foundry v13 서버 + junction)를 따른다. 세션 수는 추정.

| 단계 | 내용 | 산출물 | 검증 | 세션 |
|---|---|---|---|---:|
| **0a. gatos-lib 골격** | `gatos-lib` 생성: `module.json`(library:true), `core/{module,settings,compat,socket,hooks,wrap}`, `users`, `actors`, `chat`, `ui/*`, `data/*`, `util/*`, `pure/*`, lang/css, `test/`. README에 API 표. **어떤 모듈도 건드리지 않음.** | gatos-lib 1.0.0-alpha | `node --test`(pure/util + "pf1" 문자열 0건); 스크래치 월드 콘솔에서 `import("/modules/gatos-lib/scripts/index.js")` 로 수동 호출; 소켓은 GM+플레이어 2클라이언트 | 2 |
| **0b. gatos-pf1-lib 골격** | `gatos-pf1-lib` 생성: `module.json`(library:true, requires gatos-lib, systems pf1), `health`, `conditions`, `buffs`, `items`, `actor`, `rolls`, `rest`, `spells`, `compendium`, `senses`, `sheets`, `i18n`, `test/`. README에 pf1 내부 API 의존 목록. 0a 완료 후, 또는 0a의 `index.js` 표면이 고정된 뒤 병렬 | gatos-pf1-lib 1.0.0-alpha | PF1 스크래치 월드에서 getHealth/W&V/조건/버프 생성·활성 수동 호출; dnd5e 월드에서 활성화가 막히는지 확인 | 1~2 |
| **1. 파일럿(소형)** | hero-points(두 라이브러리 최소 사용) → light → buff-finder → **turn-control(gatos-lib만 — 시스템 무관 라이브러리 단독으로 충분한지 확인하는 대조군)** 순. 보일러플레이트·설정·소켓·주입·다이얼로그 전환. light 소켓 권한 검사는 **별도 커밋**. **파일럿 종료 시 계속 여부 결정**(절감 실측, 회귀 수, 소요 세션, 두 라이브러리 경계가 실제로 지켜졌는지) | 각 모듈 minor 범프, `requires` 선언 | 스모크 diff + 모듈별 기존 검증 시나리오(메모리 "verified"): 영웅점 사용 카드, 횃불 장착/드롭/줍기(플레이어 포함), 버프 적용 릴레이, Delay/자동 턴 종료. turn-control은 dnd5e 월드에서도 1회 | 4~5 |
| **2. 중형 PF1** | party-panel → monster-maker → item-crafting → vitalist. `gatos-pf1-lib` 본격 사용, `PerDocumentMixin`, `pickList`, 액터 요약. vitalist의 party-panel id 버그 수정(별도 커밋) | | 파티 패널 타겟팅(v13 setTargets), 몹 생성 HP 정확성, 휴식 크래프팅 다이얼로그, Steal Health 분배 + 컬렉티브 패널 파티 후보 표시, 헤더 버튼 **순서**(여러 모듈 unshift) 전후 비교 | 4~5 |
| **3. 채팅 계열** | chat-tools(보일러플레이트·다이얼로그·플래그 스토어·레지스트리만) → visual-novel(compat 승격·소켓 request·주입). **API/훅/DOM 표면 불변 확인용 체크리스트** 먼저 작성 | | VN이 chat-tools 0.2.0+ 표면을 그대로 쓰는지: 포트레잇 공급자, 발화자 바 strip, 아카이브 vn 필드, 내보내기 refs/player, 뷰어 액션. 입력창 위 바 순서(speaker→whisper→tray→strip). CT 내부 훅 순서(whisper→chitchat, images→chitchat) | 3~4 |
| **4. 잔여** | header-menu(wrapMethod), coc7-free-occupation(patchPrototypeOnce), coc7-ko(compat), spirit-totem(선택) | | 헤더 ⋮ 메뉴 with/without lib-wrapper(lib 헬퍼로 추가한 V1 버튼의 `cls`가 keep 목록에서 동작), 탐사자 마법사 자유 직업, 매뉴얼 리다이렉트 | 1~2 |
| **5. 정리** | 각 모듈 README에 의존 명시, 라이브러리 1.0.0 확정, 메모리 갱신(`gatos-lib` 항목) | | 전 모듈 동시 활성 상태로 PF1 월드 1회, 시스템 무관 월드(dnd5e 또는 빈 시스템) 1회 | 1~2 |

단계 간 의존: 0a → 0b → 1 → **결정** → (2, 3 병렬 가능: 파일이 겹치지 않고, 2는 `gatos-pf1-lib`·3은 `gatos-lib`를 주로 건드림) → 4 → 5. 병렬 시 **라이브러리당 한 세션** 규칙(§5.5): 2단계 세션이 `gatos-lib`를 바꿔야 하면 3단계 세션에 요청한다. 총 15~21세션(두 라이브러리 오버헤드 +1).

---

## 8. 리스크와 대응

| 리스크 | 영향 | 대응 |
|---|---|---|
| 라이브러리 미설치(활성화 차단됨) / 설치됐지만 비활성(반쪽 상태) | 미설치는 Foundry UI가 막음; 비활성은 lang·css·api 누락 | §5.6: 정적 import + `relationships.requires` + init에서 `active` 검사 + 선택적 `guard.js`; 다이얼로그 기본 라벨은 코어 키 |
| 테스트 없는 기계적 치환(VIT i18n 150회, CT 설정 28개 테이블화)에 의한 **조용한 회귀**(라벨 원문 노출, 설정 기본값 변경) | 사용자가 한참 뒤 발견 | §7.0 스모크 매크로 diff(미해결 lang 키 0, 설정 키·기본값 집합 동일)를 모듈별 완료 조건으로 |
| 저장소 부재로 롤백 불가 | 전환 중 깨지면 복구 비용 | §7.0 `git init` + `pre-lib` 태그 선행 |
| gatos-header-menu와 헤더 버튼 헬퍼 상호작용 | V1 버튼 class가 바뀌면 사용자의 keep 목록·known 목록이 흔들림 | `addActorSheetHeaderButton`의 `cls` 필수·기존 class 그대로 유지(§5.3) |
| 여러 모듈이 같은 헬퍼로 `unshift`하면 마지막 로드 모듈 버튼이 맨 앞 | 전환 후 "순서가 바뀌었다" 보고 | 기존도 동일 동작(CRF/VIT/VN 모두 unshift). `position` 옵션으로 기존 위치 재현, 2단계 검증 항목 |
| 두 라이브러리 경계 침식 — 편의상 `gatos-lib`에 PF1 경로를 넣거나, `gatos-pf1-lib`에 범용 유틸을 넣음 | 분리 이득(영향 범위 8개, pf1 무관 테스트) 소멸 | `gatos-lib/test`에 `grep "pf1"` 0건 테스트; `gatos-pf1-lib` README의 "코어 API만 쓰는 함수는 gatos-lib로 올린다" 규칙; 리뷰 체크리스트 항목 |
| PF1 모듈이 두 `requires`를 선언해야 하고, `gatos-pf1-lib`만 비활성이면 반쪽 상태 | lang 키·api 누락은 `gatos-lib`와 동일 패턴 | init 검사에서 두 라이브러리 모두 `active` 확인; `gatos-pf1-lib`는 lang/css를 갖지 않도록 설계(PF1 코어 키 재사용)해서 반쪽 상태의 증상을 줄임 |
| 소켓 통일로 LT 동작 변경(권한 거부) | 플레이어 횃불 줍기/드롭 실패 가능 | 전환 전 실제 사용 경로 확인, 권한 검사 커밋 분리, 2클라이언트 테스트 |
| libWrapper는 등록자 id가 실제 패키지여야 함 | 라이브러리 id로 등록하면 거부/경고 | `wrapMethod(mod, …)`가 `mod.id`로 등록 |
| CT↔VN 호환 표면 훼손 | VN 기능 침묵 실패 | 표면 목록(§6 CT 행)을 체크리스트로 고정, api 이름·동작 변경 금지, `registerPortraitProvider` 등은 레지스트리를 **감싼 동일 함수**로 유지 |
| 훅 등록 순서 변경 | CT 내부 기능 간 상호작용 깨짐(whisper→chitchat, images→chitchat 등) | `onChatUiRender`/`onAll`은 호출 지점 순서를 보존; module.js 주석의 순서 제약을 테스트 항목으로 |
| 설정 lang 키 규약 불일치(PP/BF `Key`/`KeyHint`) | 설정 라벨 미표시 | 테이블에 `nameKey/hintKey` 명시 옵션; 또는 lang 키 리네임(동작 영향 없음) |
| PF1 내부 API 변동(`healthConfig`, `setActive`, `getRawEffectData`, `_syncSenses`, `toConsumable`) | `gatos-pf1-lib`가 깨지면 PF1 모듈 8개 동시 영향(시스템 무관 6개는 무관 — 분리의 이득) | `gatos-pf1-lib`는 **얇게**(경로·폴백만), 모듈이 이미 가진 폴백을 그대로 흡수, pf1 버전 민감 지점을 README 목록으로 유지(§5.5) |
| VN 순수 파일 중복 유지 | 유틸 수정 시 두 곳 | §5.7 (b) 채택, `pure/`와 수동 동기화 목록 유지 |
| Tier 2를 성급히 옮김 | 줄 수 불변, 간접 참조 증가, 라이브러리 비대화 | "두 번째 소비자" 규칙을 README에 명문화 |
| 하나의 라이브러리 버그가 14개 모듈에 전파 | 전 모듈 동시 장애 | 라이브러리 변경은 스크래치 월드에서 전 모듈 활성 상태로 검증 후 배포 |

---

## 9. 분석 중 발견한 버그 / 불일치 (라이브러리와 별개로 수정 후보)

| # | 모듈 | 위치 | 내용 | 심각도 |
|---|---|---|---|---|
| 1 | gatos-pf1-vitalist | `module.json:16`, `README.md:15`, `scripts/collective-panel.js:207` | 존재하지 않는 모듈 id **`pf1-party-panel`** 참조. 실제 id는 `gatos-pf1-party-panel`(api `getPartyActors` 존재 확인). 결과: 컬렉티브 "멤버 추가" 후보에 파티가 항상 비어 있음 | 기능 결함 |
| 2 | gatos-pf1-light | `scripts/socket.js:17-29` | `createItems`/`updateItems` 소켓 핸들러에 **발신자 식별·권한 검사 없음**. 어떤 플레이어든 어떤 액터에 아이템 생성/수정 요청 가능(GM 클라이언트가 실행) | 보안(신뢰 테이블이면 낮음) |
| 3 | gatos-turn-control | `scripts/socket.js:16` | `game.users.get(msg.userId)` null 미검사(핸들러 `canControl`의 `!!user` 가드로 실질 안전) | 낮음 |
| 4 | gatos-turn-control | `scripts/systems/generic.js:22` | `MODULE_ID` 리터럴 재선언(constants 미사용) | 정리 |
| 5 | gatos-pf1-light | `scripts/module.js:2, :10` | `settings.js` 2회 import | 정리 |
| 6 | gatos-pf1-vitalist | `scripts/collective-panel.js:412` | 이미 정적 import 중인 `collective.js`를 `await import()`로 재로딩(불필요) | 정리 |
| 7 | gatos-pf1-hero-points | `sheet.js:3`, `hero-points.js:5` | 같은 모듈 안에 `i18n` 2회 정의 | 정리 |
| 8 | gatos-pf1-party-panel | `party-panel.js:433` | 저널 페이지 열기 v12 시그니처만 사용(v13 deprecated 경로; 동작은 함) | 낮음 |
| 9 | gatos-pf1-vitalist | `module.js` `getActorSheetHeaderButtons`(OBSERVER 허용) vs `getHeaderControlsActorSheetV2`(권한 검사 없음) | V1/V2 헤더 버튼 조건이 다름 | 낮음 |
| 10 | gatos-pf1-monster-maker | `dialog.js:251-274` | `featIndex` 캐시에 무효화 없음(팩 변경 시 stale) | 낮음 |
| 11 | TC/BF/VN | `socket.js` | 페이로드에 `userId`를 넣어 발신자를 식별하지만 서버가 2번째 인자로 `senderId`를 이미 넘겨 준다(§3.2). 페이로드 userId는 위조 가능하므로 보안상도 `senderId`가 맞다 | 정리(라이브러리 전환 시 자연 해소) |

**1·2는 2026-10-25 수정 완료**(라이브러리와 별개): vitalist 0.1.1(`module.json`·README·`collective-panel.js:207` id 교정 — 스크래치 월드에서 컬렉티브 패널 후보에 `party` 그룹 표시 확인), light 0.1.1(`socket.js` 재작성 — 서버가 넘기는 `senderId`로 발신자 식별, createItems/updateItems는 모듈 light 버프 + 시전자 소유 검사 + 갱신 필드 화이트리스트, createToken은 토큰 필드 화이트리스트 + 떨어뜨린 액터 소유, deleteToken은 `pickerTokenId` 추가(drop.js) + 소유·인접 검사; GM+플레이어 2클라이언트에서 정상 4건 통과·위조 7건 거부 확인). 라이브러리 `createSocket`은 이 light 소켓의 검사 패턴을 기본 예제로 삼는다. (검토 과정에서 "VIT가 `senderId`를 전제하는데 서버가 안 넘겨 준다"는 의심이 제기되어 서버 코드로 확인했고, **넘겨 준다** — VIT 구현은 올바르다.)

---

## 10. 비목표 및 사용자 결정이 필요한 항목

**비목표**
- 모듈 통합(여러 모듈을 하나로 합치기), lang/CSS 접두 체계 변경, PF1 규칙 데이터 이동, VN 순수 파일 재구성, v12 재검증, Tier 2 이동.

**결정 필요**
1. **범위**: Tier 1 전부(≈1,300줄 절감, 14개 모듈 전환) vs 파일럿 4개만 하고 평가 후 결정. → 권고: 0단계 + 1단계 후 평가.
2. **의존 방식**: 정적 ESM import(§5.1 권고) vs `game.modules.get("gatos-lib").api`만 사용. `library: true` 덕에 api 방식도 훅 안에서는 안전하지만(§5.5), 소비 모듈 최상위에서 못 쓰고 `?.` 체인이 늘어 비권고.
3. **32줄 모듈(spirit-totem)·CoC7 모듈 2개**에 라이브러리 의존을 붙일지. → 권고: 붙이지 않음(이득 8줄, 의존 비용 더 큼). free-occupation의 `patchPrototypeOnce`만 예외 고려.
4. **`globalThis` 별칭**(`gatosBuffFinder`, `pf1PartyPanel`, `pf1Vitalist`) 유지 여부. 매크로에서 쓰고 있다면 유지.
5. **설정 lang 키 규약 통일**(PP/BF를 `Key.Name/Key.Hint`로 리네임) 여부.
6. **라이브러리 폴더/이름**: `gatos-lib` / "Gato's Library" + `gatos-pf1-lib` / "Gato's PF1 Library"(기존 `gatos-pf1-<name>` 관례와 일치). 대안 `gatos-core` + `gatos-pf1-core`, 또는 `gatos-lib-pf1`.
9. **turn-control의 PF1 어댑터**를 1차 범위에서 자기 코드로 유지(권고)할지, `gatos-pf1-lib` 소프트 의존(`requireModule`)으로 바꿀지.
7. **LT 소켓 권한 강화**를 라이브러리 전환과 함께 할지, 먼저 독립 수정할지.
8. **`modules/` git 저장소 생성**(§7.0) 승인 — 기존에 없던 `.git` 폴더가 `Data/modules`에 생긴다. 대안: 모듈별 저장소, 또는 `Data/` 상위에서 `modules/gatos-*`만 추적.

---

## 11. 검토 이력

- 2026-10-25 (2차) 사용자 요청으로 **단일 라이브러리 + `pf1/` 하위 폴더 → `gatos-lib` + `gatos-pf1-lib` 두 라이브러리**로 구조 변경. §5.0 비교표·의존 그래프·배치 규칙 신설, §5.2 두 트리, §5.5 라이브러리별 버전·"라이브러리당 한 세션", §6 의존 선언 표, §7 0a/0b 분리·turn-control을 gatos-lib 단독 대조군으로, §8 경계 침식·이중 의존 리스크, §10 이름·turn-control 어댑터 결정 추가. 줄 수 추정은 변동 없음(+오버헤드 ~50줄). 분리의 실질 이득은 pf1 내부 API 변동 영향 범위 14→8, `gatos-lib`의 pf1 무관성 기계 검사, 장래 `gatos-coc7-lib` 패턴.

- 2026-10-25 초안 작성 후 독립 리뷰 1회. 반영: §5.6 2단 `import()` 부트스트랩 폐기(모듈 최상위에서 `game` 미정의, 완료 순서 미보장) → 정적 import + `requires` + init 검사 + 선택적 guard; "비활성 lib = 반쪽 상태" 추가; `choices` 배열 → 객체 변환 명시(배열 그대로는 value가 "0","1"); `library:true` 로드 순서 사실 추가; 단일 설치본 원자성 규칙; 저장소·테스트·완료 정의·세션 추정 추가; §4.2/§6 절감치에서 호출 치환 제외(≈1,200~1,500); 헤더 버튼 `cls` 필수·`position` 옵션; `isResponsibleClient({fallbackGM})`; 다이얼로그 기본 라벨 코어 키; CT viewer getter 의미 차이; §9 #11 교체. 기각: "VIT senderId 전제 오류" 지적 — 서버 `handleCustomSocket`이 `broadcast.emit(event, data, this.user.id)`로 발신자 id를 넘기는 것을 확인.

---

## 부록 A. 모듈별 상세 참조 (file:line)

분석 보고의 핵심 참조만 발췌. 전체 카탈로그는 §3.

**gatos-chat-tools** — `constants.js:18`(L), `settings.js:8-247`(설정 25개), `:249`(setting), `viewer.js:35-742`(AppV2 싱글톤 `static get instance` :79), DialogV2 `edit.js:139` `export-dialog.js:54` `session.js:103,128` `viewer.js:524,578,593,652,818,853,869` `whisper.js:239`, 채팅 컨트롤 주입 `viewer.js:883-893` `images.js:358-379` `whisper.js:297-315`, 레지스트리 `portrait.js:29-52` `viewer-actions.js:7-37`, 유저 플래그 `bookmarks.js:8-31` `whisper.js:21-34` `speaker-bar.js:16-33`, Data 폴더 `images.js:113-148` `archive.js:115-136`, 날짜 `constants.js:21-61`, VN 소비 표면 `module.js:46-121`(api), 커스텀 훅 16종(§3.11).

**gatos-visual-novel** — `compat.js:1-36`(라이브러리 시드), `constants.js:15-29`(L, chatTools 게이트), `settings.js:8-9`(reg/name), `:102-121`(overrides), `socket.js:42,73-88`(request/response), `expression-config.js:18-49,268-271`(per-doc 레지스트리), `:287-318`(헤더 V1/V2 + 컨텍스트), `keyword-manager.js:12-15,58-91`, `stage.js:24-27,33-52,357-376`, 순수 파일 `stage-state.js` `stage-dom.js` `player-core.js` `player-editor.js`(인라인 제약 `archive-ext.js:202-211`).

**gatos-pf1-vitalist** — `socket.js:8-56,64-106`, `collective.js:7-8,28-66,73-119,144-154,218-229,279-292,337-347,353-389,392-417,420-449`, `collective-panel.js:42-49,56-148,204-221,228-243,276-321,395-414,437-471,504-592,605`, `distribute-dialog.js:12-243`(Tier 2), `spirit-of-many.js:26-37,53-100,132-186`, `steal-health.js:37-56,155-158,179-189`, `steal-life.js:70-79,138-141`, `collective-healing.js:13-66`, `module.js:37-84,98-123,158-183,189-235,241-302,355-384`.

**gatos-pf1-item-crafting** — `module.js:19-25,32,43-46,66-89`, `crafter.js:9-12,18-48,56-58,126-162,166-211,219-268,279-285,572-636,691-754`, `dialog.js:13-57,191-231,297-301,361-364`, `import-dialog.js:40-50,102-122,178-182`, `rules.js:91,146-184`, `statblock.js:47-75,234-247`.

**gatos-turn-control** — `socket.js:1-35`, `settings.js:7-23,166-215`, `systems/index.js:1-11`(어댑터), `systems/generic.js:22,40-41,52-60`, `systems/pf1.js:24-32,52-57,68-75,89-92`, `tracker.js:5,7-30,37,42-45,120-143`, `chat.js:5-34,130-139`, `visibility.js:41-66,81-82`, `delay.js:7-16,92,99`, `combat.js:117,193-194,237`.

**gatos-pf1-buff-finder** — `socket.js:1-41`, `module.js:13-41,43-53,55-78,89-109,114-136,141-165`, `buff-finder.js:13-31,33-120,127-140,161-170,314-409,498-503,540-571,580-594,608-619`, `catalog.js:19-69,126-142,181-228`, `apply.js:10-17,37-99,138-201`.

**gatos-pf1-light** — `socket.js:1-80`, `settings.js:4-54`, `sources.js:14,26-42,75-82,114-138,149-171,175-202`, `drop.js:18-62,131-158`, `use.js:13-27,30-68,80-84`, `sheet.js:9-21,111-122`, `vision.js:27-46,59-101,163-172`, `compat.js:16-27`, `module.js:2,10,56,70-76,84-85,96-103`.

**gatos-pf1-party-panel** — `module.js:10-62,64-74,76-88,98-118,149-178`, `party-panel.js:11-37,44-67,70,121-151,161-185,222-329,337-359,470-479,490-519,527-529,602-647,657-701,714-763,775-778`, `party-manager.js:187-258`.

**gatos-pf1-monster-maker** — `module.js:5-44`, `dialog.js:9-11,14-23,25-128,169-181,241-246,251-317`, `builder.js:115-135,202-226,291-299`(순수).

**gatos-header-menu** — `module.js:20,26-37,61,74-109,115-187,193-234,241-295,301-336,343-371`.

**gatos-pf1-hero-points** — `constants.js`, `settings.js:3-48`, `sheet.js:3,6-39`, `hero-points.js:5-27,30-71,73-139,160-169`.

**gatos-coc7-ko** — `scripts/module.js:6-23,38-39`, `src/build.mjs:10-17,60-69,133-172,189-215`, `src/dump.mjs`, `src/extract.mjs:6-21`.

**gatos-coc7-free-occupation** — `module.js:2,8-13,26-59,91-95`. **gatos-pf1-spirit-totem** — `module.js:10-32`.
