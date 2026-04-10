// content_script.js — VEO Automation v2.6.8 (ISOLATED world)

// ─────────────────────────────────────────────
// 중복 주입 방지
// ─────────────────────────────────────────────
if (window.__veoAutoInjected) {
  // 이미 주입됨
} else {
  window.__veoAutoInjected = true;
  init();
}

function init() {

// ─────────────────────────────────────────────
// 상태
// ─────────────────────────────────────────────
let batchRunning  = false;
let stopRequested = false;

// ─────────────────────────────────────────────
// Shadow DOM 상태바
// ─────────────────────────────────────────────
let host = document.getElementById('veo-auto-host');
if (!host) {
  host = document.createElement('div');
  host.id = 'veo-auto-host';
  host.style.cssText = 'position:fixed;bottom:16px;right:16px;z-index:2147483647;pointer-events:none;';
  document.body.appendChild(host);
}
const shadow = host.shadowRoot || host.attachShadow({ mode: 'open' });
shadow.innerHTML = `
<style>
  #bar {
    display:none;background:rgba(15,15,15,0.94);color:#e0e0e0;
    font:12px/1.5 monospace;padding:8px 14px;border-radius:8px;
    border-left:3px solid #10b981;max-width:360px;pointer-events:none;
    box-shadow:0 4px 16px rgba(0,0,0,0.6);
  }
  #bar.running { border-color:#10b981; }
  #bar.done    { border-color:#4ade80; }
  #bar.error   { border-color:#f87171; }
</style>
<div id="bar"></div>`;
const bar = shadow.getElementById('bar');

function setStatus(text, state = 'running') {
  bar.className  = state;
  bar.textContent = text;
  bar.style.display = 'block';
  if (state === 'done' || state === 'error') {
    setTimeout(() => { bar.style.display = 'none'; }, 5000);
  }
}

// ─────────────────────────────────────────────
// 유틸
// ─────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));
const randDelay = (minS, maxS) => sleep((minS + Math.random() * (maxS - minS)) * 1000);

function sendLog(text, logType = 'info') {
  console.log(`[VeoAuto][${logType}] ${text}`);
  try {
    chrome.runtime.sendMessage({ type: 'CS_LOG', text, logType });
  } catch (_) {}
}

// ─────────────────────────────────────────────
// 입력창 탐색 — Slate.js contenteditable
// ─────────────────────────────────────────────
function findInputEl() {
  const notInNav = el =>
    !el.closest('header,nav,[role="search"],[role="navigation"],[role="banner"]')
    && el.offsetParent !== null;

  const slates = Array.from(document.querySelectorAll('div[data-slate-editor="true"]')).filter(notInNav);
  if (slates.length) return slates[slates.length - 1];

  const editables = Array.from(document.querySelectorAll('div[contenteditable="true"]')).filter(notInNav);
  if (editables.length) return editables[editables.length - 1];

  return document.querySelector('[role="textbox"][contenteditable]')
      || document.querySelector('textarea')
      || null;
}

// ─────────────────────────────────────────────
// 프롬프트 입력 — execCommand (Slate React 상태 갱신)
// ─────────────────────────────────────────────
async function setPromptText(el, text) {
  el.click();
  el.focus();
  await sleep(300);
  if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype, 'value'
    )?.set;
    if (nativeSetter) {
      nativeSetter.call(el, text);
    } else {
      el.value = text;
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  } else {
    // MAIN world에서 Slate 입력 (ISOLATED world에서는 Slate 상태 갱신 불가)
    try {
      const res = await chrome.runtime.sendMessage({ type: 'INJECT_TEXT', text });
      sendLog(`MAIN world 입력: ${JSON.stringify(res)}`, res?.ok ? 'success' : 'error');
      if (res?.ok) { await sleep(1200); return; }
    } catch (e) {
      sendLog(`MAIN world 실패: ${e.message}`, 'error');
    }
    // fallback
    document.execCommand('selectAll', false, null);
    await sleep(80);
    document.execCommand('delete', false, null);
    await sleep(80);
    document.execCommand('insertText', false, text);
  }
  await sleep(800);
}

// ─────────────────────────────────────────────
// 생성 버튼 탐색
// ─────────────────────────────────────────────
function findGenerateButton() {
  const ALLOW = ['만들기', '생성', 'generate', 'create'];
  const DENY  = ['더 생성하기', '재생성', '다시 만들기', 'more options', 'more_vert', 'search', '검색', 'menu'];

  const isActive = b => {
    if (b.disabled) return false;
    if (b.getAttribute('aria-disabled') === 'true') return false;
    if (b.offsetParent === null) return false;
    return true;
  };
  const getText  = b => (b.innerText || '').toLowerCase().trim();
  const getLabel = b => (b.getAttribute('aria-label') || '').toLowerCase().trim();
  const allows   = b => ALLOW.some(k => getText(b).includes(k) || getLabel(b).includes(k));
  const denies   = b => DENY.some(k => getText(b).includes(k) || getLabel(b).includes(k));

  const candidates = Array.from(document.querySelectorAll('button,[role="button"]'))
    .filter(b => isActive(b) && allows(b) && !denies(b));

  if (candidates.length) {
    // action 영역 우선
    for (const sel of ['form','footer','[role="toolbar"]','[class*="action"]','[class*="prompt"]','[class*="bottom"]']) {
      for (const container of document.querySelectorAll(sel)) {
        const found = candidates.find(b => container.contains(b));
        if (found) return found;
      }
    }
    return candidates[0];
  }

  // 최후 수단: 입력창 근처 활성 버튼 (아이콘만 있는 생성 버튼 대응)
  const inputEl = findInputEl();
  if (inputEl) {
    let container = inputEl.parentElement;
    for (let up = 0; up < 10 && container; up++) {
      const btns = Array.from(container.querySelectorAll('button:not([disabled]),[role="button"]'))
        .filter(b => isActive(b) && !denies(b));
      if (btns.length) {
        console.log(`[VeoAuto] 입력창 근처 버튼 발견 (${up}단계 상위): "${(btns[btns.length-1].innerText||'').trim()}" aria="${btns[btns.length-1].getAttribute('aria-label')||''}"`);
        return btns[btns.length - 1]; // 마지막 = 보통 submit/send
      }
      container = container.parentElement;
    }
  }

  console.warn('[VeoAuto] 생성 버튼 없음. 전체 버튼 수:', document.querySelectorAll('button').length);
  return null;
}

// ─────────────────────────────────────────────
// URL 유효성 필터
// ─────────────────────────────────────────────
const PLACEHOLDER = ['flower-placeholder', 'placeholder.webp', '/pinhole/', 'data:image/svg'];

function isValidUrl(url, type, el) {
  if (!url || url === 'about:blank') return false;
  if (url.startsWith('data:') || url.startsWith('chrome-extension:')) return false;
  if (PLACEHOLDER.some(p => url.includes(p))) return false;
  if (type === 'img' && el && el.complete) {
    const w = el.naturalWidth || 0, h = el.naturalHeight || 0;
    if (w < 128 || h < 128) return false;
  }
  return true;
}

function extractBgUrl(bg) {
  const m = bg.match(/url\(["']?(.*?)["']?\)/);
  return m ? m[1] : '';
}

// ─────────────────────────────────────────────
// 기존 URL 스냅샷
// ─────────────────────────────────────────────
function snapshotUrls() {
  const urls = new Set();
  document.querySelectorAll('img[src]').forEach(el => {
    if (isValidUrl(el.src, 'img', el)) urls.add(el.src);
  });
  document.querySelectorAll('video[src]').forEach(el => {
    if (isValidUrl(el.src, 'video', el)) urls.add(el.src);
  });
  document.querySelectorAll('[style*="background-image"]').forEach(el => {
    const url = extractBgUrl(getComputedStyle(el).backgroundImage || '');
    if (isValidUrl(url, 'bg', el)) urls.add(url);
  });
  return urls;
}

// ─────────────────────────────────────────────
// 신규 URL 수집
// ─────────────────────────────────────────────
function collectNewUrls(existing) {
  const found = [];
  document.querySelectorAll('[data-tile-id],img[src],video[src],[style*="background-image"]').forEach(node => {
    if (node.tagName === 'IMG') {
      const url = node.getAttribute('src') || '';
      if (isValidUrl(url, 'img', node) && !existing.has(url)) found.push({ url, type: 'img' });
      return;
    }
    if (node.tagName === 'VIDEO') {
      const url = node.getAttribute('src') || '';
      if (isValidUrl(url, 'video', node) && !existing.has(url)) found.push({ url, type: 'video' });
      return;
    }
    const bg  = extractBgUrl(getComputedStyle(node).backgroundImage || '');
    if (isValidUrl(bg, 'bg', node) && !existing.has(bg)) found.push({ url: bg, type: 'bg' });

    const ni = node.querySelector?.('img[src]');
    if (ni) {
      const url = ni.getAttribute('src') || '';
      if (isValidUrl(url, 'img', ni) && !existing.has(url)) found.push({ url, type: 'img' });
    }
    const nv = node.querySelector?.('video[src]');
    if (nv) {
      const url = nv.getAttribute('src') || '';
      if (isValidUrl(url, 'video', nv) && !existing.has(url)) found.push({ url, type: 'video' });
    }
  });
  const dedup = new Map();
  for (const item of found) if (!dedup.has(item.url)) dedup.set(item.url, item);
  return [...dedup.values()];
}

// ─────────────────────────────────────────────
// 완료 대기 — outputCount 개수 채울 때까지 대기
// ─────────────────────────────────────────────
function waitForOutputs(outputCount, existing, timeoutMs = 300000) {
  return new Promise(resolve => {
    let done = false;
    let observer = null;
    let intervalId = null;
    let timeoutId = null;

    const finish = items => {
      if (done) return;
      done = true;
      if (observer)    observer.disconnect();
      if (intervalId)  clearInterval(intervalId);
      if (timeoutId)   clearTimeout(timeoutId);
      resolve({ ok: items.length >= outputCount, urls: items });
    };

    const check = () => {
      const items = collectNewUrls(existing);
      if (items.length >= outputCount) {
        console.log(`[VeoAuto] 완료 감지: ${items.length}개`);
        finish(items);
      }
    };

    observer = new MutationObserver(check);
    observer.observe(document.body, {
      childList: true, subtree: true,
      attributes: true, attributeFilter: ['src', 'style', 'class'],
    });
    intervalId = setInterval(check, 1000);
    timeoutId  = setTimeout(() => {
      console.warn('[VeoAuto] 타임아웃');
      finish(collectNewUrls(existing));
    }, timeoutMs);
  });
}

// ─────────────────────────────────────────────
// 생성 시작 확인 — 버튼 disabled 전환 대기
// ─────────────────────────────────────────────
async function waitForGenerationStart(btn, timeoutMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await sleep(200);
    if (!btn || btn.disabled || btn.getAttribute('aria-disabled') === 'true') {
      console.log('[VeoAuto] 생성 시작 확인 (버튼 비활성화됨)');
      return true;
    }
    // 로딩 스피너 등장 확인
    const spinner = document.querySelector('[class*="loading"],[class*="spinner"],[aria-busy="true"]');
    if (spinner) {
      console.log('[VeoAuto] 생성 시작 확인 (스피너 감지)');
      return true;
    }
  }
  console.warn('[VeoAuto] 생성 시작 확인 타임아웃 — 계속 진행');
  return false;
}

// ─────────────────────────────────────────────
// 과부하 감지
// ─────────────────────────────────────────────
function detectOverload() {
  for (const el of document.querySelectorAll('[class*="error"],[class*="alert"],[role="alert"]')) {
    const t = (el.textContent || '').toLowerCase();
    if (t.includes('overload') || t.includes('queue full') ||
        t.includes('과부하')   || t.includes('try again')  ||
        t.includes('다시 시도')) return true;
  }
  return false;
}

// ─────────────────────────────────────────────
// 다운로드
// ─────────────────────────────────────────────
async function triggerDownload(url, filename, folder) {
  if (!url || url === 'about:blank') return;

  // 1순위: blob → anchor
  if (url.startsWith('blob:')) {
    const a      = document.createElement('a');
    a.href       = url;
    a.download   = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => document.body.removeChild(a), 1000);
    return;
  }

  // 2순위: Side Panel 경유
  try {
    const res = await chrome.runtime.sendMessage({ type: 'DOWNLOAD_VIA_PANEL', url, filename });
    if (res && res.ok) return;
  } catch (_) { /* fallback */ }

  // 3순위: SW chrome.downloads
  chrome.runtime.sendMessage({ type: 'DOWNLOAD_FILE', url, filename, folder });
}

// ─────────────────────────────────────────────
// 프롬프트 1개 실행
// ─────────────────────────────────────────────
async function runOnePrompt(payload, index, total) {
  const {
    prompt, outputCount = 1, folderName = 'veo-folder-1',
    promptIndex = index + 1, maxRetries = 5,
    downloadVideoQuality = '720p', downloadImageQuality = '1k',
    autoRename = true,
  } = payload;

  sendLog(`▶ [${index+1}/${total}] 프롬프트 시작: "${prompt.slice(0,50)}..."`, 'info');

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    if (stopRequested) return false;

    sendLog(`[${index+1}/${total}] 시도 ${attempt}/${maxRetries}`, 'info');

    // 1) 입력창 대기
    let inputEl = null;
    for (let w = 0; w < 10; w++) {
      inputEl = findInputEl();
      if (inputEl) break;
      sendLog(`입력창 탐색 중... (${w+1}/10) URL: ${location.href}`, 'info');
      await sleep(1000);
    }
    if (!inputEl) {
      sendLog('❌ 입력창 없음 — Flow 프로젝트 페이지인지 확인', 'error');
      setStatus('입력창 없음 — Flow 프로젝트 페이지인지 확인', 'error');
      return false;
    }
    sendLog(`✅ 입력창 발견: ${inputEl.tagName} data-slate-editor=${inputEl.getAttribute('data-slate-editor')}`, 'success');

    // 2) 다이얼로그 닫기
    const closeBtns = document.querySelectorAll('[aria-label="close"],[aria-label="닫기"]');
    if (closeBtns.length) { sendLog(`다이얼로그 닫기: ${closeBtns.length}개`, 'info'); }
    closeBtns.forEach(b => b.click());
    await sleep(200);

    // 3) 프롬프트 입력
    setStatus(`[${index+1}/${total}] 입력 중... (시도 ${attempt})`, 'running');
    sendLog(`프롬프트 입력 시작 (${prompt.length}자)`, 'info');
    await setPromptText(inputEl, prompt);

    // Slate: MAIN world OK 시 placeholder 잔존해도 Slate 내부 상태는 갱신됨 (React re-render 지연)
    // → placeholder 체크 2초간 재시도
    let typed = '';
    for (let c = 0; c < 5; c++) {
      const slateEmpty = !!inputEl.querySelector?.('[data-slate-placeholder]');
      typed = slateEmpty ? '' : (inputEl.value || inputEl.innerText || '').trim();
      if (typed) break;
      await sleep(400);
    }
    sendLog(`입력 결과: ${typed.length}자 / 목표 ${prompt.length}자 — "${typed.slice(0,40)}"`, typed.length ? 'success' : 'error');
    if (!typed) {
      sendLog('❌ 입력 실패 — 재시도', 'error');
      setStatus(`[${index+1}/${total}] 입력 실패 — 재시도`, 'error');
      await sleep(2000); continue;
    }

    // 4) MAIN world에서 생성 버튼 탐색 + 클릭 (Shadow DOM 관통)
    setStatus(`[${index+1}/${total}] 생성 요청 중...`, 'running');

    // 클릭 직전 스냅샷
    const existing       = snapshotUrls();
    sendLog(`스냅샷: 기존 URL ${existing.size}개`, 'info');
    const outputsPromise = waitForOutputs(outputCount, existing, 300000);

    try {
      const clickRes = await chrome.runtime.sendMessage({ type: 'CLICK_GENERATE' });
      sendLog(`MAIN world 버튼: ${JSON.stringify(clickRes)}`, clickRes?.ok ? 'success' : 'error');
    } catch (e) {
      sendLog(`MAIN world 버튼 실패: ${e.message} — Enter fallback`, 'error');
      inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
    }

    // 5) 과부하 체크
    await sleep(3000);
    if (detectOverload()) {
      sendLog('❌ 과부하 감지 — 30초 대기', 'error');
      setStatus(`[${index+1}/${total}] 과부하 — 30초 대기`, 'error');
      await sleep(30000); continue;
    }

    // 6) 완료 대기
    sendLog(`완료 대기 중... (목표 ${outputCount}개 URL)`, 'info');
    setStatus(`[${index+1}/${total}] 생성 대기 중... (${outputCount}개 기다리는 중)`, 'running');
    const result = await outputsPromise;

    sendLog(`대기 결과: ok=${result.ok} urls=${result.urls.length}개`, result.ok ? 'success' : 'error');
    result.urls.forEach((item, i) => sendLog(`  URL[${i}] type=${item.type} url=${item.url.slice(0,80)}`, 'info'));

    if (result.ok) {
      setStatus(`[${index+1}/${total}] 다운로드 중... (${result.urls.length}개)`, 'running');
      const ts = Date.now();
      result.urls.forEach(({ url, type }, i) => {
        const ext = type === 'video' ? 'mp4' : 'jpg';
        const q   = type === 'video' ? downloadVideoQuality : downloadImageQuality;
        if (q === 'none') { sendLog(`다운로드 스킵 (품질=none): ${url.slice(0,60)}`, 'info'); return; }
        const name = autoRename
          ? `${promptIndex}_${String(i+1).padStart(2,'0')}_${ts}.${ext}`
          : `output_${promptIndex}_${i+1}.${ext}`;
        sendLog(`💾 다운로드: ${name} (${q})`, 'download');
        triggerDownload(url, name, folderName);
      });
      await sleep(500);
      setStatus(`[${index+1}/${total}] 완료 (${result.urls.length}개 저장)`, 'done');
      sendLog(`✅ [${index+1}/${total}] 완료!`, 'success');
      return true;
    }

    sendLog(`❌ 타임아웃 — 재시도 ${attempt}/${maxRetries}`, 'error');
    setStatus(`[${index+1}/${total}] 타임아웃 — 재시도 ${attempt}/${maxRetries}`, 'error');
    await sleep(3000);
  }

  sendLog(`❌ [${index+1}/${total}] 최대 재시도 초과 — 실패`, 'error');
  return false;
}

// ─────────────────────────────────────────────
// 배치 실행
// ─────────────────────────────────────────────
async function runBatch(payloads, groupId, delayMin, delayMax) {
  batchRunning  = true;
  stopRequested = false;
  let completed = 0;
  const total   = payloads.length;
  setStatus(`배치 시작: ${total}개`, 'running');

  for (let i = 0; i < total; i++) {
    if (stopRequested) { setStatus('사용자 중단', 'error'); break; }

    const ok = await runOnePrompt(payloads[i], i, total);
    if (ok) completed++;

    try {
      chrome.runtime.sendMessage({
        type: 'BATCH_PROGRESS', groupId,
        completedCount: completed,
        failedCount:    i + 1 - completed,
        totalCount:     total,
      });
    } catch (_) {}

    if (i < total - 1 && !stopRequested) {
      const sec = delayMin + Math.random() * (delayMax - delayMin);
      setStatus(`다음까지 ${Math.round(sec)}초 대기...`, 'running');
      await randDelay(delayMin, delayMax);
    }
  }

  try {
    chrome.runtime.sendMessage({ type: 'BATCH_COMPLETED', groupId, completedCount: completed, totalCount: total });
  } catch (_) {}

  batchRunning = false;
  setStatus(`전체 완료 ${completed}/${total}`, 'done');
}

// ─────────────────────────────────────────────
// 메시지 수신
// ─────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'PING') {
    sendResponse({ ok: true, version: '2.6.8', url: location.href });
    return true;
  }
  if (msg.type === 'START_BATCH') {
    if (batchRunning) { sendResponse({ ok: false, error: '이미 실행 중' }); return true; }
    const groupId  = msg.groupId  || `batch-${Date.now()}`;
    const delayMin = msg.promptDelaySecondsMin ?? 20;
    const delayMax = msg.promptDelaySecondsMax ?? 30;
    sendResponse({ ok: true, groupId });
    runBatch(msg.payloads || [], groupId, delayMin, delayMax);
    return true;
  }
  if (msg.type === 'STOP_BATCH') {
    stopRequested = true;
    sendResponse({ ok: true });
    return true;
  }
  if (msg.type === 'INSPECT_DOM') {
    const inputEl = findInputEl();
    const genBtn  = findGenerateButton();
    sendResponse({
      slateEditor:       !!inputEl,
      slateText:         inputEl ? (inputEl.innerText || '').substring(0, 200) : null,
      generateButton:    !!genBtn,
      generateButtonText: genBtn ? (genBtn.innerText || '').substring(0, 50) : null,
      batchRunning,
      url:       location.href,
      tileCount: document.querySelectorAll('[data-tile-id]').length,
    });
    return true;
  }
  return false;
});

console.log('[VeoAuto] Content script v2.6.8 loaded:', location.href);

} // end init()
