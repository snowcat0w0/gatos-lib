# Gato's Library (gatos-lib)

이 모듈은 AI를 써서 만들었어요.

## 이게 뭐예요?

Foundry VTT에서 쓰는 모듈이에요. 그런데 이 모듈 혼자서는 아무 일도 안 해요.

Gato가 만든 다른 모듈들(이름이 `gatos-`로 시작하는 모듈들)이 이 모듈 안의 기능을 가져다 써요. 레고로 말하면, 다른 모듈들이 같이 쓰는 기본 블록 상자예요.

그래서 `gatos-chat-tools`나 `gatos-header-menu` 같은 모듈을 쓰고 싶으면 이 모듈도 꼭 같이 설치하고 켜야 해요.

이 폴더의 모듈은 Foundry VTT 14 버전용이에요(`foundry-v14` 브랜치). 13 버전을 쓰면 `master` 브랜치를 받아요.

## 설치하는 법

1. Foundry 첫 화면(설정 화면)에서 **애드온 모듈** 탭을 열고 **모듈 설치**를 눌러요.
2. 창 맨 아래 **매니페스트 URL** 칸에 아래 주소를 붙여 넣고 **설치**를 눌러요.

   ```
   https://raw.githubusercontent.com/snowcat0w0/gatos-lib/foundry-v14/module.json
   ```

3. 월드에 들어가서 **게임 설정 → 모듈 관리**에서 **Gato's Library**를 체크하고 저장해요.

주소로 설치가 안 되면 [Releases](https://github.com/snowcat0w0/gatos-lib/releases) 페이지에서 `gatos-lib.zip`을 받아 풀고, 그 폴더를 `Data/modules/gatos-lib`에 넣어도 돼요.

## 어떻게 써요?

따로 할 일은 없어요. 켜 두기만 하면 되고 설정 메뉴에도 아무것도 안 나와요.

다른 gatos 모듈이 "gatos-lib가 꺼져 있어요"라고 경고를 띄우면, 모듈 관리에서 이 모듈을 켜 주세요.

## 모듈을 만드는 사람에게

이 부분은 코드를 쓰는 사람만 보면 돼요.

자기 모듈 안에 `scripts/lib.js` 파일을 하나 만들고 이 한 줄만 넣어요. 모듈 안에서는 이 파일만 import 해요.

```js
export * from "../../gatos-lib/scripts/index.js";
```

그리고 `module.json`에 이 모듈이 필요하다고 적어요.

```json
"relationships": {
  "requires": [{
    "id": "gatos-lib", "type": "module",
    "manifest": "https://raw.githubusercontent.com/snowcat0w0/gatos-lib/foundry-v14/module.json",
    "compatibility": { "minimum": "1.1.0" }
  }]
}
```

쓸 수 있는 함수 목록은 `scripts/index.js`에 다 모여 있어요. 각 파일 맨 위 주석에 그 파일이 하는 일이 적혀 있어요. 특정 게임 시스템(PF1 등) 전용 코드는 이 모듈에 넣지 않아요. 테스트가 그걸 검사해요.

테스트는 Node.js로 돌려요.

```bash
node --test test/
```
