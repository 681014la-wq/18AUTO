#!/usr/bin/env node
// batch-runner/run.js — 터미널에서 18AUTO 배치 실행 (CDP 방식)
//
// 사용법:
//   1. chrome-debug.bat 실행 (또는 바탕화면 바로가기)
//   2. Flow 페이지에서 Google 로그인 (처음 1회만)
//   3. node run.js ../prompts.txt
//
// 옵션:
//   node run.js ../prompts.txt --mode i2i --folder my-folder --delay 20-30 --quality 2k

const fs = require('fs');
const http = require('http');
const path = require('path');

// ─── 설정 ───
const CDP_PORT = 9222;

// ─── 인자 파싱 ───
const args = process.argv.slice(2);
if (!args.length || args[0] === '--help') {
  console.log(`
  18AUTO 배치 실행기 (CDP)
  ========================
  사용법: node run.js <prompts.txt> [옵션]

  옵션:
    --mode <t2i|t2v|i2i|i2v|c2v>  모드 (기본: t2i)
    --folder <이름>               폴더명 (기본: veo-folder-1)
    --delay <min>-<max>           대기 초 (기본: 20-30)
    --output <수>                 프롬프트당 출력 (기본: 1)
    --quality <1k|2k|4k>          이미지 품질 (기본: 2k)

  prompts.txt 형식:
    캐릭터명|프롬프트 텍스트
    |프롬프트 (캐릭터 없음)
`);
  process.exit(0);
}

const promptFile = path.resolve(args[0]);
if (!fs.existsSync(promptFile)) {
  console.error('파일 없음:', promptFile);
  process.exit(1);
}

function getArg(flag, def) {
  const idx = args.indexOf(flag);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : def;
}
const mode = getArg('--mode', 't2i');
const folder = getArg('--folder', 'veo-folder-1');
const delayStr = getArg('--delay', '20-30');
const [delayMin, delayMax] = delayStr.split('-').map(Number);
const outputCount = parseInt(getArg('--output', '1'));
const dlImage = getArg('--quality', '2k');

// ─── 프롬프트 파싱 (side_panel.js와 동일) ───
function parsePrompts(raw) {
  const lines = raw.split('\n');
  const results = [];
  let current = null;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (current) { results.push(current); current = null; }
      continue;
    }
    const pipeIdx = trimmed.indexOf('|');
    if (pipeIdx >= 0 && pipeIdx <= 20) {
      if (current) results.push(current);
      current = { charName: trimmed.slice(0, pipeIdx).trim(), prompt: trimmed.slice(pipeIdx + 1).trim() };
    } else if (!current) {
      current = { charName: '', prompt: trimmed };
    } else {
      current.prompt += ' ' + trimmed;
    }
  }
  if (current) results.push(current);
  return results.filter(item => item.prompt.length > 0);
}

const prompts = parsePrompts(fs.readFileSync(promptFile, 'utf-8'));
if (!prompts.length) { console.error('유효한 프롬프트 없음'); process.exit(1); }

console.log(`\n프롬프트 ${prompts.length}개 로드됨`);
prompts.forEach((p, i) => {
  console.log(`  ${i + 1}. ${p.charName ? `[${p.charName}]` : '[미매핑]'} ${p.prompt.slice(0, 50)}...`);
});

// ─── CDP 유틸 ───
function httpGet(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { reject(e); } });
    }).on('error', reject);
  });
}

function wsConnect(url) {
  const WebSocket = require('ws');
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
}

let _id = 1;
function cdp(ws, method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = _id++;
    const onMsg = (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.id === id) {
        ws.removeListener('message', onMsg);
        msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
      }
    };
    ws.on('message', onMsg);
    ws.send(JSON.stringify({ id, method, params }));
    setTimeout(() => { ws.removeListener('message', onMsg); reject(new Error('CDP timeout')); }, 30000);
  });
}

// ─── 메인 ───
async function main() {
  // 1) Chrome CDP 연결
  console.log(`\nChrome(localhost:${CDP_PORT}) 연결 중...`);
  let tabs;
  try {
    tabs = await httpGet(`http://localhost:${CDP_PORT}/json`);
  } catch {
    console.error(`\nChrome 디버그 모드가 실행되지 않았습니다.\nchrome-debug.bat를 먼저 실행하세요.`);
    process.exit(1);
  }

  // 2) Flow 탭 찾기
  const flowTab = tabs.find(t => t.url?.includes('labs.google') && t.url?.includes('flow'));
  if (!flowTab) {
    console.error('Flow 탭 없음. Chrome에서 Flow 페이지를 열어주세요.');
    process.exit(1);
  }
  console.log(`Flow 탭: ${flowTab.title || flowTab.url}`);

  // 3) WebSocket 연결
  const ws = await wsConnect(flowTab.webSocketDebuggerUrl);
  console.log('CDP 연결 완료');

  // 4) Runtime 활성화 + content_script 확인
  await cdp(ws, 'Runtime.enable');

  // 5) 실행 컨텍스트 수집 — extension isolated world 찾기
  const contexts = [];
  const ctxListener = (raw) => {
    const msg = JSON.parse(raw.toString());
    if (msg.method === 'Runtime.executionContextCreated') {
      contexts.push(msg.params.context);
    }
  };
  ws.on('message', ctxListener);
  await new Promise(r => setTimeout(r, 1000)); // 컨텍스트 수집 대기

  // 18AUTO content_script의 isolated world 찾기
  let extCtxId = null;
  for (const ctx of contexts) {
    if (ctx.auxData?.type === 'isolated' && ctx.origin?.includes('labs.google')) {
      extCtxId = ctx.id;
      break;
    }
  }
  ws.removeListener('message', ctxListener);

  // 6) payload 조립
  const payloads = prompts.map((item, i) => ({
    prompt: item.prompt,
    mode,
    outputCount,
    folderName: folder,
    promptIndex: i + 1,
    maxRetries: 5,
    downloadVideoQuality: '720p',
    downloadImageQuality: dlImage,
    autoRename: true,
  }));

  const groupId = `cli-${Date.now()}`;
  const batchMsg = JSON.stringify({
    type: 'START_BATCH',
    groupId,
    payloads,
    promptDelaySecondsMin: delayMin,
    promptDelaySecondsMax: delayMax,
  });

  // 7) content_script에 START_BATCH 전달
  console.log(`\n배치 실행: ${payloads.length}개 | 모드: ${mode} | 폴더: ${folder}`);

  // 방법 1: extension isolated world에서 직접 실행
  if (extCtxId) {
    console.log(`Extension context 발견 (id: ${extCtxId})`);
    const result = await cdp(ws, 'Runtime.evaluate', {
      contextId: extCtxId,
      expression: `
        new Promise((resolve) => {
          const msg = ${batchMsg};
          chrome.runtime.sendMessage(msg, (res) => {
            resolve(JSON.stringify(res || {ok:false}));
          });
        })
      `,
      awaitPromise: true,
      returnByValue: true,
    });
    console.log('배치 전송 결과:', result?.result?.value);
  } else {
    // 방법 2: 페이지 컨텍스트에서 CustomEvent 디스패치
    console.log('Extension context 못 찾음 — CustomEvent 방식 시도');

    // content_script가 CustomEvent를 수신하도록 페이지에서 발송
    const result = await cdp(ws, 'Runtime.evaluate', {
      expression: `
        window.dispatchEvent(new CustomEvent('veo-batch-cli', {
          detail: ${batchMsg}
        }));
        'DISPATCHED'
      `,
      returnByValue: true,
    });
    console.log('이벤트 전송:', result?.result?.value);
  }

  // 8) 상태 모니터링
  console.log('\n진행 상태 모니터링 (Ctrl+C로 중단)...\n');

  const poll = setInterval(async () => {
    try {
      const evalOpts = extCtxId ? { contextId: extCtxId } : {};
      const r = await cdp(ws, 'Runtime.evaluate', {
        ...evalOpts,
        expression: `JSON.stringify({ running: typeof batchRunning !== 'undefined' ? batchRunning : 'unknown', tiles: document.querySelectorAll('[data-tile-id]').length })`,
        returnByValue: true,
      });
      const s = JSON.parse(r?.result?.value || '{}');
      const now = new Date().toLocaleTimeString('ko-KR');
      process.stdout.write(`\r  [${now}] 실행중: ${s.running} | 타일: ${s.tiles}개    `);
      if (s.running === false) {
        console.log('\n\n배치 완료!');
        clearInterval(poll);
        ws.close();
        process.exit(0);
      }
    } catch { }
  }, 5000);

  process.on('SIGINT', () => {
    console.log('\n모니터링 중단 (배치는 계속 실행됨)');
    clearInterval(poll);
    ws.close();
    process.exit(0);
  });
}

main().catch(e => { console.error('오류:', e.message); process.exit(1); });
