# Service Worker Keep-Alive 심화 패턴

> 검색일: 2026-04-10
> 기존 CHROME_EXTENSION_RESEARCH.md의 SW 30초 내용 보완

---

## 핵심 문제

Chrome MV3 Service Worker는 30초 비활성 후 강제 종료됨.
배치 자동화처럼 장시간 실행 작업에서 치명적.

---

## 해결 방법 3가지

### 방법 1 — chrome.storage.local 호출 (20초 간격)
```javascript
// SW가 살아있는 동안 20초마다 storage 호출 → 타이머 리셋
setInterval(() => {
  chrome.storage.local.get('keepAlive', () => {});
}, 20000);
```
- 가장 단순한 방법
- Chrome API 호출이 idle 타이머를 30초로 리셋

### 방법 2 — Port onConnect (Highlander 방식) ← 권장
```javascript
// service_worker.js
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'keepAlive') {
    const timer = setInterval(() => port.postMessage('ping'), 25000);
    port.onDisconnect.addListener(() => clearInterval(timer));
  }
});

// side_panel.js 또는 content_script.js
const port = chrome.runtime.connect({ name: 'keepAlive' });
port.onMessage.addListener(() => {}); // 연결 유지
```
- Port 연결이 활성인 동안 SW 절대 종료 안 됨
- 가장 안정적

### 방법 3 — chrome.alarms (30초 최소 주기)
```javascript
chrome.alarms.create('keepAlive', { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keepAlive') {
    // SW 재시작 후 상태 복구
    chrome.storage.local.get('batchState', (result) => { ... });
  }
});
```
- 최소 30초 간격 제한
- SW 재시작 후에도 작동 (storage에서 상태 복구 필요)

---

## Windows 수면 모드 주의

Windows에서 컴퓨터 수면 → 깨어날 때 SW 타이머가 오작동 가능.
해결: storage에 lastHeartbeat 저장, 깨어날 때 시간 차 확인.

---

## 18AUTO 적용

- 배치 실행 중: Port 방식 (방법 2) 사용
- Side Panel이 열려있는 동안 port 연결 유지
- 배치 완료 시 port 연결 해제 → SW 자연 종료

---

## 참조
- https://developer.chrome.com/blog/longer-esw-lifetimes
- https://gist.github.com/sunnyguan/f94058f66fab89e59e75b1ac1bf1a06e
- https://medium.com/@bhuvan.gandhi/chrome-extension-v3-mitigate-service-worker-timeout-issue-in-the-easiest-way-fccc01877abd
