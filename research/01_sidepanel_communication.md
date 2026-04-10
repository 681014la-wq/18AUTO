# chrome extension MV3 side panel content script communication 2024

> 검색일: 2026-04-10

## 핵심 발견

- chrome.sidePanel API는 Chrome 114+ 필요, MV3 전용
- Side Panel은 별도 `chrome-extension://` URL 페이지 → 웹페이지 DOM 직접 접근 불가
- 웹페이지 DOM 접근은 content script를 통해서만 가능
- Side Panel ↔ Background ↔ Content Script 3자 메시지 패싱 구조

### 통신 아키텍처
- Background(service worker)는 DOM 직접 접근 불가
- Content Script → chrome.runtime.sendMessage → Background
- Background → chrome.tabs.sendMessage → Content Script
- Side Panel ↔ Background: chrome.runtime.sendMessage / onMessage

### iframe 내부 통신
- Side Panel 내부 iframe이 웹페이지인 경우
- Content script에서 `chrome.runtime.connect`로 port-based messaging 시작
- Background의 `chrome.runtime.onConnect` 리스너에서 `port.postMessage`로 응답

## 참조 URL

- [chrome.sidePanel API](https://developer.chrome.com/docs/extensions/reference/api/sidePanel)
- [Side Panel with Web Content - DEV Community](https://dev.to/jgrisafe/interacting-with-web-content-using-chromes-new-side-panel-extension-feature-4ock)
- [Broadcasting messages on Chrome extensions](https://medium.com/@wilkerlucio/broadcasting-messages-on-chrome-extensions-6f7718c662f5)
- [Building persistent Chrome Extension using MV3](https://rahulnegi20.medium.com/building-persistent-chrome-extension-using-manifest-v3-198000bf1db6)
- [Create Sidebar Chrome Extension MV3](https://www.stefanvd.net/blog/2023/05/06/how-to-create-a-sidebar-chrome-extension-mv3/)

## 코드 패턴 (있는 경우)

```javascript
// background.js - Side Panel → Content Script 중계
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'FROM_SIDE_PANEL') {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, ([tab]) => {
      chrome.tabs.sendMessage(tab.id, message, sendResponse);
    });
    return true; // async
  }
});

// content.js - 메시지 수신
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'FROM_SIDE_PANEL') {
    // DOM 조작
    sendResponse({ success: true });
  }
});

// sidepanel.js - 메시지 송신
chrome.runtime.sendMessage({ type: 'FROM_SIDE_PANEL', data: '...' });
```

## 18AUTO 적용 방법

- 18AUTO 확장의 UI(Side Panel) → Background → Content Script(labs.google 페이지) 구조로 설계
- Side Panel에서 프롬프트 목록 관리, Content Script에서 실제 DOM 조작(버튼 클릭, 텍스트 입력)
- Port-based messaging으로 생성 진행 상태를 Side Panel에 실시간 전달 가능
