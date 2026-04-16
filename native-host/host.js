#!/usr/bin/env node
// native-host/host.js — Native Messaging 호스트
//
// Chrome이 자동 실행하는 프로세스.
// batch-command.json 파일을 감시하여 새 명령이 들어오면 확장에 전달.
//
// 흐름: send.js가 batch-command.json 작성 → host.js 감지 → Chrome 확장에 전달

const fs = require('fs');
const path = require('path');

const CMD_FILE = path.join(__dirname, 'batch-command.json');
const LOG_FILE = path.join(__dirname, 'host.log');

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  fs.appendFileSync(LOG_FILE, line);
}

// ─── Native Messaging 프로토콜 ───

// Windows: stdin/stdout을 바이너리 모드로 강제 설정
// text 모드에서 0x0A(\n) → 0x0D 0x0A(\r\n) 변환 방지
if (process.platform === 'win32') {
  // stdin은 pause 상태에서 설정
  if (process.stdin._handle && process.stdin._handle.setBlocking) {
    process.stdin._handle.setBlocking(true);
  }
}

function readMessage(callback) {
  let buf = Buffer.alloc(0);
  process.stdin.on('data', (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    while (buf.length >= 4) {
      const len = buf.readUInt32LE(0);
      // 안전 검사: 비정상적으로 큰 메시지 방지 (Chrome 제한: 1MB)
      if (len > 1024 * 1024) {
        log(`오류: 메시지 길이 비정상 (${len} bytes). 버퍼 초기화.`);
        buf = Buffer.alloc(0);
        return;
      }
      if (buf.length < 4 + len) break;
      try {
        const msg = JSON.parse(buf.slice(4, 4 + len).toString('utf-8'));
        buf = buf.slice(4 + len);
        callback(msg);
      } catch (e) {
        log(`JSON 파싱 오류: ${e.message}`);
        buf = buf.slice(4 + len);
      }
    }
  });
}

function sendMessage(msg) {
  const json = Buffer.from(JSON.stringify(msg), 'utf-8');
  const header = Buffer.alloc(4);
  header.writeUInt32LE(json.length, 0);
  // 핵심: length prefix + JSON을 하나의 Buffer로 합쳐서 단일 write
  // - 두 번 나눠 쓰면 파이프 버퍼링으로 Chrome이 부분 읽기 가능
  // - json을 Buffer로 변환하여 string 인코딩 문제 방지
  const out = Buffer.concat([header, json]);
  process.stdout.write(out);
}

// ─── Chrome 다운로드 기본 경로 찾기 ───
function getChromeDownloadPath() {
  const homedir = require('os').homedir();
  try {
    const prefsPath = path.join(homedir, 'AppData', 'Local', 'Google', 'Chrome', 'User Data', 'Default', 'Preferences');
    log(`[DEBUG][host] prefs path: ${prefsPath}`);
    const prefs = JSON.parse(fs.readFileSync(prefsPath, 'utf-8'));
    const dir = prefs.download?.default_directory;
    log(`[DEBUG][host] prefs download.default_directory: ${dir}`);
    if (dir) return dir;
  } catch (e) {
    log(`[DEBUG][host] prefs read failed: ${e.message}`);
  }
  const fallback = path.join(homedir, 'Downloads');
  log(`[DEBUG][host] fallback download path: ${fallback}`);
  return fallback;
}

// ─── 확장에서 온 메시지 처리 ───
readMessage((msg) => {
  log(`확장→호스트: ${JSON.stringify(msg).slice(0, 200)}`);

  if (msg.type === 'CREATE_FOLDER') {
    try {
      log(`[DEBUG][host] CREATE_FOLDER received: ${JSON.stringify(msg)}`);
      const dlPath = getChromeDownloadPath();
      log(`[DEBUG][host] download path resolved: ${dlPath}`);
      const folderPath = path.join(dlPath, msg.folder);
      log(`[DEBUG][host] target folder path: ${folderPath}`);
      log(`[DEBUG][host] exists before mkdir: ${fs.existsSync(folderPath)}`);
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
        log(`[DEBUG][host] mkdirSync done`);
      }
      log(`[DEBUG][host] exists after mkdir: ${fs.existsSync(folderPath)}`);
      sendMessage({ type: 'FOLDER_CREATED', ok: true, path: folderPath });
    } catch (e) {
      log(`[DEBUG][host] folder create failed: ${e.stack || e.message}`);
      sendMessage({ type: 'FOLDER_CREATED', ok: false, error: e.message });
    }
    return;
  }

  if (msg.type === 'SAVE_FILE') {
    try {
      const dlPath = getChromeDownloadPath();
      const folderPath = msg.folder ? path.join(dlPath, msg.folder) : dlPath;
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
        log(`폴더 생성: ${folderPath}`);
      }
      // base64 data URL → 파일 저장
      const base64Data = msg.data.replace(/^data:[^;]+;base64,/, '');
      const filePath = path.join(folderPath, msg.filename);
      fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
      log(`파일 저장: ${filePath}`);
      sendMessage({ type: 'FILE_SAVED', ok: true, path: filePath });
    } catch (e) {
      log(`파일 저장 실패: ${e.message}`);
      sendMessage({ type: 'FILE_SAVED', ok: false, error: e.message });
    }
    return;
  }
});

// ─── batch-command.json 파일 감시 ───
let lastMtime = 0;

function checkCommandFile() {
  try {
    if (!fs.existsSync(CMD_FILE)) return;
    const stat = fs.statSync(CMD_FILE);
    const mtime = stat.mtimeMs;
    if (mtime <= lastMtime) return;
    lastMtime = mtime;

    const raw = fs.readFileSync(CMD_FILE, 'utf-8');
    const cmd = JSON.parse(raw);
    log(`명령 감지: ${cmd.type} (${cmd.payloads?.length || 0}개 프롬프트)`);

    // 확장에 전달
    sendMessage(cmd);

    // 처리 완료 표시 — 파일 삭제
    fs.unlinkSync(CMD_FILE);
    log('명령 파일 삭제 완료');
  } catch (e) {
    log(`오류: ${e.message}`);
  }
}

// 2초마다 파일 체크
setInterval(checkCommandFile, 2000);

log('호스트 시작됨 — 명령 파일 감시 중');
sendMessage({ ok: true, type: 'HOST_READY' });

// 프로세스 유지
process.stdin.resume();
