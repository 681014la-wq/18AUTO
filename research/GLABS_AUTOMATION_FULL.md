# G-Labs Automation v3.0.4 — duckmartians (GitHub 수집)

> 원본: https://github.com/duckmartians/G-Labs-Automation
> 저자: Dang Minh Duc (duckmartians)
> Stars: 147 / Forks: 71 / Commits: 122 / Releases: 49
> 최신 릴리즈: v3.0.4 (2026-04-10)
> Discord: 1,369+ members
> 언어: Python (100%)

---

## 1. 개요

G-Labs Automation은 Google Labs AI 도구(Flow, Whisk, ImageFX, MusicFX) 자동화 데스크톱 앱.
로컬 Webhook API 서버를 내장하여 외부에서 REST API로 생성 요청 가능.
n8n 워크플로우 통합 지원.

---

## 2. 파일 구조

```
G-Labs-Automation/
├── G-Labs_Automation_Auth_Helper_v3.0.0.zip
├── N8N_INTEGRATION_GUIDE_EN.md
├── N8N_INTEGRATION_GUIDE_VI.md
├── README.md
├── WEBHOOK_API_GUIDE_EN.md
├── WEBHOOK_API_GUIDE_VI.md
├── test_webhook_full_EN.py
└── test_webhook_full_VI.py
```

---

## 3. Webhook API 상세 (핵심)

### Base URL: http://127.0.0.1:8765
### 인증: X-API-Key 헤더

### 3-1. Health Check
```
GET /api/health
```
```json
{ "status": "ok", "server": "G-Labs Webhook", "uptime": 3600, "tasks_pending": 0, "tasks_running": 1 }
```

### 3-2. 이미지 생성
```
POST /api/image/generate
```
| 필드 | 타입 | 필수 | 기본값 | 옵션 |
|------|------|------|--------|------|
| prompt | string | O | — | 이미지 설명 |
| model | string | — | imagen4 | imagen4, nano_banana, nano_banana_2, nano_banana_pro |
| count | integer | — | 1 | 1~8 |
| aspect_ratio | string | — | 1:1 | 1:1, 16:9, 9:16, 4:3, 3:4 |
| reference_images | array | — | [] | Base64 이미지 |
| upscale | array | — | [] | ["2K"], ["4K"] |

```bash
curl -X POST http://127.0.0.1:8765/api/image/generate \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "a cat wearing sunglasses", "model": "imagen4", "count": 2}'
```

### 3-3. 영상 생성
```
POST /api/video/generate
```
| 필드 | 타입 | 필수 | 기본값 | 옵션 |
|------|------|------|--------|------|
| prompt | string | O | — | 영상 설명 |
| model | string | — | veo_31_fast_relaxed | veo_31_fast_relaxed(0크레딧), veo_31_fast(10), veo_31_quality(100) |
| mode | string | — | text_to_video | text_to_video, start_image, start_end_image, components |
| aspect_ratio | string | — | 16:9 | 16:9, 9:16 |
| resolution | array | — | ["720p"] | ["720p"], ["1080p"], ["4K"] |
| reference_images | array | — | [] | Base64 이미지 (비텍스트 모드 필수) |

### 3-4. 작업 상태 확인
```
GET /api/status/{task_id}
```
상태 흐름: pending → running → completed / failed

### 3-5. 작업 결과 가져오기
```
GET /api/result/{task_id}
```

### 3-6. 전체 작업 목록
```
GET /api/tasks
```
최근 50개, 최신순 정렬

### 3-7. 파일 다운로드
```
GET /api/files/{filename}
```

---

## 4. Python 폴링 패턴

```python
import requests, time

API_KEY = "YOUR_API_KEY"
BASE = "http://127.0.0.1:8765"
HEADERS = {"X-API-Key": API_KEY, "Content-Type": "application/json"}

# 1. 작업 제출
resp = requests.post(f"{BASE}/api/image/generate", headers=HEADERS, json={
  "prompt": "a futuristic city at sunset",
  "model": "imagen4",
  "count": 2,
  "aspect_ratio": "16:9"
})
task_id = resp.json()["task_id"]

# 2. 완료까지 폴링
while True:
  status = requests.get(f"{BASE}/api/status/{task_id}", headers=HEADERS).json()
  if status["status"] == "completed":
    for url in status["results"]:
      img = requests.get(url, headers=HEADERS)
      filename = url.split("/")[-1]
      with open(filename, "wb") as f:
        f.write(img.content)
    break
  elif status["status"] == "failed":
    break
  time.sleep(5)
```

---

## 5. JavaScript 폴링 패턴

```javascript
const API_KEY = "YOUR_API_KEY";
const BASE = "http://127.0.0.1:8765";

const res = await fetch(`${BASE}/api/image/generate`, {
  method: "POST",
  headers: { "X-API-Key": API_KEY, "Content-Type": "application/json" },
  body: JSON.stringify({ prompt: "a cat in space", model: "imagen4", aspect_ratio: "1:1" })
});
const { task_id } = await res.json();

const poll = setInterval(async () => {
  const status = await fetch(`${BASE}/api/status/${task_id}`, {
    headers: { "X-API-Key": API_KEY }
  }).then(r => r.json());
  if (status.status === "completed") {
    clearInterval(poll);
    console.log("Files:", status.results);
  }
}, 5000);
```

---

## 6. n8n 통합

### 워크플로우 1: 단일 이미지 생성
Manual Trigger → HTTP Request (POST /api/image/generate) → Wait 30초 → HTTP Request (GET /api/status/{task_id}) → IF (completed?) → Download

### 워크플로우 2: 영상 생성
동일 구조, Wait 60초 이상 (영상 1~5분 소요)

### 워크플로우 3: 배치 처리
Schedule Trigger → Google Sheets (프롬프트 읽기) → Loop Over Items → 생성 → 폴링 → 결과 저장

---

## 7. 에러 코드

| HTTP 코드 | 의미 |
|-----------|------|
| 200 | 성공 |
| 202 | 작업 수락 (대기열) |
| 400 | 잘못된 요청 |
| 401 | 인증 실패 |
| 404 | 미발견 |
| 500 | 서버 오류 |
