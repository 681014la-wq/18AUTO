# VEO Automation v2.1.2 — 전체 가이드 (GitHub 수집)

> 원본: https://github.com/trgkyle/veo-automation-user-guide
> 저자: Trường Nguyễn (kylenguyen.me)
> 라이선스: Proprietary (소스 비공개)

---

## 1. 개요

VEO Automation은 Google Flow AI VEO3에서 배치 영상/이미지 생성을 자동화하는 Chrome 확장 프로그램.
여러 프롬프트를 동시에 처리하고, 워크플로우를 설정하며, 생성된 콘텐츠를 자동 다운로드.

---

## 2. 핵심 기능

| 기능 | 설명 |
|------|------|
| Queue Support | 수동 개입 없이 여러 프롬프트 순차 처리 |
| Text-to-Video | .txt 파일로 수백 개 프롬프트 임포트 |
| Image-to-Video | 시작/종료 프레임 이미지로 영상 생성 (1~2장/프롬프트) |
| Components-to-Video | 캐릭터 레퍼런스 이미지로 영상 생성 (최대 3장/프롬프트) |
| Text-to-Image | 텍스트 설명으로 이미지 생성 |
| Image-to-Image | 레퍼런스 이미지로 이미지 변환 (최대 10장/프롬프트) |
| Auto Download | 프로젝트 폴더별 자동 저장 |
| Retry Mechanism | 네트워크/생성 오류 시 자동 재시도 |
| Deep Customization | 모델 선택, 화면비, 동시 실행 1~6개, 딜레이 0~300초 |

---

## 3. 5가지 생성 모드 상세

### 3-1. Text-to-Video
1. 모드 선택
2. 프롬프트 입력 (빈 줄로 구분) 또는 .txt 파일 업로드
3. Duration 설정 (8초 또는 Concat)
4. Run 클릭 → 배치 처리 시작

### 3-2. Image-to-Video
1. 모드 선택
2. 여러 이미지 업로드
3. 각 이미지에 대한 프롬프트 입력
4. Duration 설정
5. Run 클릭

### 3-3. Components-to-Video
1. 모드 선택
2. 컴포넌트 이미지 업로드
3. 애니메이션 프롬프트 입력
4. "Auto Add Character Images" 옵션 (파일명 기반 자동 매칭)
5. Run 클릭

### 3-4. Text-to-Image
1. 모드 선택
2. 상세 이미지 설명 입력
3. 화면비/모델 설정
4. Run 클릭
- 4k/2k/1k 다운로드 지원

### 3-5. Image-to-Image
1. 모드 선택
2. 소스 이미지 업로드
3. 변환 프롬프트 입력
4. 설정 (프롬프트당 최대 10장)
5. "Auto Add Character Images" 옵션
6. Run 클릭

---

## 4. 설정 상세

### 4-1. General Settings
- Default Mode: 자주 사용하는 생성 모드
- Default Aspect Ratio: 16:9 / 9:16
- Outputs per Prompt: 1~4
- Concurrent Prompts: 1~6
- Prompt Delay: 0~300초

### 4-2. Model Selection
- Video Models: Veo 3.1 Fast, Veo 3.1 Quality, Veo 2 variants
- Image Models: AI 모델 선택

### 4-3. Download Settings
- Video Quality: 720p / 1080p / 다운로드 안 함
- Image Quality: 1k / 2k / 4k / 다운로드 안 함
- 프로젝트별 폴더 자동 정리

### 4-4. Advanced Settings
- Max Retries: 1~20
- Default Video Frame: 8초 / Concat
- Max Images per Prompt: 모드별 설정
- Language: English / Vietnamese / Chinese

---

## 5. 팁 & 베스트 프랙티스

### 프롬프트 작성
- 구체적이고 서술적인 영어 프롬프트 사용
- 스타일, 시간, 시각적 요소 명시
- 여러 프롬프트는 빈 줄로 구분

### 배치 처리
- 평상시: 동시 프롬프트 3개
- 피크 시간: 동시 프롬프트 2개로 줄임
- 딜레이: ~30초 권장

### 이미지 관리
- 자동 매칭을 위해 명확한 파일명 사용
- PNG, JPG, GIF 포맷
- 10MB 이하

### 성능
- 동시 프롬프트 적을수록 = 안정적
- 딜레이 높을수록 = 서버 부하 적음

---

## 6. 트러블슈팅

| 문제 | 해결 |
|------|------|
| 확장 프로그램 미작동 | Flow 프로젝트 페이지 확인, 확장 활성화 확인, 새로고침 |
| 영상 생성 불가 | Flow 과부하 → 30초마다 자동 재시도 |
| 다운로드 안 됨 | Chrome 설정 → 다운로드 → "저장 위치 묻기" 비활성화 |
| "Policy Error" | Google 정책 위반 → 자동 스킵 후 계속 |
| 생성 실패 | 인터넷 연결, 프롬프트 유효성, 재시도 설정 확인 |
| 화면 축소 | 확장의 자동 줌 기능 → 수동 조정 금지 |

---

## 7. 프라이버시

- 브라우저 로컬에서만 실행
- 프롬프트, 이미지, 영상 수집 없음
- Chrome Local Storage에 설정만 저장
- labs.google/* 페이지만 접근

---

## 8. 프롬프트 예시

```
A serene sunset over a calm ocean with gentle waves.
Camera slowly pans across the horizon.

A bustling city street at night with neon lights flickering.
Cars and pedestrians moving through the scene.
```

```
平静海洋上宁静的日落，轻柔的波浪。
相机慢慢扫过地平线。

夜晚繁华的城市街道，霓虹灯闪烁。
汽车和行人在场景中穿行。
```
