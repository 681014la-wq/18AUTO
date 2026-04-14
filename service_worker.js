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

  // Content Script → CLICK_GENERATE (MAIN world 버튼 탐색+클릭)
  if (msg.type === 'CLICK_GENERATE') {
    const tabId = sender.tab?.id;
    if (!tabId) { sendResponse({ ok: false }); return false; }
    chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: () => {
        // Shadow DOM 포함 전체 버튼 탐색
        const allBtns = [];
        function collect(root) {
          root.querySelectorAll('button,[role="button"],[tabindex="0"]').forEach(b => allBtns.push(b));
          root.querySelectorAll('*').forEach(el => { if (el.shadowRoot) collect(el.shadowRoot); });
        }
        collect(document);

        const DENY = ['search','검색','menu','close','닫기','more','settings','설정','filter','필터','back','뒤로','add_2','upload','업로드','이미지 업로드'];
        const isGood = b => {
          if (b.disabled || b.getAttribute('aria-disabled') === 'true') return false;
          if (b.offsetParent === null && !b.closest('[open]')) return false;
          const t = (b.innerText || b.getAttribute('aria-label') || '').toLowerCase().trim();
          if (DENY.some(d => t.includes(d))) return false;
          return true;
        };

        const input = document.querySelector('div[data-slate-editor="true"]')
                   || document.querySelector('div[contenteditable="true"]')
                   || document.querySelector('textarea');

        // 1순위: 입력창 하단 가장 오른쪽 버튼 (파란 화살표 = 생성 버튼)
        if (input) {
          const inputRect = input.getBoundingClientRect();
          const nearby = allBtns.filter(b => {
            if (!isGood(b)) return false;
            const r = b.getBoundingClientRect();
            return r.width > 0 && r.height > 0
              && r.top >= inputRect.top - 30 && r.top <= inputRect.bottom + 150;
          });
          if (nearby.length) {
            // 가장 오른쪽 + 아래쪽 버튼 = submit/send 버튼
            nearby.sort((a, b) => {
              const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
              return (rb.right + rb.bottom) - (ra.right + ra.bottom);
            });
            const btn = nearby[0];
            btn.click();
            return 'CLICKED_NEARBY:' + (btn.innerText || btn.getAttribute('aria-label') || 'icon').trim().slice(0,30);
          }
        }

        // 2순위: 텍스트에 만들기/생성/create/generate (add_2 제외됨)
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

  // Content Script → UPLOAD_IMAGE (MAIN world에서 Flow에 이미지 업로드)
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
