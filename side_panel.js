// side_panel.js — VEO Automation v2.7.0

// ─────────────────────────────────────────────
// Flow 탭 감지 + 오버레이
// ─────────────────────────────────────────────
function checkFlowTab() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const url = (tabs[0] && tabs[0].url) || '';
    const isFlowProject = /labs\.google\/fx\/.*\/tools\/flow\/?/.test(url);
    const overlay = document.getElementById('no-flow-overlay');
    overlay.classList.toggle('visible', !isFlowProject);
  });
}
checkFlowTab();
setInterval(checkFlowTab, 3000);
chrome.tabs.onActivated.addListener(checkFlowTab);
chrome.tabs.onUpdated.addListener((id, info) => { if (info.status === 'complete') checkFlowTab(); });

document.getElementById('btn-goto-flow').addEventListener('click', async () => {
  // 이미 열려있는 Flow 탭이 있으면 그쪽으로 전환, 없으면 새 탭 생성
  const tabs = await chrome.tabs.query({ url: 'https://labs.google/*' });
  if (tabs.length > 0) {
    chrome.tabs.update(tabs[0].id, { active: true });
    chrome.windows.update(tabs[0].windowId, { focused: true });
  } else {
    chrome.tabs.create({ url: 'https://labs.google/fx/tools/flow' });
  }
});

// ─────────────────────────────────────────────
// 탭 전환
// ─────────────────────────────────────────────
const tabBtns   = document.querySelectorAll('.tab-btn');
const tabPanels = document.querySelectorAll('.tab-panel');
const actionBar = document.getElementById('action-bar');

tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    tabBtns.forEach(b => b.classList.remove('active'));
    tabPanels.forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    const panel = document.getElementById(`tab-${btn.dataset.tab}`);
    if (panel) panel.classList.add('active');
    // 액션바: 제어 탭일 때만 표시
    actionBar.style.display = btn.dataset.tab === 'control' ? 'flex' : 'none';
  });
});

// ─────────────────────────────────────────────
// 모드 버튼
// ─────────────────────────────────────────────
let currentMode = 't2i';

// ─── 캐릭터 이미지 저장 (i2i 모드) ───
const characterImages = []; // { name, dataUrl, file }

document.querySelectorAll('.mode-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.mode-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentMode = btn.dataset.mode;
    // i2i 모드일 때만 이미지 업로드 섹션 표시
    const i2iSection = document.getElementById('i2i-section');
    if (i2iSection) i2iSection.style.display = (currentMode === 'i2i' || currentMode === 'i2v') ? 'block' : 'none';
    updateQueue(parsePrompts(document.getElementById('prompt-input').value));
  });
});

// ─── 캐릭터 프리셋 ───
const CHARACTER_PRESETS = {
  '경제한방': {
    images: [
      'characters/경제한방/경제한방_face.png',
      'characters/경제한방/경제한방_body.png',
      'characters/경제한방/경제한방_sheet.png',
    ],
    style: 'The "경제한방" mascot character: round white head, single tuft of hair on top, round glasses, black bow tie, white oval body with black outline, black stick limbs, slightly chubby belly. Cinematic 16:9 2D cartoon animation with thick clean black outlines and bold saturated colors. Dramatic mood lighting with strong atmosphere — deep shadows, glowing neon highlights, volumetric light rays. Detailed Korean urban/city backgrounds (Seoul skyline, streets, buildings). Bold Korean text overlays as 3D or glowing signage. Premium editorial YouTube thumbnail energy. High visual contrast, painterly background detail, expressive character poses.',
  },
  '한국경제': {
    images: [
      'characters/한국경제/한국경제_face.png',
      'characters/한국경제/한국경제_body.png',
      'characters/한국경제/한국경제_sheet.png',
    ],
    style: 'The "한국경제" character: young Korean male in dark navy suit with navy tie, rectangular black glasses, neat short black hair parted to the side, clean-shaven. 3D Pixar-style cartoon rendering with slightly exaggerated proportions (large head ratio). Cinematic 16:9 composition with dramatic lighting, Seoul cityscape backgrounds with Namsan Tower, bold 3D Korean text overlays, financial/economic data visualization elements (charts, arrows, coins, globes). Premium YouTube thumbnail energy with deep navy and warm golden tones. High contrast editorial news style.',
  },
};

let activePreset = null;

document.querySelectorAll('.preset-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    const charName = btn.dataset.char;
    const preset = CHARACTER_PRESETS[charName];
    if (!preset) return;

    // 토글: 이미 선택된 걸 다시 누르면 해제
    if (activePreset === charName) {
      activePreset = null;
      btn.classList.remove('active');
      document.getElementById('preset-active-bar').style.display = 'none';
      document.getElementById('preset-style-row').style.display = 'none';
      characterImages.length = 0;
      renderImagePreviews();
      addLog(`캐릭터 해제: ${charName}`, 'info');
      return;
    }

    // 활성화 + 자동 i2i 모드 전환
    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activePreset = charName;
    currentMode = 'i2i';
    document.querySelectorAll('.mode-tab').forEach(b => b.classList.remove('active'));
    const i2iCard = document.querySelector('.mode-tab[data-mode="i2i"]');
    if (i2iCard) i2iCard.classList.add('active');

    // 프리셋 이미지를 characterImages에 로드
    characterImages.length = 0;
    for (const imgPath of preset.images) {
      try {
        const url = chrome.runtime.getURL(imgPath);
        const resp = await fetch(url);
        const blob = await resp.blob();
        const reader = new FileReader();
        const dataUrl = await new Promise((resolve) => {
          reader.onload = (e) => resolve(e.target.result);
          reader.readAsDataURL(blob);
        });
        const fileName = imgPath.split('/').pop();
        characterImages.push({ name: fileName.replace(/\.[^.]+$/, ''), dataUrl, fileName });
      } catch (e) {
        addLog(`프리셋 이미지 로드 실패: ${imgPath} — ${e.message}`, 'error');
      }
    }
    renderImagePreviews();

    // 화풍 토글 + 상태바 표시
    document.getElementById('preset-style-row').style.display = 'flex';
    const bar = document.getElementById('preset-active-bar');
    bar.style.display = 'flex';
    document.getElementById('preset-active-name').textContent = `${charName} 활성`;
    const thumb = document.getElementById('preset-active-thumb');
    if (characterImages[0]) thumb.innerHTML = `<img src="${characterImages[0].dataUrl}" />`;

    addLog(`캐릭터 프리셋 로드: ${charName} (${characterImages.length}장)`, 'success');
  });
});

document.getElementById('btn-preset-clear')?.addEventListener('click', () => {
  activePreset = null;
  document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('preset-active-bar').style.display = 'none';
  document.getElementById('preset-style-row').style.display = 'none';
  characterImages.length = 0;
  renderImagePreviews();
  addLog('캐릭터 프리셋 해제', 'info');
});

// ─── 이미지 업로드 핸들링 ───
document.getElementById('btn-upload-images')?.addEventListener('click', () => {
  document.getElementById('image-input').click();
});

document.getElementById('image-input')?.addEventListener('change', (e) => {
  const files = Array.from(e.target.files);
  if (!files.length) return;
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const name = file.name.replace(/\.[^.]+$/, ''); // 확장자 제거
      characterImages.push({ name, dataUrl: ev.target.result, fileName: file.name });
      renderImagePreviews();
      addLog(`캐릭터 이미지 추가: ${file.name}`, 'success');
    };
    reader.readAsDataURL(file);
  });
  e.target.value = '';
});

function renderImagePreviews() {
  const container = document.getElementById('image-preview-list');
  const refCount = document.getElementById('ref-count');
  const refActiveBar = document.getElementById('ref-active-bar');
  if (!container) return;
  container.innerHTML = characterImages.map((img, i) =>
    `<div class="ref-img-item" data-index="${i}">
      <img src="${img.dataUrl}" alt="${img.name}" />
      <button class="ref-img-remove" data-index="${i}" title="제거">&times;</button>
    </div>`
  ).join('');
  if (refCount) refCount.textContent = `(${characterImages.length} saved)`;
  // 활성 참조 상태바 업데이트
  if (refActiveBar) {
    if (characterImages.length) {
      refActiveBar.style.display = 'flex';
      const countEl = document.getElementById('ref-active-count');
      if (countEl) countEl.textContent = `${characterImages.length} 참조 활성`;
      const thumbEl = document.getElementById('ref-active-thumb');
      if (thumbEl && characterImages[0]) thumbEl.innerHTML = `<img src="${characterImages[0].dataUrl}" />`;
    } else {
      refActiveBar.style.display = 'none';
    }
  }
  // 제거 버튼 이벤트
  container.querySelectorAll('.ref-img-remove').forEach(btn => {
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const idx = parseInt(btn.dataset.index);
      characterImages.splice(idx, 1);
      renderImagePreviews();
    });
  });
}

// ─── 참조 라이브러리 버튼 핸들러 ───
document.getElementById('btn-ref-clear-all')?.addEventListener('click', () => {
  characterImages.length = 0;
  renderImagePreviews();
  addLog('참조 라이브러리 전체 삭제', 'info');
});
document.getElementById('btn-ref-remove')?.addEventListener('click', () => {
  characterImages.length = 0;
  renderImagePreviews();
});
document.getElementById('btn-ref-select-all')?.addEventListener('click', () => {
  document.querySelectorAll('.ref-img-item').forEach(el => el.classList.add('selected'));
});
document.getElementById('btn-ref-deselect-all')?.addEventListener('click', () => {
  document.querySelectorAll('.ref-img-item').forEach(el => el.classList.remove('selected'));
});
document.getElementById('btn-ref-delete-selected')?.addEventListener('click', () => {
  const selectedIndices = [];
  document.querySelectorAll('.ref-img-item.selected').forEach(el => {
    selectedIndices.push(parseInt(el.dataset.index));
  });
  if (!selectedIndices.length) return;
  for (let i = selectedIndices.length - 1; i >= 0; i--) {
    characterImages.splice(selectedIndices[i], 1);
  }
  renderImagePreviews();
  addLog(`${selectedIndices.length}개 참조 이미지 삭제`, 'info');
});

// ─── 자동 캐릭터 매칭 ───
function matchCharacterImages(promptText) {
  if (!characterImages.length) return [];
  const maxImages = 1;

  const matched = [];
  const promptLower = promptText.toLowerCase();

  for (const img of characterImages) {
    // 파일명(확장자 제외)이 프롬프트에 포함되면 매칭
    if (promptLower.includes(img.name.toLowerCase())) {
      matched.push(img);
      if (matched.length >= maxImages) break;
    }
  }

  // 매칭된 것이 없으면 첫 번째 이미지를 기본으로 사용
  if (!matched.length && characterImages.length) {
    matched.push(characterImages[0]);
  }

  return matched.slice(0, maxImages);
}

// ─────────────────────────────────────────────
// .txt 업로드
// ─────────────────────────────────────────────
document.getElementById('btn-upload-txt').addEventListener('click', () => {
  document.getElementById('txt-input').click();
});
document.getElementById('txt-input').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    document.getElementById('prompt-input').value = ev.target.result;
    updateQueue(parsePrompts(ev.target.result));
  };
  reader.readAsText(file);
  e.target.value = '';
});

// ─────────────────────────────────────────────
// 프롬프트 파싱
// ─────────────────────────────────────────────
function parsePrompts(raw) {
  // 파이프 포맷 우선: 줄 시작이 "캐릭터명|" 또는 "|"이면 새 프롬프트로 분리
  // 빈 줄 없어도 파이프 기준으로 자동 분리
  const lines = raw.split('\n');
  const results = [];
  let current = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      // 빈 줄 = 프롬프트 구분 (기존 방식도 지원)
      if (current) { results.push(current); current = null; }
      continue;
    }

    const pipeIdx = trimmed.indexOf('|');
    // 파이프가 있고, 파이프 앞이 캐릭터명(짧은 텍스트)이거나 비어있으면 새 프롬프트
    if (pipeIdx >= 0 && pipeIdx <= 20) {
      if (current) results.push(current);
      const charName = trimmed.slice(0, pipeIdx).trim();
      const prompt = trimmed.slice(pipeIdx + 1).trim();
      current = { charName, prompt };
    } else if (!current) {
      // 파이프 없고 현재 프롬프트 없으면 새 프롬프트 시작
      current = { charName: '', prompt: trimmed };
    } else {
      // 현재 프롬프트에 줄 이어붙이기
      current.prompt += ' ' + trimmed;
    }
  }
  if (current) results.push(current);

  return results.filter(item => item.prompt.length > 0);
}

// ─────────────────────────────────────────────
// 대기열 UI — 캐릭터 참조 매핑
// ─────────────────────────────────────────────
let promptRefMap = []; // { prompt, hasRef: boolean } — 프롬프트별 참조 매핑 상태

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function updateQueue(prompts) {
  const countEl = document.getElementById('queue-count');
  const listEl  = document.getElementById('queue-list');
  const section = document.getElementById('queue-section');

  // 프롬프트별 참조 매핑 갱신 (파이프 포맷 기반)
  promptRefMap = prompts.map(item => {
    const hasRef = item.charName.length > 0;
    return { charName: item.charName, prompt: item.prompt, hasRef };
  });

  const refCount = promptRefMap.filter(r => r.hasRef).length;
  countEl.textContent = `${prompts.length}개 프롬프트 · ${refCount}개 참조 매핑`;
  if (section) section.style.display = prompts.length ? '' : 'none';
  if (!prompts.length) { listEl.innerHTML = ''; promptRefMap = []; return; }

  listEl.innerHTML = promptRefMap.map((item, i) =>
    `<div class="queue-item">
      <input type="checkbox" class="q-ref-check" data-index="${i}" ${item.hasRef ? 'checked' : ''} />
      <span class="q-num">${i + 1}</span>
      <span class="q-text">${esc(item.prompt.slice(0, 55))}${item.prompt.length > 55 ? '...' : ''}</span>
      <span class="q-badge ${item.hasRef ? 'q-mapped' : 'q-unmapped'}">${item.hasRef ? item.charName : '미매핑'}</span>
    </div>`
  ).join('');

  // 체크박스 이벤트
  listEl.querySelectorAll('.q-ref-check').forEach(cb => {
    cb.addEventListener('change', (e) => {
      const idx = parseInt(e.target.dataset.index);
      promptRefMap[idx].hasRef = e.target.checked;
      const badge = e.target.closest('.queue-item').querySelector('.q-badge');
      badge.className = 'q-badge ' + (e.target.checked ? 'q-mapped' : 'q-unmapped');
      badge.textContent = e.target.checked ? '매핑' : '미매핑';
      const rc = promptRefMap.filter(r => r.hasRef).length;
      countEl.textContent = `${promptRefMap.length}개 프롬프트 · ${rc}개 참조 매핑`;
    });
  });
}

function refreshQueue() {
  const raw = document.getElementById('prompt-input').value;
  updateQueue(parsePrompts(raw));
}
document.getElementById('prompt-input').addEventListener('input', refreshQueue);
document.getElementById('prompt-input').addEventListener('paste', () => setTimeout(refreshQueue, 100));
document.getElementById('prompt-input').addEventListener('change', refreshQueue);

// 벌크 모드 토글 — 파싱 방식 전환 시 대기열 갱신
document.getElementById('toggle-bulk-mode')?.addEventListener('change', refreshQueue);

// ─────────────────────────────────────────────
// 상태 + 진행바
// ─────────────────────────────────────────────
function setStatus(text, type = 'info') {
  const el = document.getElementById('status-msg');
  el.textContent = text;
  el.className = `status-${type}`;
}

function setProgress(completed, total) {
  const bar       = document.getElementById('progress-fill');
  const label     = document.getElementById('progress-label');
  const container = document.getElementById('progress-bar');
  if (!total) { container.style.display = 'none'; return; }
  container.style.display = 'block';
  const pct = Math.round((completed / total) * 100);
  bar.style.width    = `${pct}%`;
  label.textContent  = `${completed} / ${total} (${pct}%)`;
}

function hideProgress() {
  document.getElementById('progress-bar').style.display = 'none';
}

// ─────────────────────────────────────────────
// 배치 상태
// ─────────────────────────────────────────────
let currentGroupId = null;
let pollInterval   = null;

function resetRunUI() {
  const runBtn  = document.getElementById('btn-run');
  const stopBtn = document.getElementById('btn-stop');
  runBtn.disabled     = false;
  runBtn.textContent  = '';
  runBtn.innerHTML    = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg> 대기열 시작';
  runBtn.style.display  = '';
  stopBtn.style.display = 'none';
  hideProgress();
  currentGroupId = null;
  if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
}

function showRunningUI() {
  const runBtn  = document.getElementById('btn-run');
  const stopBtn = document.getElementById('btn-stop');
  runBtn.disabled      = true;
  runBtn.style.display = 'none';
  stopBtn.style.display = '';
}

// ─────────────────────────────────────────────
// Run 버튼
// ─────────────────────────────────────────────
document.getElementById('btn-run').addEventListener('click', async () => {
  const raw = document.getElementById('prompt-input').value.trim();
  if (!raw) { setStatus('프롬프트를 입력하세요', 'error'); return; }
  // promptRefMap 최신화
  refreshQueue();
  if (!promptRefMap.length) { setStatus('유효한 프롬프트 없음', 'error'); return; }

  const outputCount = parseInt(document.getElementById('output-count').value) || 1;
  const folderName  = document.getElementById('folder-name').value.trim() || 'veo-folder-1';
  const delayMin    = parseInt(document.getElementById('delay-min').value) || 5;
  const delayMax    = parseInt(document.getElementById('delay-max').value) || 10;
  const maxRetries  = parseInt(document.getElementById('s-retries').value) || 5;
  const dlVideo     = document.getElementById('s-dl-video').value || '720p';
  const dlImage     = document.getElementById('s-dl-image').value || '1k';
  const autoRename  = document.getElementById('toggle-autoname').checked;

  const payloads = promptRefMap.map((item, i) => {
    let finalPrompt = item.prompt;
    // 화풍 토글 ON이면 프리셋 style 삽입
    const styleOn = document.getElementById('toggle-preset-style')?.checked;
    const presetName = item.charName || activePreset;
    if (styleOn && presetName && CHARACTER_PRESETS[presetName]?.style) {
      finalPrompt = CHARACTER_PRESETS[presetName].style + '\n' + finalPrompt;
    }
    const payload = {
      prompt: finalPrompt,
      mode: currentMode,
      outputCount,
      folderName,
      promptIndex: i + 1,
      maxRetries,
      downloadVideoQuality: dlVideo,
      downloadImageQuality: dlImage,
      autoRename,
    };
    // 캐릭터 참조 — 파이프 매핑된 프롬프트에만 이미지 첨부 (미매핑 = 스킵)
    const shouldAttachRef = item.hasRef;
    if (shouldAttachRef && characterImages.length) {
      payload.characterImages = characterImages.map(m => ({ name: m.name, dataUrl: m.dataUrl, fileName: m.fileName }));
    }
    // 갤러리 영상 변환: _galleryAnimateImages가 있으면 각 페이로드에 이미지 첨부
    if (currentMode === 'i2v' && window._galleryAnimateImages && window._galleryAnimateImages.length) {
      const gImg = window._galleryAnimateImages[i] || window._galleryAnimateImages[0];
      payload.galleryImage = { url: gImg.url, name: gImg.name };
    }
    return payload;
  });

  const groupId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  currentGroupId = groupId;

  showRunningUI();
  setStatus(`배치 전송 중... (${promptRefMap.length}개)`, 'info');
  setProgress(0, promptRefMap.length);
  const refCnt = promptRefMap.filter(r => r.hasRef).length;
  addLog(`배치 시작: ${promptRefMap.length}개 프롬프트 (${refCnt}개 캐릭터 매핑) | 모드: ${currentMode} | 폴더: ${folderName}`, 'info');

  // 갤러리 영상 변환 이미지 사용 후 초기화
  window._galleryAnimateImages = null;

  chrome.runtime.sendMessage({
    type: 'MANUAL_RUN',
    payloads,
    groupId,
    promptDelaySecondsMin: delayMin,
    promptDelaySecondsMax: delayMax,
  }, (res) => {
    if (chrome.runtime.lastError || !res) {
      setStatus('오류: SW 응답 없음', 'error');
      addLog('SW 응답 없음 — 확장을 다시 로드하세요', 'error');
      resetRunUI(); return;
    }
    if (res.error) {
      setStatus(`오류: ${res.error}`, 'error');
      addLog(`오류: ${res.error}`, 'error');
      resetRunUI(); return;
    }
    currentGroupId = res.groupId;
    setStatus(`실행 중... (${promptRefMap.length}개)`, 'info');
    startPolling(res.groupId);
  });
});

// ─────────────────────────────────────────────
// Stop 버튼
// ─────────────────────────────────────────────
document.getElementById('btn-stop').addEventListener('click', () => {
  if (!currentGroupId) return;
  setStatus('중지 요청 중...', 'info');
  chrome.runtime.sendMessage({ type: 'STOP_BATCH', groupId: currentGroupId }, (res) => {
    setStatus(res && res.ok ? '배치 중지됨' : '중지 실패', res && res.ok ? 'error' : 'error');
    resetRunUI();
  });
});

// ─────────────────────────────────────────────
// 진행 폴링
// ─────────────────────────────────────────────
function startPolling(groupId) {
  if (pollInterval) clearInterval(pollInterval);
  pollInterval = setInterval(() => {
    if (!currentGroupId || currentGroupId !== groupId) {
      clearInterval(pollInterval); pollInterval = null; return;
    }
    chrome.runtime.sendMessage({ type: 'GET_STATUS', groupId }, (res) => {
      if (chrome.runtime.lastError || !res) return;
      const completed = res.completedCount || 0;
      const failed    = res.failedCount    || 0;
      const total     = res.totalCount     || 0;
      setProgress(completed, total);

      if (res.status === 'completed') {
        clearInterval(pollInterval); pollInterval = null;
        const failMsg = failed > 0 ? ` (실패: ${failed})` : '';
        setStatus(`완료 ${completed}/${total}${failMsg}`, 'success');
        addLog(`✓ 배치 완료: ${completed}/${total}${failMsg}`, 'success');
        resetRunUI(); setProgress(completed, total);
        document.getElementById('progress-bar').style.display = 'block';
      } else if (res.status === 'stopped') {
        clearInterval(pollInterval); pollInterval = null;
        setStatus(`중지됨 — ${completed}/${total}`, 'error');
        addLog(`중지됨: ${completed}/${total}`, 'error');
        resetRunUI();
      } else if (res.status === 'failed') {
        clearInterval(pollInterval); pollInterval = null;
        setStatus('실패 — 탭이 닫혔거나 오류 발생', 'error');
        addLog('실패: 탭이 닫혔거나 오류 발생', 'error');
        resetRunUI();
      } else {
        const failMsg = failed > 0 ? ` | 실패: ${failed}` : '';
        setStatus(`진행 중: ${completed}/${total}${failMsg}`, 'info');
      }
    });
  }, 1500);
}

// ─────────────────────────────────────────────
// 지우기 버튼
// ─────────────────────────────────────────────
document.getElementById('btn-clear').addEventListener('click', () => {
  document.getElementById('prompt-input').value = '';
  updateQueue([]);
  setStatus('', 'info');
  hideProgress();
});

// ─────────────────────────────────────────────
// 버그 신고
// ─────────────────────────────────────────────
document.getElementById('btn-report')?.addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://github.com/' });
});

// ─────────────────────────────────────────────
// 설정 저장/로드/리셋
// ─────────────────────────────────────────────
const SETTINGS_KEY = 'veoAutoSettings_v1';

const DEFAULT_SETTINGS = {
  defaultMode:   't2i',
  videoModel:    'veo_31_fast',
  imageModel:    'nano_banana_2',
  aspect:        '16:9',
  videoDuration: '8s',
  imageMode:     'new',
  retries:       5,
  dlVideo:       '720p',
  dlImage:       '1k',
  lang:          'ko',
};

function applySettings(s) {
  document.getElementById('s-default-mode').value    = s.defaultMode   ?? DEFAULT_SETTINGS.defaultMode;
  document.getElementById('s-video-model').value     = s.videoModel    ?? DEFAULT_SETTINGS.videoModel;
  document.getElementById('s-image-model').value     = s.imageModel    ?? DEFAULT_SETTINGS.imageModel;
  document.getElementById('s-aspect').value          = s.aspect        ?? DEFAULT_SETTINGS.aspect;
  document.getElementById('s-video-duration').value  = s.videoDuration ?? DEFAULT_SETTINGS.videoDuration;
  document.getElementById('s-image-mode').value      = s.imageMode     ?? DEFAULT_SETTINGS.imageMode;
  document.getElementById('s-retries').value         = s.retries       ?? DEFAULT_SETTINGS.retries;
  document.getElementById('s-dl-video').value        = s.dlVideo       ?? DEFAULT_SETTINGS.dlVideo;
  document.getElementById('s-dl-image').value        = s.dlImage       ?? DEFAULT_SETTINGS.dlImage;
  document.getElementById('s-lang').value            = s.lang          ?? DEFAULT_SETTINGS.lang;
  document.getElementById('lang-select').value       = s.lang          ?? DEFAULT_SETTINGS.lang;
}

function collectSettings() {
  return {
    defaultMode:   document.getElementById('s-default-mode').value,
    videoModel:    document.getElementById('s-video-model').value,
    imageModel:    document.getElementById('s-image-model').value,
    aspect:        document.getElementById('s-aspect').value,
    videoDuration: document.getElementById('s-video-duration').value,
    imageMode:     document.getElementById('s-image-mode').value,
    retries:       parseInt(document.getElementById('s-retries').value) || 5,
    dlVideo:       document.getElementById('s-dl-video').value,
    dlImage:       document.getElementById('s-dl-image').value,
    lang:          document.getElementById('s-lang').value,
  };
}

function loadSettings() {
  chrome.storage.local.get(SETTINGS_KEY, (result) => {
    applySettings(result[SETTINGS_KEY] || DEFAULT_SETTINGS);
  });
}

document.getElementById('btn-save-settings').addEventListener('click', () => {
  const s = collectSettings();
  chrome.storage.local.set({ [SETTINGS_KEY]: s }, () => {
    setStatus('설정이 저장되었습니다.', 'success');
    addLog('설정 저장됨', 'success');
  });
});

document.getElementById('btn-reset-settings').addEventListener('click', () => {
  applySettings(DEFAULT_SETTINGS);
  chrome.storage.local.set({ [SETTINGS_KEY]: DEFAULT_SETTINGS }, () => {
    setStatus('기본값으로 초기화되었습니다.', 'info');
  });
});

// 언어 드롭다운 동기화
document.getElementById('lang-select').addEventListener('change', (e) => {
  document.getElementById('s-lang').value = e.target.value;
});
document.getElementById('s-lang').addEventListener('change', (e) => {
  document.getElementById('lang-select').value = e.target.value;
});

loadSettings();

// ─────────────────────────────────────────────
// 스텝퍼 (재시도 횟수)
// ─────────────────────────────────────────────
document.getElementById('retries-minus').addEventListener('click', () => {
  const el  = document.getElementById('s-retries');
  const val = parseInt(el.value) || 5;
  if (val > 1) el.value = val - 1;
});
document.getElementById('retries-plus').addEventListener('click', () => {
  const el  = document.getElementById('s-retries');
  const val = parseInt(el.value) || 5;
  if (val < 20) el.value = val + 1;
});

// ─────────────────────────────────────────────
// 디버그 로그
// ─────────────────────────────────────────────
let logCount = 0;

function addLog(text, type = 'info') {
  const container = document.getElementById('debug-log');
  if (!container) return;
  const empty = container.querySelector('.debug-empty');
  if (empty) empty.remove();

  logCount++;
  document.getElementById('debug-count').textContent = `${logCount}개 항목`;

  const now  = new Date();
  const time = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;

  const entry = document.createElement('div');
  entry.className = 'log-entry';
  entry.innerHTML = `<span class="log-time">${time}</span><span class="log-${type}">${text}</span>`;
  container.appendChild(entry);

  if (document.getElementById('debug-autoscroll').checked) {
    container.scrollTop = container.scrollHeight;
  }
}

document.getElementById('btn-debug-clear').addEventListener('click', () => {
  const container = document.getElementById('debug-log');
  container.innerHTML = '<div class="debug-empty">아직 로그가 없습니다.<br>자동화를 시작하면 여기서 활동을 확인할 수 있습니다.</div>';
  logCount = 0;
  lastLogCount = 0;
  document.getElementById('debug-count').textContent = '0개 항목';
  chrome.storage.local.remove('veoLogs');
});

document.getElementById('btn-debug-copy').addEventListener('click', () => {
  const entries = document.querySelectorAll('#debug-log .log-entry');
  const text    = Array.from(entries).map(e => e.textContent).join('\n');
  navigator.clipboard.writeText(text).then(() => {
    setStatus('로그가 클립보드에 복사되었습니다.', 'success');
  });
});

// ─────────────────────────────────────────────
// 실시간 로그 — storage.onChanged 감지
// ─────────────────────────────────────────────
let lastLogCount = 0;

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes.veoLogs) return;
  const logs = changes.veoLogs.newValue || [];
  const newLogs = logs.slice(lastLogCount);
  lastLogCount = logs.length;
  newLogs.forEach(entry => addLog(entry.text, entry.logType || 'info'));
  // 디버그 탭에 미확인 항목 있으면 탭 강조
  const debugTab = document.querySelector('.tab-btn[data-tab="debug"]');
  if (debugTab && !debugTab.classList.contains('active')) {
    debugTab.style.color = '#f59e0b';
  }
});

// 패널 열릴 때 기존 로그 로드
chrome.storage.local.get('veoLogs', (r) => {
  const logs = r.veoLogs || [];
  lastLogCount = logs.length;
  logs.forEach(entry => addLog(entry.text, entry.logType || 'info'));
});

// 디버그 탭 클릭 시 강조 해제
document.querySelector('.tab-btn[data-tab="debug"]')?.addEventListener('click', () => {
  const debugTab = document.querySelector('.tab-btn[data-tab="debug"]');
  if (debugTab) debugTab.style.color = '';
});

// ─────────────────────────────────────────────
// 저장 폴더 직접 선택 (File System Access API)
// ─────────────────────────────────────────────
let dirHandle = null;

document.getElementById('btn-pick-folder').addEventListener('click', async () => {
  try {
    dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
    document.getElementById('folder-name').value = dirHandle.name;
    const hintEl = document.getElementById('folder-hint');
    if (hintEl) hintEl.textContent = `직접 지정: ${dirHandle.name}`;
    addLog(`저장 폴더 선택됨: ${dirHandle.name}`, 'success');
  } catch (e) {
    if (e.name !== 'AbortError') {
      addLog(`폴더 선택 실패: ${e.message}`, 'error');
    }
  }
});

// ═════════════════════════════════════════════
// 갤러리 탭
// ═════════════════════════════════════════════
const galleryGrid       = document.getElementById('gallery-grid');
const galleryCount      = document.getElementById('gallery-count');
const gallerySelCount   = document.getElementById('gallery-selected-count');
const galleryImportInput= document.getElementById('gallery-import-input');

let galleryItems = []; // { id, url, blob, name, type:'img'|'vid', selected, timestamp }

function renderGallery() {
  const sortVal = document.getElementById('gallery-sort').value;
  let sorted = [...galleryItems];
  if (sortVal === 'newest')  sorted.sort((a,b) => b.timestamp - a.timestamp);
  if (sortVal === 'oldest')  sorted.sort((a,b) => a.timestamp - b.timestamp);
  if (sortVal === 'name')    sorted.sort((a,b) => a.name.localeCompare(b.name));

  galleryCount.textContent = `${galleryItems.length}개 이미지`;
  updateGallerySelCount();

  if (sorted.length === 0) {
    galleryGrid.innerHTML = `<div class="gallery-empty">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#555" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
      <p>이미지가 없습니다.<br>"전체 스캔" 또는 "이미지 가져오기"로 시작하세요.</p>
    </div>`;
    return;
  }

  galleryGrid.innerHTML = '';
  sorted.forEach(item => {
    const div = document.createElement('div');
    div.className = 'gallery-item' + (item.selected ? ' selected' : '');
    div.dataset.id = item.id;

    const isVid = item.type === 'vid';
    const media = isVid ? document.createElement('video') : document.createElement('img');
    media.src = item.url;
    if (isVid) { media.muted = true; media.loop = true; }
    div.appendChild(media);

    const badge = document.createElement('span');
    badge.className = 'gallery-type-badge ' + (isVid ? 'vid' : 'img');
    badge.textContent = isVid ? 'VID' : 'IMG';
    div.appendChild(badge);

    const label = document.createElement('div');
    label.className = 'gallery-label';
    label.textContent = item.name;
    div.appendChild(label);

    div.addEventListener('click', () => {
      item.selected = !item.selected;
      div.classList.toggle('selected');
      updateGallerySelCount();
    });

    if (isVid) {
      div.addEventListener('mouseenter', () => media.play());
      div.addEventListener('mouseleave', () => { media.pause(); media.currentTime = 0; });
    }

    galleryGrid.appendChild(div);
  });
}

function updateGallerySelCount() {
  const cnt = galleryItems.filter(i => i.selected).length;
  gallerySelCount.textContent = cnt;
}

// 전체 스캔 — Flow 페이지에서 이미지/비디오 URL 수집
document.getElementById('btn-scan-all').addEventListener('click', async () => {
  addLog('🔍 갤러리: Flow 페이지 스캔 시작...', 'info');
  try {
    const galleryResolution = document.getElementById('gallery-resolution').value || '1k';
    const res = await chrome.runtime.sendMessage({ type: 'SCAN_GALLERY', resolution: galleryResolution });
    if (!res || !res.urls || res.urls.length === 0) {
      addLog('스캔 결과 없음 — Flow 프로젝트에서 이미지를 먼저 생성하세요.', 'warning');
      return;
    }
    let added = 0;
    for (const u of res.urls) {
      if (galleryItems.find(g => g.url === u.url)) continue;
      galleryItems.push({
        id: crypto.randomUUID(),
        url: u.url,
        blob: null,
        name: u.name || `scan_${galleryItems.length + 1}`,
        type: u.type || 'img',
        selected: false,
        timestamp: Date.now()
      });
      added++;
    }
    addLog(`✅ 갤러리: ${added}개 스캔 완료 (총 ${galleryItems.length}개)`, 'success');
    renderGallery();
  } catch (e) {
    addLog(`스캔 실패: ${e.message}`, 'error');
  }
});

// 이미지 가져오기
document.getElementById('btn-import-images').addEventListener('click', () => {
  galleryImportInput.click();
});
galleryImportInput.addEventListener('change', (e) => {
  const files = Array.from(e.target.files);
  if (!files.length) return;
  let added = 0;
  files.forEach(file => {
    const url = URL.createObjectURL(file);
    const isVid = file.type.startsWith('video/');
    galleryItems.push({
      id: crypto.randomUUID(),
      url,
      blob: file,
      name: file.name,
      type: isVid ? 'vid' : 'img',
      selected: false,
      timestamp: Date.now()
    });
    added++;
  });
  addLog(`📥 갤러리: ${added}개 이미지 가져옴 (총 ${galleryItems.length}개)`, 'success');
  renderGallery();
  galleryImportInput.value = '';
});

// 정렬 변경
document.getElementById('gallery-sort').addEventListener('change', renderGallery);

// 랜덤 선택
document.getElementById('btn-random-pick').addEventListener('click', () => {
  galleryItems.forEach(i => i.selected = false);
  const count = Math.min(10, galleryItems.length);
  const shuffled = [...galleryItems].sort(() => Math.random() - 0.5);
  shuffled.slice(0, count).forEach(i => i.selected = true);
  renderGallery();
});

// 매칭 선택 — 프롬프트와 이름 매칭
document.getElementById('btn-pick-matched').addEventListener('click', () => {
  const raw = document.getElementById('prompt-input').value.trim();
  if (!raw) { addLog('매칭 선택: 프롬프트를 먼저 입력하세요.', 'warning'); return; }
  const prompts = raw.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  galleryItems.forEach(item => {
    item.selected = prompts.some(p => {
      const firstWord = p.split(/[\s,]+/)[0].toLowerCase();
      return item.name.toLowerCase().includes(firstWord);
    });
  });
  const cnt = galleryItems.filter(i => i.selected).length;
  addLog(`🔗 매칭 선택: ${cnt}개 매칭됨`, 'info');
  renderGallery();
});

// 전체 선택
document.getElementById('btn-select-all').addEventListener('click', () => {
  galleryItems.forEach(i => i.selected = true);
  renderGallery();
});

// 선택 해제
document.getElementById('btn-deselect-all').addEventListener('click', () => {
  galleryItems.forEach(i => i.selected = false);
  renderGallery();
});

// 다운로드
document.getElementById('btn-gallery-download').addEventListener('click', async () => {
  const selected = galleryItems.filter(i => i.selected);
  if (!selected.length) { addLog('다운로드: 이미지를 선택하세요.', 'warning'); return; }
  addLog(`💾 갤러리: ${selected.length}개 다운로드 시작...`, 'info');
  for (const item of selected) {
    try {
      if (dirHandle) {
        const resp = await fetch(item.url);
        const blob = await resp.blob();
        const fh   = await dirHandle.getFileHandle(item.name, { create: true });
        const wr   = await fh.createWritable();
        await wr.write(blob);
        await wr.close();
      } else {
        const a = document.createElement('a');
        a.href = item.url;
        a.download = item.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (e) {
      addLog(`다운로드 실패: ${item.name} — ${e.message}`, 'error');
    }
  }
  addLog(`✅ 갤러리: ${selected.length}개 다운로드 완료`, 'success');
});

// 영상 변환 — 선택된 이미지를 i2v 배치로 전달
document.getElementById('btn-animate-images').addEventListener('click', () => {
  const selected = galleryItems.filter(i => i.selected && i.type === 'img');
  if (!selected.length) { addLog('영상 변환: 이미지를 선택하세요.', 'warning'); return; }
  // i2v 모드로 전환
  document.querySelectorAll('.mode-tab').forEach(b => b.classList.remove('active'));
  const i2vBtn = document.querySelector('.mode-tab[data-mode="i2v"]');
  if (i2vBtn) i2vBtn.classList.add('active');
  currentMode = 'i2v';
  // 선택된 이미지 URL을 프롬프트에 메타데이터로 저장
  window._galleryAnimateImages = selected.map(i => ({ url: i.url, name: i.name, blob: i.blob }));
  // 제어 탭으로 전환 + 액션바 표시
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('.tab-btn[data-tab="control"]').classList.add('active');
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('tab-control').classList.add('active');
  document.getElementById('action-bar').style.display = 'flex';
  addLog(`🎬 갤러리: ${selected.length}개 이미지를 영상 변환 대기열에 추가. 프롬프트를 입력하고 실행하세요.`, 'info');
});

// ─────────────────────────────────────────────
// Content Script → DOWNLOAD_VIA_PANEL 수신
// ─────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'DOWNLOAD_VIA_PANEL') {
    (async () => {
      try {
        const resp = await fetch(msg.url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const blob = await resp.blob();

        // dirHandle 있으면 선택 폴더에 직접 저장
        if (dirHandle) {
          try {
            const fileHandle = await dirHandle.getFileHandle(msg.filename, { create: true });
            const writable   = await fileHandle.createWritable();
            await writable.write(blob);
            await writable.close();
            addLog(`💾 저장됨: ${dirHandle.name}/${msg.filename}`, 'download');
            sendResponse({ ok: true });
            return;
          } catch (fsErr) {
            addLog(`폴더 저장 실패: ${fsErr.message} — anchor fallback`, 'error');
          }
        }

        // fallback: anchor download
        const a         = document.createElement('a');
        a.href          = URL.createObjectURL(blob);
        a.download      = msg.filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { URL.revokeObjectURL(a.href); document.body.removeChild(a); }, 1000);
        addLog(`💾 저장됨: ${msg.filename}`, 'download');
        sendResponse({ ok: true });
      } catch (e) {
        addLog(`저장 실패: ${msg.filename} — ${e.message}`, 'error');
        sendResponse({ ok: false, reason: e.message });
      }
    })();
    return true;
  }
});
