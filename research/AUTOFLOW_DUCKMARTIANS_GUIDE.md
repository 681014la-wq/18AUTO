# Auto Flow v7.5.5 — duckmartians (GitHub 수집)

> 원본: https://github.com/duckmartians/Auto-Flow
> 저자: Dang Minh Duc (duckmartians)
> Stars: 33 / Forks: 18 / Commits: 23
> 라이선스: Proprietary (소스 비공개, README만 공개)

---

## 1. 개요

Auto Flow는 Google Flow(VEO)에서 영상 생성을 자동화하는 Chrome Extension.
AFK(자리비움) 상태에서 텍스트/이미지로 수백 개 영상을 자동 생성 가능.

---

## 2. 핵심 기능

| 기능 | 설명 |
|------|------|
| Smart Queue | 프롬프트/이미지를 대기열에 추가, 자동 순차 처리 |
| Text-to-Video | .txt 파일로 수백 개 프롬프트 임포트 |
| Image-to-Video | 이미지 업로드, 자동 화면비 처리, 모션 생성 |
| Auto Download | 렌더링 완료 즉시 자동 저장, 프로젝트별 폴더 정리 |
| Retry Mechanism | 네트워크 오류/큐 풀 시 자동 재시도 |
| Deep Customization | 모델 선택 (Veo 2, Veo 3.1), 화면비 (16:9, 9:16), 영상 수 (1~4) |

---

## 3. 사용 가이드

### 3-1. Text-to-Video
1. 모드 선택
2. 프롬프트 입력 (빈 줄 구분) 또는 .txt 임포트
3. 영상 수, 화면비 설정
4. "Add to Queue" → "Start Queue"

### 3-2. Image-to-Video
1. 모드 선택
2. 이미지 업로드
3. 프롬프트 입력
4. Queue에 추가 후 시작

### 3-3. Queue 관리
- Manage 버튼으로 대기 작업 확인
- 불필요 항목 삭제 또는 실패 작업 리셋

---

## 4. 트러블슈팅

| 문제 | 해결 |
|------|------|
| "Queue Full" 오류 | 30초마다 자동 재시도 |
| 다운로드 실패 | Chrome 설정 → 다운로드 → "저장 위치 묻기" 비활성화 |
| Policy Error | Google 정책 위반 → 자동 스킵 |
| 화면 줌 문제 | 확장의 자동 줌 기능 → 수동 조정 금지 |

---

## 5. 프라이버시

- 브라우저 로컬 실행
- 프롬프트/이미지/영상 수집 없음
- Chrome Local Storage에 설정만 저장
- labs.google/* 접근만 필요

---

## 6. msmunnabd Fork 정보

> 원본: https://github.com/msmunnabd/Flow-Automation-Extension
> 이름: "Power by Munna"

duckmartians의 Auto Flow와 동일한 README 내용 (v7.5.5).
라이선스 표기도 duckmartians 원작자로 동일.
결제 수단만 다름 (Bikash/Nagad/Rocket).
