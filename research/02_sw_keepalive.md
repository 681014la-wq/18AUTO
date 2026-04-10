# chrome extension MV3 service worker keep alive 2024

> 검색일: 2026-04-10

## 핵심 발견

- MV3 service worker는 기본 30초 비활성 후 종료
- Chrome 110+: extension API 이벤트 수신 중이면 계속 활성
- Chrome 116+: WebSocket 연결 유지 시 service worker 살아있음
- 인메모리 전역변수는 service worker 종료 시 소멸 → chrome.storage 필수

### Keep-Alive 방법들
1. **25초 interval ping**: `chrome.runtime.getPlatformInfo()` 주기적 호출
2. **heartbeat**: 20초마다 `chrome.storage.local.set({ lastAlive: Date.now() })`
3. **WebSocket 유지** (Chrome 116+): 활성 WebSocket이 있으면 타임아웃 리셋
4. **Native messaging**: `chrome.runtime.connectNative()` 호출 시 유지
5. **chrome.runtime.onConnect**: Content script와 port 연결 유지

### 중요 제한
- 무한 keepalive는 enterprise/education managed device에서만 허용
- 일반 extension은 불가 → 이벤트 기반 설계 권장
- 5분 하드 타임아웃은 Chrome 110+에서 제거됨

## 참조 URL

- [Extension service worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)
- [MV3 service worker keepalive gist](https://gist.github.com/sunnyguan/f94058f66fab89e59e75b1ac1bf1a06e)
- [Longer extension service worker lifetimes](https://developer.chrome.com/blog/longer-esw-lifetimes)
- [Mitigate service worker timeout - Medium](https://medium.com/@bhuvan.gandhi/chrome-extension-v3-mitigate-service-worker-timeout-issue-in-the-easiest-way-fccc01877abd)
- [Building persistent Chrome Extension using MV3](https://rahulnegi20.medium.com/building-persistent-chrome-extension-using-manifest-v3-198000bf1db6)

## 코드 패턴 (있는 경우)

```javascript
// background.js - waitUntil keepalive 패턴
function keepAlive() {
  const keepAliveInterval = setInterval(() => {
    if (chrome.runtime?.id) {
      chrome.runtime.getPlatformInfo(); // API 호출로 타임아웃 리셋
    } else {
      clearInterval(keepAliveInterval);
    }
  }, 25000);
}

// Port 연결 유지 패턴 (content script와 장기 연결)
chrome.runtime.onConnect.addListener((port) => {
  port.onDisconnect.addListener(() => {
    // 재연결 로직
  });
});
```

```javascript
// content.js - background와 port 연결 유지
const port = chrome.runtime.connect({ name: 'keepalive' });
setInterval(() => {
  port.postMessage({ type: 'PING' });
}, 25000);
```

## 18AUTO 적용 방법

- 배치 자동화 실행 중 service worker 종료 방지 필요
- Content script와 port 연결 유지로 keepalive 구현
- 큐 상태는 반드시 chrome.storage.local에 저장 (메모리 의존 금지)
- 생성 감지 루프는 content script에서 실행 (service worker 의존 최소화)
