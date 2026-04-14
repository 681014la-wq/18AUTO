# VEO Automation & Google Flow 사용 가이드 리서치

> 조사일: 2026-04-13
> 검색 쿼리 10개 + GitHub 레포 2개 분석 완료

---

## GitHub 레포 분석

### 1. trgkyle/veo-automation-user-guide
- **URL**: https://github.com/trgkyle/veo-automation-user-guide
- **설명**: Google Flow AI VEO3에서 배치 영상/이미지 생성을 자동화하는 Chrome 확장 프로그램의 공식 사용자 가이드
- **주요 기능**:
  - **5가지 생성 모드**: Text-to-Video, Image-to-Video, Components-to-Video, Text-to-Image, Image-to-Image
  - **대량 처리**: .txt 파일로 수백 개 프롬프트 임포트 가능
  - **동시 실행**: 1~6개 프롬프트 병렬 처리
  - **자동 다운로드**: 렌더링 완료 즉시 자동 저장
  - **재시도 기능**: 실패한 생성 자동 재시도 (30초 간격)
- **설정 옵션**:
  - 모델 선택: Veo 3.1 Fast 등
  - 화면비: 16:9, 9:16, 1:1
  - 프롬프트당 다운로드 수: 1~4개
  - 프롬프트 간 딜레이: 0~300초
  - 다운로드 화질: 720p, 1080p, 2K, 4K
- **프라이버시**: 브라우저 내에서만 동작, 데이터 수집 없음, Chrome Local Storage만 사용
- **팁**: 안정성을 위해 동시 처리 3개, 딜레이 30초 권장

### 2. duckmartians (Dang Minh Duc)
- **URL**: https://github.com/duckmartians
- **총 레포 수**: 12개
- **주요 프로젝트**:
  - **Auto-Flow (v7.5.5)**: Google Flow(VEO)에서 대량 영상 자동 생성. AFK(자리비움) 상태로 수백 개 영상 생성 가능
  - **G-Labs-Automation**: 올인원 자동화 도구 (Python 기반)
  - **Auto-Whisk**: Whisk 플랫폼에서 프롬프트 제출 및 이미지 다운로드 자동화
  - **Auto-MetaAI**: Meta AI 자동화 유틸리티
  - **Duck_Nodes**: ComfyUI 노드 컬렉션 (Google Sheets, Docs, Excel, Word, TXT 데이터 로딩)
  - **YouTube_Downloader**: YouTube 영상/재생목록/채널 다운로드 데스크톱 앱
- **Auto-Flow 주요 기능**:
  - 스마트 큐 시스템으로 순차 배치 처리
  - Text-to-Video: .txt 파일 임포트 지원
  - Image-to-Video: 자동 이미지 업로드 및 화면비 처리
  - 자동 다운로드 + 프로젝트별 폴더 정리
  - 네트워크 오류 및 큐 오버플로 시 자동 재시도
  - `labs.google/*` 도메인만 접근 권한 필요

### 3. AutoPlayLabs-Dev/Flow-Image-Automator
- **URL**: https://github.com/AutoPlayLabs-Dev/Flow-Image-Automator
- **설명**: Google Labs에서 AI 이미지를 대량 자동 생성하는 Chrome 확장
- **주요 기능**:
  - **Standard Batching**: 텍스트로 이미지 생성 (단일행/JSON 포맷)
  - **Integration Mode**: 레퍼런스 이미지 + 커스텀 프롬프트 결합 (브랜드 일관성 유지)
  - **Paired Mode**: 개별 레퍼런스 이미지에 고유 프롬프트 할당 (스토리텔링용)
  - **Stealth Mode + Random Delay**: 속도 제한 회피용 프롬프트 큐 관리
  - **AI Prompt Creator**: 프롬프트 브레인스토밍 제안
  - **Content Download Manager**: 수백 개 완성 이미지 일괄 다운로드
- **팁**: 소규모 배치(5~10개)로 시작해서 설정 최적화 후 스케일업 권장

---

## 인기 튜토리얼/가이드 (조회수/인기도 순)

### 1. VEO Automation - Auto VEO on Google Flow (Chrome 확장)
- **URL**: https://chromewebstore.google.com/detail/veo-automation-auto-veo-o/fnmijgmnjpealnnadjpjilaanhhambeb
- **제작자**: trgkyle
- **핵심**: 5가지 모드(T2V, I2V, C2V, T2I, I2I) 지원, .txt 파일로 수백 개 프롬프트 배치 처리, 1~6개 동시 실행, 자동 다운로드
- **요약**: Google Flow에서 가장 포괄적인 VEO 자동화 확장. 프롬프트 큐잉, 자동 재시도, 다양한 화질 옵션(720p~4K) 제공

### 2. Auto Flow Pro - Automation for VEO AI
- **URL**: https://flowautomation.store/
- **Chrome 스토어**: https://chromewebstore.google.com/detail/auto-flow-pro-automation/ljkkbddijmbnkjlnlkckfbnnbijmmdpf
- **가격**: 무료(50영상/일), Pro($10/년), Lifetime($50)
- **핵심**: 1~50개 동시 처리, TXT/DOCX/JSON 임포트, 일시정지/재개/건너뛰기 제어, 자동 재시도
- **요약**: 가장 많은 동시 처리(최대 50개)를 지원하며 무료 티어로도 하루 50개 영상 생성 가능. 초보자 친화적 UI

### 3. Auto Flow - Auto Veo & Nano Banana Pro (duckmartians)
- **URL**: https://chromewebstore.google.com/detail/auto-flow-auto-veo-nano-b/lhcmnhdbddgagibbbgppakocflbnknoa
- **GitHub**: https://github.com/duckmartians/Auto-Flow
- **핵심**: VEO + Nano Banana 모델 동시 지원, AFK 모드로 수백 개 영상 생성, 스마트 큐 + 자동 재시도
- **요약**: 오픈소스 기반으로 투명한 코드 확인 가능. VEO와 Nano Banana 모델을 모두 지원하는 유일한 확장

### 4. Google Flow Veo 3: Complete Guide to AI-Powered Video Editing (2026)
- **URL**: https://www.veo3ai.io/blog/google-flow-veo-3-guide-2026
- **핵심**: SCAM 프레임워크(Subject, Composition, Action, Mood) 프롬프트 작성법, AI 카메라 제어, 캐릭터 일관성 유지
- **요약**: 프로 워크플로우 가이드. 프리 프로덕션(스크립팅) -> 프로덕션(러프컷) -> 포스트 프로덕션(색보정, 사운드) 단계별 안내

### 5. Veo 3.1 in Flow: The Ultimate Prompt-to-Edit Workflow Guide
- **URL**: https://skywork.ai/blog/veo-3-1-flow-ultimate-guide/
- **핵심**: Prompt -> Generate -> Review -> Iterate -> Extend -> Export 워크플로우, 기술 사양(4/6/8초, 720p/1080p)
- **요약**: 재현 가능한 Veo 3.1 워크플로우 제시. 지속 시간, 해상도, 화면비, 네이티브 오디오 등 기술 제약 사항 상세 정리

### 6. [Veo 3.1 FREE] How To Use Veo 3.1 in Flow and N8N
- **URL**: https://websensepro.com/blog/veo-3-1-in-flow-and-n8n/
- **핵심**: Google Flow 무료 사용법(계정당 100크레딧, 약 5개 영상) + N8N 자동화 연동(Google Cloud $300 무료 크레딧)
- **요약**: 무료로 시작하는 2가지 방법 제시. N8N으로 배치 처리 파이프라인 구축하면 수동 개입 없이 대량 생성 가능. 추가 Gmail 계정으로 무료 크레딧 확보 팁

### 7. FlowGenius - VEO AI Video Automation, Bulk Generator & Auto Download
- **URL**: https://chromewebstore.google.com/detail/flowgenius-veo-ai-video/ecpjobeohdeedkckpgjknpnhcpfhadbj
- **핵심**: VEO AI 영상 자동화 + 대량 생성 + 자동 다운로드 통합 솔루션
- **요약**: 올인원 VEO 자동화 확장. 생성부터 다운로드까지 전 과정 자동화

### 8. FlowForge Pro - Veo AI Automator
- **URL**: https://chromewebstore.google.com/detail/flowforge-pro-veo-ai-auto/licgndkjfacppldmdmceemnhpnbgbcmn
- **핵심**: VEO AI 자동화 전문 도구
- **요약**: Pro급 VEO 자동화 기능 제공

### 9. Flow Image Automator - Bulk AI Image Generation
- **URL**: https://chromewebstore.google.com/detail/flow-image-automator-bulk/eiboocmincdlldgkkidfhaphhoohkoii
- **GitHub**: https://github.com/AutoPlayLabs-Dev/Flow-Image-Automator
- **핵심**: 이미지 전문 자동화. Standard/Integration/Paired 3가지 모드, Stealth Mode로 속도 제한 회피, AI Prompt Creator 내장
- **요약**: 이미지 대량 생성에 특화. 레퍼런스 이미지 기반 브랜드 일관성 유지가 강점

### 10. n8n 워크플로우: NanoBanana & VEO3 바이럴 영상 자동 생성 + SNS 배포
- **URL**: https://n8n.io/workflows/8270-generate-ai-viral-videos-with-nanobanana-and-veo3-shared-on-socials-via-blotato/
- **핵심**: NanoBanana + VEO3로 영상 생성 -> Blotato로 멀티 플랫폼 자동 배포
- **요약**: 생성부터 SNS 포스팅까지 완전 자동화 파이프라인. n8n 스케줄링으로 오프피크 시간 배치 처리 가능

### 11. n8n 워크플로우: VEO3 Video Generator + Google Drive 저장
- **URL**: https://n8n.io/workflows/4767-veo3-video-generator-with-ai-optimization-and-google-drive-storage/
- **핵심**: VEO3 영상 생성 + AI 최적화 + Google Drive 자동 저장
- **요약**: 생성된 영상을 자동으로 Google Drive에 정리하여 저장하는 워크플로우

### 12. Scalable Creators - Veo Automation
- **URL**: https://chromewebstore.google.com/detail/scalable-creators-veo-aut/nekepgimajmofnblmpbbjhielijbpoek
- **핵심**: 대규모 콘텐츠 크리에이터를 위한 VEO 자동화
- **요약**: 스케일링에 초점을 맞춘 VEO 자동화 도구

### 13. Auto Flow Veo Generator
- **URL**: https://chromewebstore.google.com/detail/auto-flow-veo-generator/jaginhelidgcgadncknlcekgcglandge
- **핵심**: Google Flow에서 VEO 영상 자동 생성
- **요약**: 심플한 인터페이스의 VEO 자동 생성기

### 14. Auto Google Flow Veo - Batch Video Automation
- **URL**: https://chrome-stats.com/d/flejildjecmbhkcbeiedhooappbejmkg
- **핵심**: Google Flow VEO 배치 영상 자동화
- **요약**: 배치 처리에 초점을 맞춘 VEO 자동화 확장

### 15. FlowBot - Bulk Video & Image Generator for Google Flow
- **URL**: https://chromewebstore.google.com/detail/flowbot-bulk-video-imag/nllghdbfglepflcbhholppbmbmagchgh
- **핵심**: Google Flow 영상 + 이미지 대량 생성 봇
- **요약**: 영상과 이미지 모두 대량 생성할 수 있는 통합 봇

### 16. 구글 Veo 3.1 출시! 사용법, 무료 유료 가격 총정리 (캐럿 블로그)
- **URL**: https://carat.im/blog/google-veo3-31-release-guide
- **핵심**: Veo 3.1 네이티브 오디오 + 립싱크, 최대 1분 1080p 영상, Fast 모델(30% 빠름), 시네마틱 프리셋
- **요약**: 한국어 가이드. Google AI Ultra 월 $249.99 또는 캐럿 AI 통해 합리적 이용 가능. Fast 모델로 빠른 테스트 권장

### 17. FlowRun - Flow 자동화 (한국어)
- **URL**: https://chromewebstore.google.com/detail/flowrun-flow-자동화/jphjdpjadeldnhmbcmldhjgbkfbjmfmf
- **핵심**: 수십 개 프롬프트 자동 전송, 순번 파일명 자동 저장, 한글 카피 지원
- **요약**: 한국어를 지원하는 유일한 Flow 자동화 확장. 한글 프롬프트와 파일명 처리에 강점

### 18. Flow 이미지 자동생성 서비스 (한국어)
- **URL**: https://chromewebstore.google.com/detail/flow-이미지-자동생성-서비스/jmcibncaddcncgijhjppcipfgdeggkpg
- **핵심**: 프롬프트 파일 하나로 수십 장 이미지 자동 생성 + 다운로드, 캐릭터 에셋/그림체 스타일 일괄 적용
- **요약**: 한국어 이미지 자동 생성 전문 도구. 텍스트 파일의 장면 프롬프트를 업로드하면 자동 순차 생성

### 19. InfiniFlow
- **URL**: https://chromewebstore.google.com/detail/infiniflow/bikeehdlgfbcaohjiakliklpjmfjiokc
- **핵심**: 프롬프트 입력 -> 생성 -> 다운로드 -> 삭제까지 전체 워크플로우 자동 반복
- **요약**: 완전 자동 무한 루프 방식. 프롬프트 목록 입력 후 한 번 클릭으로 전체 완료까지 자동 진행

### 20. Auto Flow - Bulk AI Video & Image Generation (ergophobia.info)
- **URL**: https://ergophobia.info/autoflow/
- **핵심**: Google Flow AI에서 대량 영상/이미지 자동 생성 가이드
- **요약**: Auto Flow 사용법 상세 안내 페이지

---

## 핵심 사용 팁 요약

### 설치 및 시작
1. **Chrome 웹 스토어에서 확장 설치** -> Google Flow 접속 -> 사이드 패널에서 확장 열기
2. **무료 크레딧 확보**: Google Flow 계정당 100 무료 크레딧(약 5개 영상). 추가 Gmail 계정으로 크레딧 추가 확보 가능
3. **API 방식**: Google Cloud 무료 체험($300 크레딧, 90일) + N8N으로 파이프라인 구축 시 수동 개입 없이 대량 생성

### 프롬프트 작성 팁
4. **SCAM 프레임워크 활용**: Subject(주제) + Composition(구도) + Action(동작) + Mood(분위기)로 구조화
5. **시네마틱 용어 사용**: "medium shot", "tracking shot", "warm cinematic", "vintage film" 등 영화 용어로 품질 향상
6. **카메라 워크 지정**: 패닝, 틸팅, 줌, 달리, 오빗, 핸드헬드 등 텍스트로 직접 제어 가능
7. **캐릭터 일관성**: 레퍼런스 이미지 업로드 또는 매 프롬프트에 상세 캐릭터 설명 포함

### 배치 처리 최적화
8. **소규모로 시작**: 5~10개 배치로 설정 테스트 후 스케일업
9. **동시 실행 수**: 안정성을 위해 3개 권장 (최대 6개까지 가능하나 불안정할 수 있음)
10. **프롬프트 간 딜레이**: 30초 권장 (속도 제한 회피)
11. **Stealth Mode**: Flow Image Automator의 Stealth Mode + Random Delay로 rate limit 회피
12. **파일 임포트**: .txt 파일에 프롬프트 작성 후 일괄 임포트가 가장 효율적

### 모델 선택
13. **Veo 3.1 Fast**: 품질 약간 양보하고 30% 빠른 속도. 빠른 테스트에 적합
14. **Nano Banana Pro**: 최고 품질 이미지 생성. 디테일이 중요한 작업에 적합
15. **Nano Banana 2**: 속도와 품질 균형. 무료 사용 가능
16. **Imagen 4**: 사실적인 인물/배경 표현에 강점

### 자동화 파이프라인
17. **n8n 연동**: VEO3 + NanoBanana 생성 -> Blotato로 멀티 플랫폼 SNS 자동 배포
18. **Google Drive 저장**: n8n 워크플로우로 생성 영상 자동 정리/저장
19. **오프피크 시간 활용**: 스케줄링으로 서버 부하 낮은 시간대에 배치 처리
20. **실패 자동 처리**: 자동 재시도 기능 활성화, 콘텐츠 정책 위반은 자동 건너뛰기

### 확장 프로그램 비교
| 확장 프로그램 | 동시 처리 | 가격 | 영상 | 이미지 | 특징 |
|---|---|---|---|---|---|
| VEO Automation (trgkyle) | 1~6개 | 무료/유료 | O | O | 5가지 모드, 가장 포괄적 |
| Auto Flow Pro | 1~50개 | 무료(50/일), $10/년 | O | O | 최대 동시 처리, 초보자 친화 |
| Auto Flow (duckmartians) | - | 무료 | O | O | 오픈소스, VEO+Nano Banana |
| Flow Image Automator | - | 무료/유료 | X | O | 이미지 특화, Stealth Mode |
| FlowRun | - | - | X | O | 한국어 지원 |
| InfiniFlow | - | - | O | O | 완전 자동 무한 루프 |

---

## 참고 링크 모음

### Chrome 확장 프로그램
- [VEO Automation](https://chromewebstore.google.com/detail/veo-automation-auto-veo-o/fnmijgmnjpealnnadjpjilaanhhambeb)
- [Auto Flow Pro](https://chromewebstore.google.com/detail/auto-flow-pro-automation/ljkkbddijmbnkjlnlkckfbnnbijmmdpf)
- [Auto Flow (duckmartians)](https://chromewebstore.google.com/detail/auto-flow-auto-veo-nano-b/lhcmnhdbddgagibbbgppakocflbnknoa)
- [FlowGenius](https://chromewebstore.google.com/detail/flowgenius-veo-ai-video/ecpjobeohdeedkckpgjknpnhcpfhadbj)
- [FlowForge Pro](https://chromewebstore.google.com/detail/flowforge-pro-veo-ai-auto/licgndkjfacppldmdmceemnhpnbgbcmn)
- [Flow Image Automator](https://chromewebstore.google.com/detail/flow-image-automator-bulk/eiboocmincdlldgkkidfhaphhoohkoii)
- [FlowBot](https://chromewebstore.google.com/detail/flowbot-bulk-video-imag/nllghdbfglepflcbhholppbmbmagchgh)
- [FlowRun (한국어)](https://chromewebstore.google.com/detail/flowrun-flow-자동화/jphjdpjadeldnhmbcmldhjgbkfbjmfmf)
- [Flow 이미지 자동생성 (한국어)](https://chromewebstore.google.com/detail/flow-이미지-자동생성-서비스/jmcibncaddcncgijhjppcipfgdeggkpg)
- [InfiniFlow](https://chromewebstore.google.com/detail/infiniflow/bikeehdlgfbcaohjiakliklpjmfjiokc)
- [Scalable Creators](https://chromewebstore.google.com/detail/scalable-creators-veo-aut/nekepgimajmofnblmpbbjhielijbpoek)

### GitHub 레포
- [trgkyle/veo-automation-user-guide](https://github.com/trgkyle/veo-automation-user-guide)
- [duckmartians/Auto-Flow](https://github.com/duckmartians/Auto-Flow)
- [AutoPlayLabs-Dev/Flow-Image-Automator](https://github.com/AutoPlayLabs-Dev/Flow-Image-Automator)
- [eddie-fqh/auto-flow](https://github.com/eddie-fqh/auto-flow)

### 튜토리얼/블로그
- [Google Flow Veo 3 Guide 2026](https://www.veo3ai.io/blog/google-flow-veo-3-guide-2026)
- [Veo 3.1 Flow Ultimate Guide (Skywork)](https://skywork.ai/blog/veo-3-1-flow-ultimate-guide/)
- [Veo 3.1 in Flow and N8N (WebSensePro)](https://websensepro.com/blog/veo-3-1-in-flow-and-n8n/)
- [구글 Veo 3.1 총정리 (캐럿)](https://carat.im/blog/google-veo3-31-release-guide)
- [Auto Flow Pro 공식](https://flowautomation.store/)
- [n8n: NanoBanana+VEO3 바이럴 영상](https://n8n.io/workflows/8270-generate-ai-viral-videos-with-nanobanana-and-veo3-shared-on-socials-via-blotato/)
- [n8n: VEO3+Google Drive](https://n8n.io/workflows/4767-veo3-video-generator-with-ai-optimization-and-google-drive-storage/)

### 공식 Google
- [Google Flow](https://labs.google/fx/tools/flow)
- [Flow 도움말: 영상 만들기](https://support.google.com/flow/answer/16353334?hl=en)
- [Flow 도움말: 이미지 만들기](https://support.google.com/labs/answer/16729550?hl=en)
- [Veo 3 - Google AI Studio](https://aistudio.google.com/models/veo-3)
