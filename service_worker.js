// service_worker.js — VEO Automation v2.6.8 (MV3)

// ─────────────────────────────────────────────
// 아이콘 클릭 → 사이드패널 열기
// ─────────────────────────────────────────────
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// ─────────────────────────────────────────────
// 활성 배치 상태 (메모리 + storage)
// ─────────────────────────────────────────────
const activeBatches = new Map(); // groupId → { status, completedCount, failedCount, totalCount, tabId }

// ─────────────────────────────────────────────
// Keep-Alive — Port onConnect 방식 (연구 결론)
// Side Panel에서 연결 유지 → SW 절대 수면 안 함
// ─────────────────────────────────────────────
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'keepAlive') {
    const timer = setInterval(() => {
      try { port.postMessage({ type: 'ping' }); } catch (_) { clearInterval(timer); }
    }, 25000);
    port.onDisconnect.addListener(() => clearInterval(timer));
  }
});

// ─────────────────────────────────────────────
// Flow 탭 찾기 + content_script 자동 주입
// ─────────────────────────────────────────────
async function findFlowTab() {
  const patterns = ['*://labs.google/fx/*/tools/flow/*'];

  const activeTabs = await chrome.tabs.query({ active: true, url: patterns });
  const allTabs    = await chrome.tabs.query({ url: patterns });
  const sorted = [
    ...activeTabs,
    ...allTabs.filter(t => !activeTabs.find(a => a.id === t.id)),
  ];

  if (!sorted.length) return null;

  // PING 응답 탭 우선
  for (const tab of sorted) {
    try {
      const ping = await chrome.tabs.sendMessage(tab.id, { type: 'PING' });
      if (ping && ping.ok) return tab.id;
    } catch (_) {}
  }

  // content_script 강제 주입 후 재시도
  for (const tab of sorted) {
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content_script.js'] });
      await new Promise(r => setTimeout(r, 500));
      const ping = await chrome.tabs.sendMessage(tab.id, { type: 'PING' });
      if (ping && ping.ok) return tab.id;
    } catch (_) {}
  }

  return null;
}

// ─────────────────────────────────────────────
// 메시지 수신
// ─────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

  if (msg.type === 'PING') {
    sendResponse({ ok: true, version: '2.6.8' });
    return false;
  }

  // Content Script → BATCH_PROGRESS
  if (msg.type === 'BATCH_PROGRESS') {
    const { groupId, completedCount, failedCount, totalCount } = msg;
    const prev = activeBatches.get(groupId) || {};
    const next = { ...prev, status: 'running', completedCount, failedCount: failedCount || 0, totalCount };
    activeBatches.set(groupId, next);
    chrome.storage.local.set({ [groupId]: { id: groupId, ...next } });
    return false;
  }

  // Content Script → BATCH_COMPLETED
  if (msg.type === 'BATCH_COMPLETED') {
    const { groupId, completedCount, totalCount } = msg;
    const data = { status: 'completed', completedCount, totalCount };
    activeBatches.set(groupId, data);
    chrome.storage.local.set({ [groupId]: { id: groupId, ...data } });
    sendResponse({ ok: true });
    return false;
  }

  // Content Script → 실시간 로그
  if (msg.type === 'CS_LOG') {
    chrome.storage.local.get('veoLogs', (r) => {
      const logs = r.veoLogs || [];
      logs.push({ text: msg.text, logType: msg.logType || 'info', ts: Date.now() });
      if (logs.length > 300) logs.splice(0, logs.length - 300);
      chrome.storage.local.set({ veoLogs: logs });
    });
    return false;
  }

  // Content Script → DOWNLOAD_FILE
  if (msg.type === 'DOWNLOAD_FILE') {
    const { url, filename, folder } = msg;
    chrome.downloads.download({
      url,
      filename: folder ? `${folder}/${filename}` : filename,
      conflictAction: 'uniquify',
    });
    sendResponse({ ok: true });
    return false;
  }

  // Content Script → TYPE_AT_SYMBOL / TYPE_CHAR (MAIN world 키보드 시뮬레이션)
  if (msg.type === 'TYPE_AT_SYMBOL' || msg.type === 'TYPE_CHAR') {
    const tabId = sender.tab?.id;
    if (!tabId) { sendResponse({ ok: false, error: 'no tab' }); return false; }
    const char = msg.type === 'TYPE_AT_SYMBOL' ? '@' : msg.char;
    chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: (ch) => {
        const el = document.querySelector('div[data-slate-editor="true"]')
                || document.querySelector('div[contenteditable="true"]');
        if (!el) return 'NO_EDITOR';
        el.focus();

        // 키보드 이벤트 시퀀스: keydown → beforeinput → input → keyup
        const keyOpts = { key: ch, code: ch === '@' ? 'Digit2' : 'Key' + ch.toUpperCase(), bubbles: true, cancelable: true };
        el.dispatchEvent(new KeyboardEvent('keydown', keyOpts));

        // beforeinput (Slate 트리거)
        el.dispatchEvent(new InputEvent('beforeinput', {
          bubbles: true, cancelable: true,
          inputType: 'insertText', data: ch,
        }));

        // input
        el.dispatchEvent(new InputEvent('input', {
          bubbles: true, cancelable: false,
          inputType: 'insertText', data: ch,
        }));

        el.dispatchEvent(new KeyboardEvent('keyup', keyOpts));
        return 'OK';
      },
      args: [char]
    }).then(results => {
      const r = results?.[0]?.result || 'UNKNOWN';
      sendResponse({ ok: r === 'OK', result: r });
    }).catch(e => {
      sendResponse({ ok: false, error: e.message });
    });
    return true;
  }

  // Content Script → INJECT_TEXT_BEFOREINPUT (VEO Automation 원본 방식)
  // Ctrl+A 선택 → beforeinput insertText — Slate React 상태 정상 갱신
  if (msg.type === 'INJECT_TEXT_BEFOREINPUT') {
    const tabId = sender.tab?.id;
    if (!tabId) { sendResponse({ ok: false, error: 'no tab' }); return false; }
    chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: (text) => {
        return new Promise(async (resolve) => {
          const sleep = ms => new Promise(r => setTimeout(r, ms));
          const el = document.querySelector('div[data-slate-editor="true"]')
                  || document.querySelector('div[contenteditable="true"]');
          if (!el) { resolve('NO_EDITOR'); return; }

          // 1) focus + click
          el.click();
          el.focus();
          await sleep(150);

          // 2) 전체 선택 — Selection API (합성 이벤트는 isTrusted=false라 네이티브 동작 안 함)
          const sel = window.getSelection();
          if (sel) {
            sel.selectAllChildren(el);
          }
          await sleep(80);

          // 3) beforeinput insertText — Slate가 리스닝하는 핵심 이벤트
          el.dispatchEvent(new InputEvent('beforeinput', {
            bubbles: true, cancelable: true,
            inputType: 'insertText', data: text,
          }));
          await sleep(100);

          resolve('OK_BEFOREINPUT_V2');
        });
      },
      args: [msg.text]
    }).then(results => {
      const r = results?.[0]?.result || 'UNKNOWN';
      sendResponse({ ok: r.startsWith('OK'), result: r });
    }).catch(e => {
      sendResponse({ ok: false, error: e.message });
    });
    return true;
  }

  // Content Script → INJECT_TEXT (MAIN world Slate 입력)
  if (msg.type === 'INJECT_TEXT') {
    const tabId = sender.tab?.id;
    if (!tabId) { sendResponse({ ok: false, error: 'no tab' }); return false; }
    chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: (text) => {
        const el = document.querySelector('div[data-slate-editor="true"]')
                || document.querySelector('div[contenteditable="true"]');
        if (!el) return 'NO_EDITOR';
        el.focus();

        // 기존 텍스트 전체 선택 → insertText로 교체
        const sel = window.getSelection();
        if (sel) sel.selectAllChildren(el);

        // 1순위: beforeinput (Slate가 실제 리스닝하는 이벤트) — 선택 상태면 교체됨
        const handled = !el.dispatchEvent(new InputEvent('beforeinput', {
          bubbles: true, cancelable: true,
          inputType: 'insertText', data: text,
        }));
        if (handled) return 'OK_BEFOREINPUT';

        // 2순위: ClipboardEvent paste
        try {
          const dt = new DataTransfer();
          dt.setData('text/plain', text);
          dt.setData('text/html', text);
          const pasteHandled = !el.dispatchEvent(new ClipboardEvent('paste', {
            clipboardData: dt, bubbles: true, cancelable: true
          }));
          if (pasteHandled) return 'OK_PASTE';
        } catch(e) {}

        // 3순위: execCommand (fallback)
        document.execCommand('selectAll', false, null);
        document.execCommand('delete', false, null);
        document.execCommand('insertText', false, text);
        return 'FALLBACK_EXEC';
      },
      args: [msg.text]
    }).then(results => {
      const r = results?.[0]?.result || 'UNKNOWN';
      sendResponse({ ok: r.startsWith('OK'), result: r });
    }).catch(e => {
      sendResponse({ ok: false, error: e.message });
    });
    return true;
  }

  // Content Script → CLICK_GENERATE (원본 V1 로직 복원 + arrow_forward 추가)
  if (msg.type === 'CLICK_GENERATE') {
    const tabId = sender.tab?.id;
    if (!tabId) { sendResponse({ ok: false }); return false; }
    chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: () => {
        // Shadow DOM 포함 전체 버튼 탐색 (원본 V1 방식)
        const allBtns = [];
        function collect(root) {
          root.querySelectorAll('button,[role="button"],[tabindex="0"]').forEach(b => allBtns.push(b));
          root.querySelectorAll('*').forEach(el => { if (el.shadowRoot) collect(el.shadowRoot); });
        }
        collect(document);

        const DENY = ['search','검색','menu','close','닫기','more','settings','설정','filter','필터','back','뒤로','add_2','add','upload','업로드','이미지 업로드'];
        const isGood = b => {
          if (b.disabled || b.getAttribute('aria-disabled') === 'true') return false;
          if (b.offsetParent === null && !b.closest('[open]')) return false;
          const t = (b.innerText || b.getAttribute('aria-label') || '').toLowerCase().trim();
          if (DENY.some(d => t.includes(d))) return false;
          return true;
        };

        // 0순위: arrow_forward 아이콘 (원본 remote config 셀렉터)
        for (const b of allBtns) {
          const icon = b.querySelector('span.material-icons, mat-icon, .material-symbols-outlined, i, [class*="material"]');
          if (icon && icon.textContent.trim() === 'arrow_forward') {
            b.click();
            return 'CLICKED_ARROW_FORWARD';
          }
        }

        const input = document.querySelector('div[data-slate-editor="true"]')
                   || document.querySelector('div[contenteditable="true"]')
                   || document.querySelector('textarea');

        // 1순위: 입력창 근처 가장 오른쪽+아래쪽 버튼 (원본 V1)
        if (input) {
          const inputRect = input.getBoundingClientRect();
          const nearby = allBtns.filter(b => {
            if (!isGood(b)) return false;
            const r = b.getBoundingClientRect();
            return r.width > 0 && r.height > 0
              && r.top >= inputRect.top - 30 && r.top <= inputRect.bottom + 150;
          });
          if (nearby.length) {
            nearby.sort((a, b) => {
              const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
              return (rb.right + rb.bottom) - (ra.right + ra.bottom);
            });
            const btn = nearby[0];
            btn.click();
            return 'CLICKED_NEARBY:' + (btn.innerText || btn.getAttribute('aria-label') || 'icon').trim().slice(0,30);
          }
        }

        // 2순위: 텍스트 기반 (원본 V1)
        const ALLOW = ['만들기','생성','generate','create'];
        for (const b of allBtns) {
          if (!isGood(b)) continue;
          const t = (b.innerText || b.getAttribute('aria-label') || '').toLowerCase();
          if (ALLOW.some(k => t.includes(k))) { b.click(); return 'CLICKED_TEXT:' + t.trim().slice(0,30); }
        }

        // 3순위: 페이지 하단 마지막 버튼
        const vh = window.innerHeight;
        const bottom = allBtns.filter(b => {
          if (!isGood(b)) return false;
          const r = b.getBoundingClientRect();
          return r.top > vh * 0.5 && r.width > 20;
        });
        if (bottom.length) {
          const btn = bottom[bottom.length - 1];
          btn.click();
          return 'CLICKED_BOTTOM:' + (btn.innerText || btn.getAttribute('aria-label') || 'icon').trim().slice(0,30);
        }

        return 'NO_BTN:total=' + allBtns.length + ',good=' + allBtns.filter(isGood).length;
      },
      args: []
    }).then(results => {
      const r = results?.[0]?.result || 'UNKNOWN';
      sendResponse({ ok: r.startsWith('CLICKED'), result: r });
    }).catch(e => sendResponse({ ok: false, error: e.message }));
    return true;
  }

  // Content Script → UPLOAD_IMAGE_V2 (원본 VEO Automation 방식 — jQuery 셀렉터→Vanilla JS 변환)
  // 흐름: addImageButton → selectUploadImageType → sort → search → select (or upload → search → select)
  if (msg.type === 'UPLOAD_IMAGE_V2') {
    const tabId = sender.tab?.id;
    if (!tabId) { sendResponse({ ok: false, error: 'no tab' }); return false; }
    chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: (dataUrl, fileName) => {
        return new Promise(async (resolve) => {
          const sleep = ms => new Promise(r => setTimeout(r, ms));
          try {
            // dataURL → File 변환
            const resp = await fetch(dataUrl);
            const blob = await resp.blob();
            const file = new File([blob], fileName, { type: blob.type || 'image/png' });
            const searchName = fileName.replace(/\.[^.]+$/, '');

            // ── jQuery 셀렉터 → Vanilla JS 유틸 ──
            // 원본 V1에서 작동 확인된 셀렉터: span.material-icons, mat-icon, .material-symbols-outlined
            function findBtnByIcon(iconText, scope) {
              const root = scope || document;
              const btns = root.querySelectorAll('button');
              for (const b of btns) {
                const icon = b.querySelector('span.material-icons, mat-icon, .material-symbols-outlined, i, span[class*="material"], [class*="material"]');
                if (icon && icon.textContent.trim() === iconText) return b;
                // aria-label fallback
                if ((b.getAttribute('aria-label') || '').toLowerCase() === iconText) return b;
              }
              return null;
            }

            // ── 1단계: addImageButton 클릭 (에셋 피커 열기) ──
            // 원본 remote config: button:has(i:contains("add_2"))
            // 원본 V1 코드: iconText === 'add' || 'add_circle' + 입력창 근처 위치 필터
            let addBtn = findBtnByIcon('add_2');
            if (!addBtn) addBtn = findBtnByIcon('add');
            if (!addBtn) addBtn = findBtnByIcon('add_circle');
            if (!addBtn) {
              // 위치 기반 fallback (원본 V1 방식): 입력창 근처 "+" 버튼
              const input = document.querySelector('div[data-slate-editor="true"]')
                         || document.querySelector('div[contenteditable="true"]');
              if (input) {
                const inputRect = input.getBoundingClientRect();
                const allBtns = [...document.querySelectorAll('button')];
                for (const b of allBtns) {
                  const t = (b.innerText || '').trim();
                  const r = b.getBoundingClientRect();
                  if ((t === '+' || t === '추가') && r.bottom > window.innerHeight * 0.5 && r.width > 0) {
                    addBtn = b; break;
                  }
                  // 입력창 왼쪽 가장 가까운 버튼
                  if (!addBtn && r.width > 0 && r.height > 0
                    && Math.abs(r.top - inputRect.top) < 60
                    && r.right < inputRect.left + 80) {
                    addBtn = b;
                  }
                }
              }
            }
            if (!addBtn) { resolve('FAIL:NO_ADD_BTN'); return; }

            addBtn.click();
            await sleep(1200);

            // ── 2단계: selectUploadImageType (이미지 탭 선택) ──
            // 원본: div[data-side="top"] button:has(i:contains("image"))
            // ※ 존재할 때만 클릭 (원본: i().length > 0 체크)
            const topPanel = document.querySelector('div[data-side="top"]');
            if (topPanel) {
              const imgBtn = findBtnByIcon('image', topPanel);
              if (imgBtn) {
                imgBtn.click();
                await sleep(500);
              }
            }

            // ── 3단계: sortOptionsButton → sortLatestOption ──
            // 원본: div[data-side="top"] button[aria-haspopup="menu"]:last()
            if (topPanel) {
              const sortBtns = topPanel.querySelectorAll('button[aria-haspopup="menu"]');
              const sortBtn = sortBtns.length > 0 ? sortBtns[sortBtns.length - 1] : null;
              if (sortBtn) {
                sortBtn.click();
                await sleep(500);
                // 원본: div[role="menu"] > button:eq(2)  → 세 번째 버튼 = 최신순
                const menuBtns = document.querySelectorAll('div[role="menu"] > button');
                if (menuBtns.length > 2) {
                  menuBtns[2].click();
                  await sleep(500);
                }
              }
            }

            // ── 4단계: searchUploadedImage → 파일명 검색 ──
            // 원본: div[data-side="top"] input[type="text"]
            const searchInput = topPanel?.querySelector('input[type="text"]');
            if (searchInput) {
              searchInput.focus();
              searchInput.click();
              await sleep(200);
              const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
              if (nativeSetter) nativeSetter.call(searchInput, searchName);
              else searchInput.value = searchName;
              searchInput.dispatchEvent(new Event('input', { bubbles: true }));
              await sleep(1500);

              // 원본: virtuosoItemList:first:has(div:contains("name"))
              const items = topPanel?.querySelectorAll('div[data-testid="virtuoso-item-list"] > div') || [];
              // 파일명 매칭 항목 우선
              let matched = [...items].find(el => el.textContent?.includes(searchName));
              if (!matched && items.length > 0) matched = items[0]; // 없으면 첫 번째
              if (matched) {
                const img = matched.querySelector('img');
                if (img) img.click();
                else matched.click();
                await sleep(500);
                resolve('OK_SEARCH_SELECT');
                return;
              }
            }

            // ── 5단계: 검색 실패 → fileInput으로 직접 업로드 ──
            // 원본: input[type="file"] + DataTransfer
            let fileInput = document.querySelector('input[type="file"]');
            if (!fileInput) {
              // file input이 아직 안 보이면 업로드 버튼 찾아서 클릭
              if (topPanel) {
                const allEls = topPanel.querySelectorAll('*');
                for (const el of allEls) {
                  const t = (el.textContent || '').trim();
                  if (t === '이미지 업로드' || t === 'Image upload' || t === 'Upload image' || t === 'Upload') {
                    el.click();
                    await sleep(800);
                    fileInput = document.querySelector('input[type="file"]');
                    break;
                  }
                }
              }
            }

            if (fileInput) {
              const dt = new DataTransfer();
              dt.items.add(file);
              fileInput.files = dt.files;
              fileInput.dispatchEvent(new Event('change', { bubbles: true }));

              // 업로드 완료 대기 (최대 30초)
              for (let check = 0; check < 60; check++) {
                await sleep(500);
                const allText = document.body.innerText || '';
                if (allText.includes('100%') || (!allText.match(/\d+%/) && check > 10)) break;
              }
              await sleep(1500);

              // 업로드 후 검색하여 선택
              if (searchInput) {
                const ns = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
                if (ns) ns.call(searchInput, searchName);
                else searchInput.value = searchName;
                searchInput.dispatchEvent(new Event('input', { bubbles: true }));
                await sleep(1500);

                const items2 = topPanel?.querySelectorAll('div[data-testid="virtuoso-item-list"] > div') || [];
                let matched2 = [...items2].find(el => el.textContent?.includes(searchName));
                if (!matched2 && items2.length > 0) matched2 = items2[0];
                if (matched2) {
                  const img2 = matched2.querySelector('img');
                  if (img2) img2.click();
                  else matched2.click();
                  await sleep(500);
                }
              }

              resolve('OK_UPLOAD_FILE');
            } else {
              resolve('FAIL:NO_FILE_INPUT');
            }
          } catch (e) {
            resolve('FAIL:' + e.message);
          }
        });
      },
      args: [msg.dataUrl, msg.fileName]
    }).then(results => {
      const r = results?.[0]?.result || 'UNKNOWN';
      sendResponse({ ok: r.startsWith('OK'), result: r });
    }).catch(e => {
      sendResponse({ ok: false, error: e.message });
    });
    return true;
  }

  // Content Script → UPLOAD_IMAGE (MAIN world에서 Flow에 이미지 업로드 — 기존 V1)
  if (msg.type === 'UPLOAD_IMAGE') {
    const tabId = sender.tab?.id;
    if (!tabId) { sendResponse({ ok: false, error: 'no tab' }); return false; }
    chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: (dataUrl, fileName) => {
        return new Promise(async (resolve) => {
          try {
            // dataURL → File 변환
            const res = await fetch(dataUrl);
            const blob = await res.blob();
            const file = new File([blob], fileName, { type: blob.type });

            // 1. "+" 버튼 찾기 (Shadow DOM 관통)
            const allBtns = [];
            function collect(root) {
              root.querySelectorAll('button,[role="button"],[tabindex="0"]').forEach(b => allBtns.push(b));
              root.querySelectorAll('*').forEach(el => { if (el.shadowRoot) collect(el.shadowRoot); });
            }
            collect(document);

            // "+" 또는 "add" 버튼 찾기
            let addBtn = null;
            for (const b of allBtns) {
              const t = (b.innerText || b.getAttribute('aria-label') || '').toLowerCase().trim();
              const icon = b.querySelector('span.material-icons, mat-icon, .material-symbols-outlined');
              const iconText = icon ? icon.textContent.trim().toLowerCase() : '';
              if (t === '+' || t === 'add' || t === '추가' || iconText === 'add' || iconText === 'add_circle') {
                // 입력창 근처의 + 버튼만
                const rect = b.getBoundingClientRect();
                if (rect.bottom > window.innerHeight * 0.5 && rect.width > 0) {
                  addBtn = b;
                  break;
                }
              }
            }

            if (!addBtn) {
              // fallback: 입력창 왼쪽 가장 가까운 버튼
              const input = document.querySelector('div[data-slate-editor="true"]')
                         || document.querySelector('div[contenteditable="true"]');
              if (input) {
                const inputRect = input.getBoundingClientRect();
                const nearby = allBtns.filter(b => {
                  const r = b.getBoundingClientRect();
                  return r.width > 0 && r.height > 0
                    && Math.abs(r.top - inputRect.top) < 60
                    && r.right < inputRect.left + 80;
                });
                if (nearby.length) addBtn = nearby[0];
              }
            }

            if (addBtn) {
              addBtn.click();
              await new Promise(r => setTimeout(r, 800));
            }

            // 2. 파일 input 찾기 (visible input[type="file"])
            let fileInput = null;
            const allInputs = [];
            function collectInputs(root) {
              root.querySelectorAll('input[type="file"]').forEach(i => allInputs.push(i));
              root.querySelectorAll('*').forEach(el => { if (el.shadowRoot) collectInputs(el.shadowRoot); });
            }
            collectInputs(document);
            fileInput = allInputs[allInputs.length - 1]; // 마지막(가장 최근) file input

            if (fileInput) {
              // DataTransfer로 파일 주입
              const dt = new DataTransfer();
              dt.items.add(file);
              fileInput.files = dt.files;
              fileInput.dispatchEvent(new Event('change', { bubbles: true }));
              fileInput.dispatchEvent(new Event('input', { bubbles: true }));
              resolve('OK_FILE_INPUT');
              return;
            }

            // 3. fallback: 드래그앤드롭 시뮬레이션
            const dropTarget = document.querySelector('div[data-slate-editor="true"]')
                            || document.querySelector('div[contenteditable="true"]')
                            || document.querySelector('[class*="drop"]')
                            || document.body;

            const dtDrop = new DataTransfer();
            dtDrop.items.add(file);

            const dragEnter = new DragEvent('dragenter', { dataTransfer: dtDrop, bubbles: true });
            const dragOver  = new DragEvent('dragover',  { dataTransfer: dtDrop, bubbles: true });
            const drop      = new DragEvent('drop',      { dataTransfer: dtDrop, bubbles: true });

            dropTarget.dispatchEvent(dragEnter);
            dropTarget.dispatchEvent(dragOver);
            dropTarget.dispatchEvent(drop);

            resolve('OK_DROP');
          } catch (e) {
            resolve('FAIL:' + e.message);
          }
        });
      },
      args: [msg.dataUrl, msg.fileName]
    }).then(results => {
      const r = results?.[0]?.result || 'UNKNOWN';
      sendResponse({ ok: r.startsWith('OK'), result: r });
    }).catch(e => {
      sendResponse({ ok: false, error: e.message });
    });
    return true;
  }

  // Side Panel → MANUAL_RUN
  if (msg.type === 'MANUAL_RUN') {
    handleManualRun(msg, sendResponse);
    return true;
  }

  // Side Panel → STOP_BATCH
  if (msg.type === 'STOP_BATCH') {
    handleStopBatch(msg, sendResponse);
    return true;
  }

  // Side Panel → GET_STATUS
  if (msg.type === 'GET_STATUS') {
    const mem = activeBatches.get(msg.groupId);
    if (mem) { sendResponse(mem); return false; }
    chrome.storage.local.get(msg.groupId, (r) => sendResponse(r[msg.groupId] || null));
    return true;
  }

  // Side Panel → INSPECT_DOM
  if (msg.type === 'INSPECT_DOM') {
    handleInspectDom(sendResponse);
    return true;
  }

  // Side Panel → SCAN_GALLERY (Content Script로 중계)
  if (msg.type === 'SCAN_GALLERY') {
    (async () => {
      try {
        const tabId = await findFlowTab();
        if (!tabId) { sendResponse({ urls: [], error: 'Flow 탭 없음' }); return; }
        const res = await chrome.tabs.sendMessage(tabId, { type: 'SCAN_GALLERY' });
        sendResponse(res || { urls: [] });
      } catch (e) {
        sendResponse({ urls: [], error: e.message });
      }
    })();
    return true;
  }

  return false;
});

// ─────────────────────────────────────────────
// MANUAL_RUN 핸들러
// ─────────────────────────────────────────────
async function handleManualRun(msg, sendResponse) {
  try {
    const tabId = await findFlowTab();
    if (!tabId) {
      sendResponse({ error: 'Flow 프로젝트 탭 없음 — Flow 프로젝트를 열어주세요' });
      return;
    }

    const groupId = msg.groupId || `run-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
    activeBatches.set(groupId, {
      status: 'running', completedCount: 0, failedCount: 0,
      totalCount: (msg.payloads || []).length, tabId,
    });

    const res = await chrome.tabs.sendMessage(tabId, {
      type:   'START_BATCH',
      payloads: msg.payloads || [],
      groupId,
      promptDelaySecondsMin: msg.promptDelaySecondsMin || 20,
      promptDelaySecondsMax: msg.promptDelaySecondsMax || 30,
    });

    if (res && res.ok) {
      sendResponse({ ok: true, groupId });
    } else {
      activeBatches.delete(groupId);
      sendResponse({ error: res?.error || 'Content Script 오류' });
    }
  } catch (e) {
    sendResponse({ error: e.message });
  }
}

// ─────────────────────────────────────────────
// STOP_BATCH 핸들러
// ─────────────────────────────────────────────
async function handleStopBatch(msg, sendResponse) {
  try {
    const batch = activeBatches.get(msg.groupId);
    let tabId   = batch?.tabId || await findFlowTab();
    if (!tabId) { sendResponse({ ok: false, error: 'Flow 탭 없음' }); return; }

    await chrome.tabs.sendMessage(tabId, { type: 'STOP_BATCH' });

    if (batch) {
      batch.status = 'stopped';
      activeBatches.set(msg.groupId, batch);
      chrome.storage.local.set({ [msg.groupId]: { ...batch, id: msg.groupId } });
    }
    sendResponse({ ok: true });
  } catch (e) {
    sendResponse({ ok: false, error: e.message });
  }
}

// ─────────────────────────────────────────────
// INSPECT_DOM 릴레이
// ─────────────────────────────────────────────
async function handleInspectDom(sendResponse) {
  try {
    const tabId = await findFlowTab();
    if (!tabId) { sendResponse({ error: 'Flow 탭 없음' }); return; }
    const res = await chrome.tabs.sendMessage(tabId, { type: 'INSPECT_DOM' });
    sendResponse(res);
  } catch (e) {
    sendResponse({ error: e.message });
  }
}

// ─────────────────────────────────────────────
// 탭 닫힘 → 배치 실패 처리
// ─────────────────────────────────────────────
chrome.tabs.onRemoved.addListener((tabId) => {
  for (const [groupId, batch] of activeBatches) {
    if (batch.tabId === tabId && batch.status === 'running') {
      batch.status = 'failed';
      activeBatches.set(groupId, batch);
      chrome.storage.local.set({ [groupId]: { ...batch, id: groupId } });
    }
  }
});

console.log('[VeoAuto] Service Worker v2.6.8 loaded');
