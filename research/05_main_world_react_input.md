# MAIN World 주입 & React Controlled Input 처리

> 검색일: 2026-04-10

---

## 문제

React controlled input에 `execCommand`나 일반 value 설정이 안 먹히는 경우:
- React가 자체 가상 DOM 상태와 실제 DOM을 분리 관리
- ISOLATED World에서 `nativeInputValueSetter`를 직접 접근 불가

---

## 방법 1 — execCommand (Slate.js 한정 권장)

```javascript
// ISOLATED World에서도 Slate.js에 안정적으로 동작
el.click();
el.focus();
document.execCommand('selectAll', false, null);
document.execCommand('delete', false, null);
document.execCommand('insertText', false, text);
```
- `execCommand`는 브라우저 네이티브 `beforeinput` 이벤트를 발생시킴
- Slate.js는 이 이벤트를 수신해 React 상태 갱신
- Flow의 프롬프트 입력창 = Slate.js → 이 방법 사용

---

## 방법 2 — MAIN World 주입 + nativeInputValueSetter

```javascript
// service_worker.js에서 MAIN world로 스크립트 주입
chrome.scripting.executeScript({
  target: { tabId },
  world: 'MAIN',  // ← MAIN world
  func: (text) => {
    const el = document.querySelector('input[type="text"]');
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, 'value'
    ).set;
    nativeSetter.call(el, text);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  },
  args: [text],
});
```
- React controlled `<input>` (일반 input) 대상
- Slate.js contenteditable에는 불필요

---

## 방법 3 — ClipboardEvent paste

```javascript
const dt = new DataTransfer();
dt.setData('text/plain', text);
el.dispatchEvent(new ClipboardEvent('paste', {
  clipboardData: dt,
  bubbles: true,
  cancelable: true,
}));
```
- 일부 에디터에서 execCommand 대안으로 사용
- Flow Slate.js에서는 execCommand가 더 안정적

---

## 18AUTO 적용 판단

| 입력창 유형 | 사용할 방법 |
|------------|------------|
| Flow 프롬프트 (Slate.js contenteditable) | execCommand (방법 1) |
| 일반 React input | MAIN World nativeInputValueSetter (방법 2) |
| 기타 textarea | value 직접 할당 + input 이벤트 |

---

## 참조
- https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts
- https://medium.com/@yosevu/how-to-inject-a-react-app-into-a-chrome-extension-as-a-content-script-3a038f611067
