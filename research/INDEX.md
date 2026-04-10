# 18AUTO Research Index

> 업데이트: 2026-04-10

---

## 기존 리서치 (20260409_AUTO에서 인계)

| 파일 | 내용 |
|------|------|
| AUTOFLOW_DUCKMARTIANS_GUIDE.md | Auto Flow v7.5.5 duckmartians — Smart Queue, 재시도 패턴 |
| VEO_AUTOMATION_FULL_GUIDE.md | VEO Automation v2.6.8 — 5모드, 설정, 배치 처리 전체 가이드 |
| CHROME_EXTENSION_RESEARCH.md | MV3 아키텍처, Side Panel↔SW↔CS 통신, execCommand, URL 패턴 |
| COMPETITOR_EXTENSIONS.md | 경쟁 확장 9개 목록, 공통 DOM 자동화 패턴 |
| GLABS_AUTOMATION_FULL.md | G-Labs Webhook API 전체 스펙 (Python/JS 폴링 패턴) |
| VEO3_MODEL_INFO.md | Veo 3.1 Fast/Quality/Relaxed, Imagen 4, Nano Banana 모델 목록 |

---

## 신규 리서치 (웹서치 추가 수집)

| 파일 | 내용 |
|------|------|
| 03_sw_keepalive_advanced.md | SW Keep-Alive 3가지 방법 (storage 20초, Port onConnect, alarms) |
| 04_filesystem_api.md | showDirectoryPicker 폴더 직접 저장, chrome.downloads 비교 |
| 05_main_world_react_input.md | MAIN World 주입, nativeInputValueSetter, execCommand vs ClipboardEvent |
| 06_github_references.md | Flow 자동화 GitHub 5개, MV3 스타터 5개, 공식 문서 6개 통합 |

---

## 핵심 결론 (18AUTO 제작 기준)

1. **입력**: Slate.js → `execCommand('insertText')` ISOLATED World에서 안정
2. **버튼 클릭**: aria-label + 텍스트 allowlist 방식, disabled/aria-disabled 양쪽 체크
3. **완료 감지**: MutationObserver + setInterval(1000) 조합, outputCount 개수 채울 때까지 대기
4. **SW 유지**: Port onConnect 방식 (배치 실행 중에만)
5. **다운로드**: blob→anchor → File System API → chrome.downloads 순서
6. **상태 저장**: 반드시 chrome.storage.local (메모리 변수 금지)
