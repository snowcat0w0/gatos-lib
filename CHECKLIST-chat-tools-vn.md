# gatos-chat-tools ↔ gatos-visual-novel 호환 표면 체크리스트 (3단계 전환용, 2026-10-26)

PLAN §7.1 3단계가 요구하는 "API/훅/DOM 표면 불변 확인용 체크리스트". `gatos-visual-novel/scripts`를 grep해 chat-tools를
참조하는 모든 지점을 모았다. chat-tools 0.5.2 → 0.6.0 전환 뒤 각 항목을 정적(스모크 diff·grep)과 월드(VN 활성)에서 확인한다.

## 1. 버전 게이트

| VN 코드 | 조건 | 전환 후 확인 |
|---|---|---|
| `constants.js chatTools()` | `game.modules.get("gatos-chat-tools").active && api.registerPortraitProvider` 존재 | api에 `registerPortraitProvider` 유지 |
| `constants.js chatToolsHooksAvailable()` | `module.version >= 0.2.0` | 0.6.0 ✔ (버전은 올리기만) |

## 2. VN이 호출하는 api 멤버 (10)

| 멤버 | 호출 위치 | 시그니처/반환이 지켜야 할 것 |
|---|---|---|
| `registerPortraitProvider(fn)` | module.js ready | `fn(message) → path \| {img,label} \| null`; 등록 순서대로 질의, 첫 이미지 승 |
| `updateSpeakerBar()` | module.js ready, expression-picker.js | 인수 없음; 모든 `.gct-speaker-bar`에 `gctSpeakerBarResolve(info)` → DOM 갱신 → `gctSpeakerBarUpdated(bar, info)` |
| `refreshPortraits()` | module.js ready | 채팅 로그의 모든 메시지 초상 재적용 |
| `registerViewerAction({id,label,tooltip,icon,callback(messages, meta)})` | module.js ready | `meta = {title, source, selection}`; `messages`는 `serializeMessage` 객체(렌더된 `html` 포함) |
| `renderMessageContent(message)` | entries.js dialogueHtml | `Promise<string>` `.message-content` innerHTML |
| `absoluteUrl(path)` | archive-ext.js onExportLog | data 경로 → 절대 URL |
| `lookupPortrait(speaker)` | expressions.js speakerDocs | `{token: string\|null, actor: string\|null, actorDoc: Actor\|null}` |
| `serializeMessage(message)` | log-player.js serializeLive | 아래 §4 스키마 |
| `getIndex()` | log-player.js ×2 | `[{id, name, path, createdAt, createdBy, from, to, count, session?, auto?, merged?, imported?}]` createdAt 오름차순 |
| `loadArchive(entry)` | log-player.js | `Promise<archive>`; `archive.messages[]`, `archive.name` |

## 3. 훅

VN이 듣는 chat-tools 훅(이름·인수·호출 시점 불변):

| 훅 | 인수 | 발화 지점 |
|---|---|---|
| `gctSerializeMessage` | `(message, data)` — data는 변경 가능 | archive.js serializeMessage 끝 |
| `gctArchiveHeader` | `(archive)` | archive.js saveArchive / mergeArchives |
| `gctExportRender` | `(doc: Document, ctx)` | export.js applyExportRender (single/window/zip/dir) |
| `gctExportLog` | `(log, ctx)` — `ctx.relink(url, folder)`, `ctx.bundle` | export.js buildBundle |
| `gctExportBundle` | `(bundle, ctx)` — `bundle.files: Map<path, url\|Blob\|{text}>`, `bundle.name`, `bundle.logName` | export.js buildBundle 끝 |
| `gctSpeakerBarMounted` | `(bar)` | speaker-bar.js mountSpeakerBar (VN도 ready에서 직접 callAll) |
| `gctSpeakerBarResolve` | `(info)` — `info.img` 교체 가능 | speaker-bar.js updateSpeakerBar |
| `gctSpeakerBarUpdated` | `(bar, info)` | speaker-bar.js updateSpeakerBar |
| `gctSpeakerResolved` | `(message, data, options, userId)` | speaker-bar.js onPreCreateChatMessage (잠금 적용 뒤) |

chat-tools가 발화하지만 VN이 안 듣는 훅(다른 소비자 대비 유지): `gctArchiveSaved(entry)`, `gctMessagesDeleted({from,to,count})`,
`gctBookmarksChanged(ids, on)`, `gctSessionStarted(s)`, `gctSessionEnded(s, entry)`, `gctViewerActionsChanged()`.

훅 등록 순서(module.js 주석, 깨지면 안 됨):
- `chatMessage`: whisper → chitchat (whisper가 `chatData.whisper`를 먼저 채움); images의 chatMessage는 그보다 앞(`registerImageHooks()` 먼저 호출)
- `preCreateChatMessage`: images → whisperGM → speaker lock(→ `gctSpeakerResolved`) → portrait freeze → ruby
- `renderChatMessageHTML`: images(클릭) → whisper 라벨 → token-hud 답장 → chitchat → portrait → edit 버튼 → bookmark → marker → regroup
- 입력창 위 바: 등록 순서가 DOM 순서를 정한다 — whisper(`registerWhisperHooks`) → token-hud → … → speaker-bar(`registerSpeakerBarHooks`, 맨 끝). images tray는 speaker bar 앞에 anchor.

## 4. `serializeMessage` 스키마 (archive v2)

`id, timestamp, user, userId, color, alias, img, imgLabel, actor, token, flavor, content, whisper[], whisperNames[], blind,
chitchat, highlight, sessionMarker, isRoll, rolls[{formula,total}], type, style, html` + 훅이 더한 `vn`(VN). 번들 `log.json`:
`{module, version: 2, kind: "export-log", title, source, world, worldTitle, system, exportedAt, from, to, count, messages[]}` + VN의 `log.vn`.

## 5. DOM / 식별자

| 표면 | VN 사용처 | 유지 |
|---|---|---|
| `.gct-speaker-bar` (div, textarea 바로 위) | module.js ready: `bar.nextElementSibling.classList.contains("gvn-expr-strip")` | 클래스·위치 |
| `#gct-archive-viewer` (AppV2 id) | module.js viewer action: `foundry.applications.instances.get("gct-archive-viewer")?.minimize()` | `DEFAULT_OPTIONS.id` 그대로 — SingletonMixin 전환 시 id 유지 |
| `flags["gatos-chat-tools"].chitchat` | entries.js, expressions.js | 플래그 경로 |
| `renderChatInput`/`renderChatLog`에 VN 토글 버튼(stage.js) | `#chat-controls` | chat-tools 버튼 주입이 `addChatControl`로 바뀌어도 VN 버튼 순서 영향 없음(각자 append) |

## 6. 전환 후 검증 절차

1. 정적: `smoke-static` before/after diff — 설정 32·키바인딩 2·api 67·훅 27 동일, lang 미해결 0.
2. grep: 위 api 10개가 `module.js` api 객체에 남아 있고, 훅 이름 15개가 `Hooks.callAll` 호출에 그대로 있는지.
3. 월드(VN 활성): ready 뒤 콘솔 에러 0 · `.gct-speaker-bar` 다음 형제가 `.gvn-expr-strip` · 뷰어 열기 → VN "노벨로 재생" 버튼 존재 ·
   메시지 전송 → `gctSpeakerResolved`로 VN 표정 플래그 동결 · 아카이브 저장 → `gctSerializeMessage`로 `vn` 필드 · 내보내기(zip) → `gctExportLog/Bundle` 호출.
