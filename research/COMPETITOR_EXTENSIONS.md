# Google Flow VEO 경쟁 확장 프로그램 목록

> 수집일: 2026-04-10

---

## 1. VEO Automation (trgkyle)
- **버전**: v2.1.2
- **Chrome Web Store**: https://chromewebstore.google.com/detail/fnmijgmnjpealnnadjpjilaanhhambeb
- **GitHub**: https://github.com/trgkyle/veo-automation-user-guide
- **저자**: Trường Nguyễn (kylenguyen.me)
- **특징**: 5가지 모드, 배치 처리, 자동 다운로드, 자동 재시도, 다국어(EN/VI/ZH)
- **동시 프롬프트**: 1~6개
- **딜레이**: 0~300초
- **다운로드**: 720p/1080p(영상), 1k/2k/4k(이미지)
- **라이선스**: Proprietary

---

## 2. Auto Flow Pro
- **Chrome Web Store**: https://chromewebstore.google.com/detail/ljkkbddijmbnkjlnlkckfbnnbijmmdpf
- **웹사이트**: https://flowautomation.store/
- **Socket.dev 분석**: https://socket.dev/chrome/package/ljkkbddijmbnkjlnlkckfbnnbijmmdpf
- **특징**: VEO AI 자동화, 큐 관리, 배치 처리, 자동 다운로드

---

## 3. FlowForge Pro
- **Chrome Web Store**: https://chromewebstore.google.com/detail/licgndkjfacppldmdmceemnhpnbgbcmn
- **특징**: Veo AI Automator

---

## 4. Auto Flow (Bulk AI Video)
- **Chrome Web Store**: https://chromewebstore.google.com/detail/lhcmnhdbddgagibbbgppakocflbnknoa
- **Chrome Stats**: https://chrome-stats.com/d/lhcmnhdbddgagibbbgppakocflbnknoa
- **특징**: Auto Veo & Nano Banana Pro, 대량 영상 생성

---

## 5. FlowGenius
- **Chrome Web Store**: https://chromewebstore.google.com/detail/ecpjobeohdeedkckpgjknpnhcpfhadbj
- **특징**: VEO AI Video Automation, Bulk Generator, Auto Download

---

## 6. AutoFlow Studio
- **웹사이트**: https://www.auto-flow.studio/
- **특징**: Automate Google Flow AI Video Generation, Batch Prompts, Queue Manager

---

## 7. Auto Flow Veo Generator
- **Chrome Web Store**: https://chromewebstore.google.com/detail/jaginhelidgcgadncknlcekgcglandge
- **특징**: Flow Veo Generator

---

## 8. Scalable Creators - Veo Automation
- **Chrome Web Store**: https://chromewebstore.google.com/detail/nekepgimajmofnblmpbbjhielijbpoek
- **특징**: Scalable Creators Veo Automation

---

## 9. VEO3 Auto
- **Softonic**: https://veo3-auto-google-flow-veo-automation.en.softonic.com/chrome/extension
- **특징**: Google Flow VEO Automation

---

## 공통 자동화 패턴 (DOM 조작 방식 추정)

모든 경쟁 확장은 동일한 DOM 자동화 패턴 사용:

1. **프롬프트 입력**: Slate.js contenteditable 에디터에 텍스트 삽입
2. **생성 버튼 클릭**: "만들기" / "Create" 버튼 자동 클릭
3. **완료 감지**: MutationObserver로 새 콘텐츠(이미지/영상) 생성 감지
4. **자동 다운로드**: 생성된 콘텐츠의 URL 추출 후 chrome.downloads API로 저장
5. **재시도**: 과부하/오류 시 30초 간격 자동 재시도
6. **화면 줌**: 자동 줌 조정으로 UI 요소 정확한 위치 파악
