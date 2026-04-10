# Chrome Extension MV3 — Side Panel + Content Script 통신 조사 자료

## 1. 아키텍처 개요

```
[Side Panel] ←→ [Service Worker (Background)] ←→ [Content Script]
     ↑                    ↑                           ↑
  확장 UI           메시지 중계/관리              페이지 DOM 조작
```

Side Panel은 탭이 아니므로 `chrome.tabs.sendMessage()`로 직접 통신 불가.
반드시 **Service Worker를 중계자**로 사용해야 함.

---

## 2. 메시지 패싱 패턴

### 2-1. 단방향 (One-time Message)

**Side Panel → Service Worker:**
```javascript
// side_panel.js
chrome.runtime.sendMessage({ type: 'MANUAL_RUN', payloads: [...] }, (response) => {
  console.log('SW 응답:', response);
});
```

**Service Worker → Content Script:**
```javascript
// service_worker.js
chrome.tabs.sendMessage(tabId, { type: 'START_BATCH', payloads: [...] }, (response) => {
  console.log('CS 응답:', response);
});
```

**Content Script → Service Worker:**
```javascript
// content_script.js
chrome.runtime.sendMessage({ type: 'BATCH_PROGRESS', completedCount: 3 });
```

### 2-2. Port 기반 양방향 (Long-lived Connection) — 권장

**Side Panel에서 Port 생성:**
```javascript
// side_panel.js
const port = chrome.runtime.connect({ name: 'sidepanel' });
port.postMessage({ type: 'init' });
port.onMessage.addListener((msg) => {
  if (msg.type === 'progress') updateUI(msg.data);
});
```

**Service Worker에서 Port 수신:**
```javascript
// service_worker.js
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'sidepanel') {
    port.onMessage.addListener(async (msg) => {
      if (msg.type === 'init') {
        // Content Script 주입
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content_script.js'],
        });
        port.postMessage({ type: 'ready' });
      }
    });
  }
});
```

---

## 3. Content Script 주입 방식

### 3-1. manifest.json 선언 (정적 주입)
```json
"content_scripts": [
  {
    "matches": ["https://labs.google/fx/*/tools/flow", "https://labs.google/fx/*/tools/flow/*"],
    "js": ["content_script.js"],
    "run_at": "document_idle"
  }
]
```
- 페이지 로드 시 자동 주입
- 확장 리로드 후에는 기존 탭에서 동작 안 함 (탭 새로고침 필요)

### 3-2. chrome.scripting.executeScript (동적 주입) — 핵심
```javascript
// service_worker.js
await chrome.scripting.executeScript({
  target: { tabId: tabId },
  files: ['content_script.js'],
});
```
- PING 실패 시 fallback으로 사용
- 확장 리로드 후에도 탭 새로고침 없이 동작 가능
- `scripting` 권한 필요

---

## 4. Service Worker 주의사항

### 4-1. 30초 비활성 후 종료
MV3 Service Worker는 30초 비활성 시 sleep.
```javascript
// 변수에 상태 저장하면 사라짐!
let myState = {}; // ❌ 위험

// chrome.storage.local 사용
chrome.storage.local.set({ myState: {} }); // ✅ 안전
chrome.storage.local.get('myState', (result) => { ... });
```

### 4-2. return true 필수 (비동기 응답)
```javascript
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'MANUAL_RUN') {
    handleManualRun(msg, sendResponse);
    return true; // ← 비동기 응답 시 필수!
  }
});
```

---

## 5. Slate.js (contenteditable) 입력 방식

### ❌ beforeinput 이벤트 (Isolated World에서 불안정)
```javascript
el.dispatchEvent(new InputEvent('beforeinput', {
  bubbles: true, inputType: 'insertText', data: text,
}));
```

### ✅ document.execCommand (Isolated World에서 안정적)
```javascript
editor.click();
editor.focus();
document.execCommand('selectAll', false, null);
document.execCommand('delete', false, null);
document.execCommand('insertText', false, text);
```
- `execCommand`는 브라우저가 네이티브 `beforeinput` 이벤트를 발생시키므로 Slate React 상태가 정상 업데이트됨

---

## 6. Match Pattern 규칙

```
패턴: https://labs.google/fx/*/tools/flow/*

매칭 O: https://labs.google/fx/ko/tools/flow/project/abc123
매칭 X: https://labs.google/fx/ko/tools/flow  (뒤에 / 없음)

해결: 두 패턴 모두 등록
"matches": [
  "https://labs.google/fx/*/tools/flow",
  "https://labs.google/fx/*/tools/flow/*"
]
```

---

## 7. VEO Automation 경쟁 확장 분석

| 확장 | 버전 | 특징 |
|------|------|------|
| VEO Automation | v2.1.2 | 배치 처리, 자동 다운로드, 다국어 |
| Auto Flow Pro | - | VEO AI 자동화, 큐 관리 |
| FlowForge Pro | - | Veo AI Automator |
| Flow Automator | - | Whisk + Flow 지원 |

### 공통 기능:
- 동시 프롬프트 처리 (1~6개)
- 자동 재시도 (과부하 시 30초 간격)
- 자동 다운로드 (720p/1080p/4K)
- 폴더별 정리
- 프레임 이미지 자동 매칭

---

## 8. 참고 소스

- Chrome Side Panel API: https://developer.chrome.com/docs/extensions/reference/api/sidePanel
- Message Passing: https://developer.chrome.com/docs/extensions/develop/concepts/messaging
- Side Panel 통신 예제: https://dev.to/jgrisafe/interacting-with-web-content-using-chromes-new-side-panel-extension-feature-4ock
- MV3 가이드 2026: https://www.extensionfast.com/blog/how-to-build-a-chrome-extension-side-panel-in-2026
- VEO Automation 가이드: https://github.com/trgkyle/veo-automation-user-guide
- Chrome Web Store - VEO Automation: https://chromewebstore.google.com/detail/veo-automation-auto-veo-o/fnmijgmnjpealnnadjpjilaanhhambeb
