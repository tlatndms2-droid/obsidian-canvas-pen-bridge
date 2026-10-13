# Canvas Pen Bridge — 작업 인계

갱신일: 2026-10-13 · 버전 0.1.0 · Obsidian 1.14.4 / Windows / Wacom.

## 목표와 구현

Windows Ink ON에서 필압을 유지하면서 카드·그룹·연결선을 조작하는 별도 플러그인이다. 기존 Canvas Drawing Tool Bar는 수정하지 않는다. 새 UI나 Canvas 데이터 형식은 없다.

기본 카드 이동의 mouse-only 조건과 크기·연결선 처리의 isPrimary 조건을 확인했다. 실제 펜의 pen / isPrimary=false 입력을 확인했다. 카드 본문의 스크롤이 드래그를 취소하는 경로도 보완했다.

`src/pen-bridge.js`는 해당 Canvas의 카드·핸들·선택 영역·연결선·배경에 한해 시작 입력을 전달한다. 이후 이동·해제·취소는 원래 펜 입력을 유지한다. 그리기 모드, 편집 입력, 패널, 마우스·터치는 변환하지 않는다. 펜 본문 끌기의 스크롤 방지는 펜 사용 상태와 Canvas 비그리기 모드에만 적용한다.

우클릭은 5px 이상 이동했을 때 화면 조작으로 전환한다. 짧은 우클릭은 기존 메뉴 처리를 유지한다. Ctrl 해제 시 같은 버튼 누름에서 다른 제스처를 다시 시작하지 않는다. 비활성화·초점 이탈 시 진행 중 native drag를 취소한다.

## 검증 결과

- 실제 Wacom 사용자 확인: 카드 이동·크기, 연결 생성/변경/해제, 편집 종료, 필압, 툴바 없는 단독 작동, 그룹 이름·선택된 내부 빈 공간 이동, 503개 카드 상황, 우클릭/확대 및 Ctrl 해제 순서, 짧은 우클릭 메뉴.
- Node 테스트 18건 통과.
- 실제 Sandbox 자동 검증: native Canvas 이동·크기·연결 처리, 마우스, 다중 선택·그룹, 취소·비활성화, 저장 자료 보존.
- 최종 재시작은 저장된 Canvas와 그림 파일 및 로드된 버전을 비교한다. Release와 BRAT 상태는 실제 GitHub Release 및 작업 증거로 확인한다.

## 작업 환경과 증거

- 저장소: https://github.com/tlatndms2-droid/obsidian-canvas-pen-bridge
- Sandbox: `C:/Users/tlatn/AppData/Local/CanvasPenBridge/20261012-Sandbox`
- 격리 프로필: `C:/Users/tlatn/AppData/Local/CanvasPenBridge/20261012-profile`
- 증거: `C:/Users/tlatn/AppData/Local/CanvasPenBridge/evidence/`
- 백업: Sandbox와 나란한 pretest/before-bridge/before-regression 폴더.

working Vault는 설치·수정하지 않는다. **Computer Use 없이 obsidian-sandbox-validation의 배경 CDP 연결을 사용한다.** 실제 펜과 필압은 사용자가 입력하고 기록과 결과로 확인한다.

Sandbox 창을 정확히 하나 확인해 재사용한다. 포트와 CDP 대상은 현재 실행에서 다시 찾는다. 같은 Vault를 여는 중복 프로필을 만들지 않는다. 기존 시험 자료를 자동 삭제하지 않는다.

## 배포 기준

실제 기능·재시작 검증을 통과한 동일 빌드로 공개 Release를 만든다. main.js, manifest.json, styles.css와 버전 ZIP을 제공하고 공개 파일의 해시를 비교한다. 같은 Sandbox에서 BRAT으로 설치한 버전과 파일도 비교한다.
