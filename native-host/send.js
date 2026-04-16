#!/usr/bin/env node
// native-host/send.js — 터미널에서 18AUTO에 배치 명령 전송
//
// 사용법:
//   node send.js ../prompts.txt
//   node send.js ../prompts.txt --mode i2i --folder my-folder
//
// 동작 원리:
//   send.js → 파일에 명령 저장 → 18AUTO service_worker가 파일 감시 → 배치 실행
//   (Native Messaging은 확장이 먼저 연결해야 하므로, 파일 기반 트리거 사용)

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
if (!args.length || args[0] === '--help') {
  console.log(`
  18AUTO 배치 전송 (Native Host)
  ==============================
  사용법: node send.js <prompts.txt> [옵션]

  옵션: --mode, --folder, --delay, --output, --quality
  (batch-runner/run.js와 동일)
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

// 프롬프트 파싱
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
const mode = getArg('--mode', 't2i');
const folder = getArg('--folder', 'veo-folder-1');
const delayStr = getArg('--delay', '20-30');
const [delayMin, delayMax] = delayStr.split('-').map(Number);
const outputCount = parseInt(getArg('--output', '1'));
const dlImage = getArg('--quality', '2k');

// ─── 캐릭터 이미지 로드 (face 1장만 — Native Messaging 1MB 제한) ───
const CHARACTERS_DIR = path.join(__dirname, '..', 'characters');
const charImageCache = {}; // { 캐릭터명: { name, dataUrl, fileName } }

function loadCharacterImage(charName) {
  if (charImageCache[charName]) return charImageCache[charName];
  const charDir = path.join(CHARACTERS_DIR, charName);
  if (!fs.existsSync(charDir)) return null;
  // face 이미지 우선
  const files = fs.readdirSync(charDir).filter(f => f.endsWith('.png') || f.endsWith('.jpg'));
  const faceFile = files.find(f => f.includes('face')) || files[0];
  if (!faceFile) return null;
  const buf = fs.readFileSync(path.join(charDir, faceFile));
  const dataUrl = 'data:image/png;base64,' + buf.toString('base64');
  const img = { name: faceFile.replace(/\.[^.]+$/, ''), dataUrl, fileName: faceFile };
  charImageCache[charName] = img;
  console.log(`  캐릭터 로드: ${charName}/${faceFile} (${(buf.length/1024).toFixed(0)}KB)`);
  return img;
}

// 배치 명령 파일 생성 — 18AUTO가 감시
const payloads = prompts.map((item, i) => {
  const payload = {
    prompt: item.prompt,
    mode,
    outputCount,
    folderName: folder,
    promptIndex: i + 1,
    maxRetries: 5,
    downloadVideoQuality: '720p',
    downloadImageQuality: dlImage,
    autoRename: true,
  };
  // 캐릭터명이 있으면 face 이미지 첨부
  if (item.charName) {
    const img = loadCharacterImage(item.charName);
    if (img) {
      payload.characterImages = [{ name: img.name, dataUrl: img.dataUrl, fileName: img.fileName }];
    }
  }
  return payload;
});

const command = {
  type: 'START_BATCH',
  groupId: `cli-${Date.now()}`,
  timestamp: new Date().toISOString(),
  payloads,
  promptDelaySecondsMin: delayMin,
  promptDelaySecondsMax: delayMax,
};

const cmdFile = path.join(__dirname, 'batch-command.json');
fs.writeFileSync(cmdFile, JSON.stringify(command, null, 2), 'utf-8');

const refCount = payloads.filter(p => p.characterImages?.length).length;
console.log(`\n배치 명령 저장됨: ${cmdFile}`);
console.log(`  프롬프트: ${prompts.length}개 (${refCount}개 캐릭터 매핑)`);
console.log(`  모드: ${mode} | 폴더: ${folder} | 대기: ${delayMin}-${delayMax}초`);
console.log(`  메시지 크기: ${(JSON.stringify(command).length / 1024 / 1024).toFixed(2)} MB (제한: 1MB)`);
console.log(`\nNative Messaging으로 자동 전송됩니다.`);
