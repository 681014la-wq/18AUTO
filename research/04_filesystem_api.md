# File System Access API — 폴더 직접 저장

> 검색일: 2026-04-10

---

## 개요

`showDirectoryPicker()`로 사용자가 저장 폴더 직접 선택.
Chrome MV3 확장에서 별도 권한 없이 사용 가능.

---

## 핵심 코드

```javascript
// Side Panel에서 폴더 선택
let dirHandle = null;

document.getElementById('btn-pick-folder').addEventListener('click', async () => {
  try {
    dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
    console.log('폴더 선택:', dirHandle.name);
  } catch (e) {
    if (e.name !== 'AbortError') console.error(e);
  }
});

// URL → 파일로 직접 저장
async function saveToFolder(url, filename) {
  if (!dirHandle) return false;
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
    return true;
  } catch (e) {
    console.error('저장 실패:', e);
    return false;
  }
}
```

---

## chrome.downloads vs File System API 비교

| 항목 | chrome.downloads | File System API |
|------|-----------------|-----------------|
| 저장 위치 | Chrome 다운로드 폴더 고정 | 사용자 지정 폴더 |
| 권한 | manifest에 "downloads" 필요 | 없음 |
| 파일명 충돌 | conflictAction 옵션 | getFileHandle uniquify 직접 처리 |
| 사용처 | Side Panel 없어도 가능 | Side Panel이 열려있어야 함 |

---

## 주의

- `showDirectoryPicker`는 사용자 제스처(클릭) 필요
- Content Script에서 직접 호출 불가 → Side Panel에서만 호출 가능
- Content Script → SW → Side Panel 경유 (DOWNLOAD_VIA_PANEL 메시지)

---

## 18AUTO 적용

다운로드 우선순위:
1. blob: URL → anchor 클릭 (Content Script 직접)
2. Side Panel FileSystem API (사용자가 폴더 선택한 경우)
3. chrome.downloads → SW 경유 (기본 다운로드 폴더)

---

## 참조
- https://developer.chrome.com/docs/capabilities/web-apis/file-system-access
- https://developer.chrome.com/docs/capabilities/browser-fs-access
- https://github.com/WICG/file-system-access/issues/314
