# gatos-lib — Gato's Library

Foundry VTT v14 공용 라이브러리 모듈(1.1.0부터 v14 전용, v13은 1.0.x). `gatos-*` 모듈들이 복제해 쓰던 보일러플레이트(설정 등록, 소켓 릴레이, 버전 호환 심, 다이얼로그, 시트/HUD 주입, 플래그·파일 유틸)를 한 곳에 모은다. **시스템 무관**: `scripts/` 어디에도 특정 게임 시스템(PF1 등)의 전역·스키마 경로가 없고, 테스트가 이를 강제한다. 시스템 전용 헬퍼는 별도 라이브러리(`gatos-pf1-lib`, 미작성)로 간다. 설계 근거와 마이그레이션 맵은 [PLAN.md](PLAN.md).

상태: **1.0.0-alpha.1 — 골격(0a 단계)**. 아직 어떤 모듈도 이 라이브러리에 의존하지 않는다. Node 테스트와 스텁 import만 통과했고, 실제 Foundry 월드에서는 검증되지 않았다.

## 소비 모듈에서 쓰는 법

```js
// <module>/scripts/lib.js — 모듈 안에서는 이 shim만 import 한다
export * from "../../gatos-lib/scripts/index.js";
```

```js
// <module>/scripts/module.js
import { defineModule, createSocket, formDialog, addSceneControlTool } from "./lib.js";

const mod = defineModule("gatos-example", { langPrefix: "GEX" });   // settingsPrefix 기본 "GEX.Settings"

Hooks.once("init", () => {
  if (!game.modules.get("gatos-lib")?.active) return;                // 설치됐지만 비활성인 "반쪽 상태" 방지 (PLAN §5.6)
  mod.registerSettings({
    autoDetect: { type: Boolean, default: true },                    // name/hint = GEX.Settings.AutoDetect.Name/.Hint
    shape:      { scope: "client", type: String, default: "square", choices: ["square", "circle"] },
    state:      { hidden: true, type: Object, default: {} },         // config:false
  });
  mod.exposeApi({ open });
});
```

`module.json`에는 `"relationships": { "requires": [{ "id": "gatos-lib", "type": "module", "compatibility": { "minimum": "1.0.0" } }] }` 를 선언한다. 소켓을 쓰는 모듈은 자기 `module.json`에 `"socket": true` 가 있어야 `module.<id>` 채널이 열린다(서버 `registerCustomSocket` 확인).

`library: true` 덕에 이 모듈의 스크립트는 일반 모듈보다 먼저 로드되지만, 소비 모듈은 **정적 import** 로 쓰므로 로드 순서에 의존하지 않는다. `game.modules.get("gatos-lib").api` 는 매크로/콘솔용 별칭이다.

## 폴더

```
scripts/index.js        공개 표면 re-export, LIB_VERSION, libActive()
scripts/core/           module(defineModule) · settings · compat · socket · hooks · wrap
scripts/users.js        isActiveGM, isResponsibleClient, canControl, ownersOf …
scripts/actors.js       resolveActor, resolveTargetActors, tokensFor, setTargets, panToActor, byName
scripts/chat.js         postCard, postMarker, addChatControl, onChatUiRender, messageOf …
scripts/ui/             app(Singleton/PerDocument/PersistPosition 믹스인, readForm) · dialogs · inject · dom
scripts/data/           flags(userFlagStore …) · registry(providerRegistry, requireModule) · files · compendium(itemIndex)
scripts/util/           text · time · num  (Foundry 무의존)
scripts/pure/           dom(el, escapeHtml, plainText, stripTooltips) · fn(debounce, keyedDebounce) — Foundry 무의존, 내보낸 HTML에 인라인 가능
scripts/systems/        adapter.js — 시스템 어댑터 레지스트리(자리만, Tier 2)
lang/ko.json, en.json   GATOSLIB.* (코어에 없는 문구 8개)
styles/lib.css          .gatos-pick-row/.gatos-check-row/.gatos-pick-list/.gatos-pick-counter, .gatos-card, .gatos-dialog, .gatos-flash, .gatos-dim, .gatos-danger
test/*.test.mjs         node --test (아래)
```

## API 요약

PLAN §5.3이 명세이고, 구현 중 바뀐 점은 각 파일 머리 주석과 아래 "명세와 다른 점"에 있다.

| 영역 | 주요 export |
|---|---|
| 핸들 | `defineModule(id, {langPrefix, settingsPrefix})` → `mod.{id, L, Lraw, setting, setSetting, registerSettings, template, preloadTemplates, flag, flagKey, flagDeleteKey, isSelfUpdate, mark, exposeApi, log/warn/error, notify}` |
| 설정 | `registerSettings(mod, table, {keyStyle})`, `settingsTableToRegistrations(id, prefix, table)`(순수), `settingStore(mod, key)`, `onSettingChanged(mod, key, fn)`, `overridesStore(mod, {worldKeys, clientKey})` |
| 호환 | `generation()`, `impl.{TextEditor, FilePicker, DragDrop, FormDataExtended, ContextMenu, ImagePopout, ApplicationV1}()`, `renderTemplate`, `loadTemplates`, `htmlRoot(html)`, `HOOKS`, `renderJournalPage`, `bringToFront`, `mountPoint`, `isChatPopout` |
| 소켓 | `createSocket(mod, {noGMKey})` → `{registerHandler(action, fn(data, user), {anyClient}), init, runAsGM, request, broadcast, emitTo}`; `assertOwner(user, doc)`, `asOwnerOrRelay(socket, doc, localFn, action, data)` |
| 훅 | `onAll(hooks, fn)`, `watchTargets(fn, opts)`, `watchActorDocs(fn, opts)`, `keyedDebounce` |
| 래핑 | `wrapMethod(mod, path, fn, type, {register, unregister})`(libWrapper는 호출 파일의 패키지 id만 허용 — 모듈 자기 id로 등록하려면 자기 파일에서 정의한 콜백을 넘김; 없으면 `gatos-lib` id), `wrapPrototypeMethod(mod, proto, name, fn)`, `patchPrototypeOnce(mod, instance, name, fn)` |
| 유저/액터 | `isActiveGM`, `hasActiveGM`, `activeGM`, `isLeadGM`, `canControl`, `activeOwnerOf`, `isResponsibleClient(doc, {fallbackGM})`, `gmUsers`, `ownersOf`; `resolveActor`, `resolveActorSync`, `resolveTargetActors({mode, fallbackCharacter})`, `tokensFor`, `setTargets(ids, {mode})`, `toggleTargetActor`, `panToActor`, `byName` |
| 채팅 | `postCard(mod, {…})`, `postMarker`, `speakerFor`, `resolveWhisper`, `renderMessageContent`, `messageOf(li)`, `pushMessageContextOption`, `chatLogs`, `chatLogElements`, `rerenderVisibleMessages`, `jumpToMessage`, `addChatControl`, `onChatUiRender`, `metadataButton` |
| 앱/다이얼로그 | `SingletonMixin`, `PerDocumentMixin`, `PersistPositionMixin`, `gatosOptions`, `readForm`, `dialogRoot`; `formDialog`, `confirm`, `promptText`, `promptNumber`, `pickOne`, `pickList` (전부 `rejectClose:false`, 취소 → `null`) |
| 주입 | `addSceneControlTool`, `addActorSheetHeaderButton(mod, {cls 필수…; label·position은 문자열 또는 {v1, v2}})`, `addTokenHudButton`, `injectSheetSection`, `addDirectoryHeaderButton`, `makeControlButton`; `el`, `esc`, `debounce`, `trackModifierClass` |
| 데이터 | `getFlagOr`, `flagKey`, `flagDeleteKey`, `isSelfUpdate`, `watchUserFlag`, `userFlagStore`, `userListFlag`, `stashField`, `restoreField`; `providerRegistry`, `actionRegistry`, `requireModule(id, {minVersion, members})`; `ensureDataDir`, `uploadToData`, `uploadJson`, `download`, `safeFilename`, `fileNameOf`, `cacheBust`; `itemIndex({type, fields, …})`, `invalidateItemIndex`, `itemIndexKey` |
| 유틸 | `normalize`, `slug`, `norm`, `stripEnrichers`, `localizeMaybe`, `escapeRegExp`, `csvList`; `pad`, `fmtDate`, `fmtDateTime`, `fmtTime`, `startOfDay`, `endOfDay`, `parseDateInput`, `toLocalInput`, `stamp`; `num`, `numOrNull`, `bool`, `str`, `toArray`, `clamp`, `clampPct`, `signed`, `fmtNumber` |
| 시스템 | `registerSystemAdapter`, `getAdapter`, `hasAdapter` |

### 소켓 보안 규칙 (PLAN §5.4)

- 핸들러는 `game.user.isActiveGM` 클라이언트에서만 실행된다(`{anyClient:true}`로 등록한 것만 예외, 이때 `user.isGM` 검사는 핸들러 책임).
- 발신자는 서버가 붙여 주는 2번째 인자 `senderId`로만 식별한다. 페이로드의 userId는 신뢰하지 않는다. `game.users.get(senderId)`가 없으면 폐기.
- 문서를 쓰는 핸들러는 `assertOwner(user, doc)` 또는 모듈 자체 정책을 반드시 호출한다. 라이브러리는 강제하지 않는다.
- `request()`는 `{ok, data?, code?, error?}`로 응답하며 응답은 `recipients: [senderId]`로 요청자에게만 간다. 라이브러리 실패 코드: `noGM`, `timeout`, `unknownAction`, `error`.

### 명세(PLAN §5.3)와 다른 점

- `asOwnerOrRelay`는 첫 인자로 `socket`을 받는다(전역 상태를 두지 않기 위해).
- `onSettingChanged`는 `updateSetting` 외에 `createSetting`, `clientSettingChanged`도 듣는다(월드 설정의 첫 저장은 create, v13 클라이언트 설정은 clientSettingChanged만 발생).
- `registerSettings`에 `keyStyle: "raw"` 옵션(item-crafting·header-menu처럼 lang 키를 camelCase 그대로 쓰는 모듈용).
- `stashField/restoreField`는 문서를 직접 쓰지 않고 update 데이터를 반환한다(light 모듈이 일괄 update 하므로).
- `download(data, {type, name})` 객체 인자. `fileNameOf`는 디코드된 원문을 돌려주고 정리는 `safeFilename`이 맡는다.
- `postCard`에 `headerTag`, `messageData` 추가, icon/title 둘 다 없으면 header 생략. `{user}` 발화자는 코어가 `getSpeaker({user})`를 무시하므로 직접 `alias`/`author`를 만든다.
- `onChatUiRender`의 콜백은 `{hook, app, input, controls}` 한 객체를 받는다. 등록 순서가 실행 순서다.
- `addSceneControlTool`은 실행 중인 버전의 콜백(v13 `onChange`, v12 `onClick`) 하나만 설정한다 — 기존 BF/PP/VIT는 둘 다 설정해 두 번 호출되고 deprecation 경고가 난다(PLAN §9 후보).
- `persistPosition`은 `PersistPositionMixin` + `readSavedPosition/savePosition`으로 분리됐고 두 믹스인이 자동 적용한다. 기본 저장 필드는 `left/top`이고 `width/height`는 창이 `window.resizable`일 때만 저장한다(auto 높이 창이 한 번 최소화/복원 뒤 고정 크기로 굳는 것을 막기 위해). BF처럼 네 필드 모두 저장하려면 `fields`를 명시.
- 두 믹스인은 `_onFirstRender`에서도 인스턴스를 등록한다. `close()`와 `render()`가 같은 큐를 쓰므로 닫히는 애니메이션 중 다시 `open()`하면 `_onClose`가 레지스트리를 비운 뒤 같은 인스턴스가 다시 렌더되는데, 이때 등록이 빠지면 두 번째 창이 생긴다.
- `formDialog`의 `default`는 DialogV2처럼 autofocus만 바꾼다. 입력란에서 Enter는 DOM 순서상 첫 버튼(OK, `ok:false`면 첫 extra 버튼)을 실행한다.
- `addSceneControlTool`의 토글 상태(boolean `active`)는 클로저에 기억한다. 씬 컨트롤은 `render({reset:true})`마다 훅을 다시 돌리므로 그렇지 않으면 초기값으로 되돌아간다.
- `stripEnrichers`가 `[[1d4]]`에서 주사위 식을 지우던 원본(buff-finder catalog.js) 버그를 고쳤다(`[[/r …]]` 명령 접두만 제거).
- 추가 export: `activeOwnerOf`, `resolveActorSync`, `watchUserFlag`, `resolveWhisper`, `chatLogElements`, `itemIndexKey`, `cacheBust`, `gatosOptions`, `libActive`, `LIB_ID`.

### v14 이식 (1.1.0-alpha.1)

- 공개 API는 1.0.x와 호환. `flagDeleteKey`(`flags.<id>.-=<key>`)는 그대로 두되 v14에서 호환성 경고가 나므로(v16 제거) 새 코드는 `flagDeletion(id, key)` / `mod.flagDeletion(key)`(`{"flags.<id>.<key>": _del}`)를 쓴다.
- v14 update 훅의 `changes`에는 `-=` 키가 없고 삭제 경로에 `ForcedDeletion` 연산자가 들어온다. 삭제 여부는 `isFlagDeleted(changes, id, key)` / `mod.isFlagDeleted(changes, key)`로 검사한다(레거시 `-=` 키도 인식). `watchUserFlag` 등 내부 감지도 연산자를 인식한다.
- `pushMessageContextOption`은 v14 `ContextMenuEntry` 형태(`label`/`visible`/`onClick`)로 넣는다. 입력은 기존 `name`/`condition`/`callback` 그대로(새 이름도 별칭으로 받음).
- 다이얼로그 기본 버튼 라벨은 v14 코어 키 `COMMON.Confirm`/`COMMON.Cancel`/`COMMON.Yes`/`COMMON.No`(v13의 최상위 `Confirm` 등은 v14에서 삭제됨).
- `addChatControl`의 위치 기준 `#roll-privacy`는 v14 `#message-modes`로도 찾는다. v14의 `#chat-message`는 `<textarea>`가 아니라 `<prose-mirror>` 요소다(`onChatUiRender`의 `input`).

### "두 번째 소비자" 규칙 (Tier 2)

한 모듈만 쓰는 범용 코드(VIT DistributeDialog, BF SearchableList, HM popover, CT zip/archive 등)는 두 번째 소비자가 생길 때 옮긴다. 옮겨도 줄 수는 줄지 않고 간접 참조만 늘기 때문이다.

## 테스트

```bash
node --test test/
```

- `util.test.mjs`, `pure.test.mjs` — Foundry 무의존 함수들.
- `settings.test.mjs` — 설정 테이블 → register 인자 변환(choices 배열 변환, hidden, menu, 문자열 onChange).
- `boundary.test.mjs` — `scripts/`·`lang/`·`styles/`에 시스템 id 문자열 0건, module.json 경로 실존, ko/en 키 집합 일치, index.js가 모든 모듈을 중복 없이 re-export.
- `smoke-import.test.mjs` — Foundry 전역 없이 index.js import, 명세 표면 존재, 핸들 무순환, 스텁 Hooks에서 init 리스너 1개만 등록.

**아직 안 한 검증**(PLAN §7.1 0a): 스크래치 월드 콘솔에서 `import("/modules/gatos-lib/scripts/index.js")` 수동 호출, 소켓 GM+플레이어 2클라이언트, 다이얼로그/주입 헬퍼 실제 렌더.

## 버전 정책

디스크에 한 벌만 설치되므로 라이브러리 변경은 의존 모듈 전부에 동시에 퍼진다. 라이브러리를 바꾸는 세션은 영향받는 소비 모듈을 같은 세션에서 고치고 전부 검증한다(PLAN §5.5). v12 분기(씬 컨트롤 배열, `setTargets` 폴백)는 보존하되 v12 검증은 비목표. v14 대응은 `core/compat.js` 한 곳에서.
