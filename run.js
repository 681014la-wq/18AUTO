#!/usr/bin/env node
// run.js — 터미널에서 18AUTO 배치 실행
// 사용법:
//   1. Chrome을 --remote-debugging-port=9222 로 실행
//   2. Flow 페이지 열기 (https://labs.google/fx/ko/tools/flow/...)
//   3. node run.js prompts.txt
//
// prompts.txt 형식 (파이프 포맷):
//   경제한방|A cinematic wide shot in 16:9 landscape...
//   경제한방|A dramatic medium-wide shot...
//   |A high-energy financial infographic scene...
//
// 옵션:
//   node run.js prompts.txt --mode t2i --folder my-folder --delay 20-30

const fs = require('fs');
const http = require('http');
const path = require('path');

// ─── 설정 ───
const CHROME_DEBUG_PORT = 9222;
const DEFAULT_MODE = 't2i';
const DEFAULT_FOLDER = 'veo-folder-1';
const DEFAULT_DELAY_MIN = 20;
const DEFAULT_DELAY_MAX = 30;
const DEFAULT_OUTPUT_COUNT = 1;
const DEFAULT_DL_IMAGE = '2k';

// ─── 인자 파싱 ───
const args = process.argv.slice(2);
if (!args.length || args[0] === '--help') {
  console.log(`
┌─────────────────────────────────────────┐
│  18AUTO 터미널 배치 실행기               │
└─────────────────────────────────────────┘

사용법:
  node run.js <prompts.txt> [옵션]

옵션:
  --mode <t2i|t2v|i2i|i2v|c2v>   모드 (기본: t2i)
  --folder <이름>                 저장 폴더 (기본: veo-folder-1)
  --delay <min>-<max>             대기 시간 초 (기본: 20-30)
  --output <개수>                 프롬프트당 출력 수 (기본: 1)
  --quality <1k|2k|4k>            이미지 품질 (기본: 2k)

prompts.txt 형식:
  캐릭터명|프롬프트 텍스트
  |프롬프트 (캐릭터 없음)

예시:
  node run.js prompts.txt --mode i2i --folder test-01 --delay 15-25

준비:
  1. Chrome 종료
  2. 터미널에서 실행:
     "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --remote-debugging-port=9222
  3. Flow 페이지 열기
  4. node run.js prompts.txt
`);
  process.exit(0);
}

const promptFile = args[0];
if (!fs.existsSync(promptFile)) {
  console.error(`❌ 파일 없음: ${promptFile}`);
  process.exit(1);
}

// 옵션 파싱
function getArg(flag, def) {
  const idx = args.indexOf(flag);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : def;
}
const mode = getArg('--mode', DEFAULT_MODE);
const folder = getArg('--folder', DEFAULT_FOLDER);
const delayStr = getArg('--delay', `${DEFAULT_DELAY_MIN}-${DEFAULT_DELAY_MAX}`);
const [delayMin, delayMax] = delayStr.split('-').map(Number);
const outputCount = parseInt(getArg('--output', String(DEFAULT_OUTPUT_COUNT)));
const dlImage = getArg('--quality', DEFAULT_DL_IMAGE);

// ─── 프롬프트 파일 파싱 ───
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
      const charName = trimmed.slice(0, pipeIdx).trim();
      const prompt = trimmed.slice(pipeIdx + 1).trim();
      current = { charName, prompt };
    } else if (!current) {
      current = { charName: '', prompt: trimmed };
    } else {
      current.prompt += ' ' + trimmed;
    }
  }
  if (current) results.push(current);
  return results.filter(item => item.prompt.length > 0);
}

const raw = fs.readFileSync(promptFile, 'utf-8');
const prompts = parsePrompts(raw);
if (!prompts.length) {
  console.error('❌ 유효한 프롬프트 없음');
  process.exit(1);
}

console.log(`\n📋 프롬프트 ${prompts.length}개 로드`);
prompts.forEach((p, i) => {
  const ref = p.charName ? `[${p.charName}]` : '[미매핑]';
  console.log(`  ${i + 1}. ${ref} ${p.prompt.slice(0, 60)}...`);
});

// ─── CDP 통신 ───
function httpGet(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

function connectWebSocket(wsUrl) {
  const WebSocket = require('ws');
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
}

let msgId = 1;
function cdpSend(ws, method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = msgId++;
    const handler = (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.id === id) {
        ws.removeListener('message', handler);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      }
    };
    ws.on('message', handler);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

// ─── 메인 실행 ───
async function main() {
  // 1) Chrome DevTools에 연결
  console.log(`\n🔌 Chrome(localhost:${CHROME_DEBUG_PORT})에 연결 중...`);
  let tabs;
  try {
    tabs = await httpGet(`http://localhost:${CHROME_DEBUG_PORT}/json`);
  } catch (e) {
    console.error(`\n❌ Chrome에 연결 실패!

Chrome을 디버그 모드로 실행하세요:
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --remote-debugging-port=${CHROME_DEBUG_PORT}
`);
    process.exit(1);
  }

  // 2) Flow 탭 찾기
  const flowTab = tabs.find(t => t.url && t.url.includes('labs.google') && t.url.includes('flow'));
  if (!flowTab) {
    console.error('❌ Flow 탭을 찾을 수 없습니다. Flow 페이지를 먼저 열어주세요.');
    process.exit(1);
  }
  console.log(`✅ Flow 탭 발견: ${flowTab.title}`);

  // 3) WebSocket 연결
  const ws = await connectWebSocket(flowTab.webSocketDebuggerUrl);
  console.log('✅ WebSocket 연결 완료');

  // 4) content_script가 주입되었는지 PING 확인
  console.log('🔍 18AUTO content_script 확인 중...');
  const pingResult = await cdpSend(ws, 'Runtime.evaluate', {
    expression: `
      new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'PING' }, (res) => {
          resolve(JSON.stringify(res || { ok: false }));
        });
      })
    `,
    awaitPromise: true,
    returnByValue: true,
  }).catch(() => null);

  // content_script가 이미 페이지에 주입되어 있으므로 직접 호출
  // CDP에서는 extension messaging이 안 되니 페이지 컨텍스트의 함수를 직접 실행

  // 5) payload 조립
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

  const groupId = `cli-batch-${Date.now()}`;

  // 6) START_BATCH 실행 — content_script의 메시지 리스너에 직접 전달
  console.log(`\n🚀 배치 실행: ${payloads.length}개 프롬프트`);
  console.log(`   모드: ${mode} | 폴더: ${folder} | 대기: ${delayMin}-${delayMax}초 | 품질: ${dlImage}`);
  console.log(`   그룹 ID: ${groupId}\n`);

  const batchPayload = JSON.stringify({
    type: 'START_BATCH',
    groupId,
    payloads,
    promptDelaySecondsMin: delayMin,
    promptDelaySecondsMax: delayMax,
  });

  // content_script의 chrome.runtime.onMessage 리스너를 트리거
  // CDP Runtime.evaluate로 페이지에서 직접 실행
  const startResult = await cdpSend(ws, 'Runtime.evaluate', {
    expression: `
      new Promise((resolve) => {
        // content_script의 메시지 리스너에 직접 이벤트 전달
        const msg = ${batchPayload};
        // chrome.runtime.sendMessage를 통해 content_script에 전달
        try {
          // 방법 1: dispatchEvent로 커스텀 이벤트
          window.dispatchEvent(new CustomEvent('18auto-batch', { detail: msg }));

          // 방법 2: 직접 함수 호출 (content_script가 ISOLATED world라 안 될 수 있음)
          // 대안: extension ID로 sendMessage
          resolve('DISPATCHED');
        } catch(e) {
          resolve('ERROR:' + e.message);
        }
      })
    `,
    awaitPromise: true,
    returnByValue: true,
  });

  console.log('📤 배치 전송:', startResult?.result?.value || startResult);

  // 7) 진행 상태 폴링
  console.log('\n⏳ 진행 상태 모니터링...');
  console.log('   (Ctrl+C로 모니터링 중단 — 배치는 계속 실행됨)\n');

  const pollInterval = setInterval(async () => {
    try {
      const statusResult = await cdpSend(ws, 'Runtime.evaluate', {
        expression: `
          JSON.stringify({
            running: typeof batchRunning !== 'undefined' ? batchRunning : 'unknown',
            tiles: document.querySelectorAll('[data-tile-id]').length,
          })
        `,
        returnByValue: true,
      });
      const status = JSON.parse(statusResult?.result?.value || '{}');
      const now = new Date().toLocaleTimeString('ko-KR');
      process.stdout.write(`\r  [${now}] 실행중: ${status.running} | 타일: ${status.tiles}개    `);

      if (status.running === false) {
        console.log('\n\n✅ 배치 완료!');
        clearInterval(pollInterval);
        ws.close();
        process.exit(0);
      }
    } catch (e) {
      // 연결 끊김
      clearInterval(pollInterval);
    }
  }, 5000);

  // Ctrl+C 핸들링
  process.on('SIGINT', () => {
    console.log('\n\n⛔ 모니터링 중단 (배치는 Flow에서 계속 실행됨)');
    clearInterval(pollInterval);
    ws.close();
    process.exit(0);
  });
}

main().catch(e => {
  console.error('❌ 오류:', e.message);
  process.exit(1);
});
