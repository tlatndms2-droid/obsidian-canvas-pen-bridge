# Canvas Pen Bridge

Windows Ink를 켠 Wacom 펜으로 Obsidian Canvas 카드를 조작할 수 있게 하는 별도 데스크톱 플러그인입니다. 드로잉 툴바 없이도 작동합니다.

버전: **0.1.0** · 최소 Obsidian: **1.14.4** · 검증 환경: Windows + Wacom, Windows Ink ON.

## 설치

1. Obsidian에서 BRAT을 설치하고 켭니다.
2. BRAT의 **Add a beta plugin**에 `tlatndms2-droid/obsidian-canvas-pen-bridge`를 입력합니다.
3. 커뮤니티 플러그인에서 **Canvas Pen Bridge**를 켭니다.
4. Wacom의 Obsidian 설정에서 Windows Ink를 켠 상태로 Canvas를 사용합니다.

[Release 및 설치 파일](https://github.com/tlatndms2-droid/obsidian-canvas-pen-bridge/releases/tag/0.1.0)

## 사용 방법

| 펜으로 하는 동작 | 결과 |
|---|---|
| 카드 선택 후 끌기 | 카드 이동 |
| 카드 모서리 끌기 | 크기 변경 |
| 카드 연결점에서 다른 카드로 끌기 | 연결선 생성 |
| 기존 연결선 끝을 다른 카드로 끌기 | 연결 대상 변경 |
| 기존 연결선 끝을 빈 공간에 놓기 | 연결 해제 |
| 선택된 그룹의 이름 또는 내부 빈 공간 끌기 | 그룹과 포함 카드 이동 |
| 편집 중 Canvas 빈 공간 누르기 | 편집 종료 후 카드 조작 |
| 펜 우클릭 버튼 한 번 누르기 | 기존 Canvas 컨텍스트 메뉴 |
| 펜 우클릭 버튼을 누른 채 끌기 | 화면 이동 |
| Ctrl + 펜 우클릭 좌우 드래그 | 오른쪽 확대, 왼쪽 축소 |

새 버튼·패널은 없습니다. 마우스는 기존 Canvas 방식으로 사용합니다.

## 드로잉 툴바와 함께 사용

Canvas Drawing Tool Bar가 있다면 기존 펜 아이콘으로 그리기 모드를 전환합니다. 그리기 모드에서는 그 툴바가 입력과 필압을 처리하고 Bridge는 개입하지 않습니다. 그리기를 끄면 Bridge가 카드 조작을 보완합니다. Bridge 자체는 그림 도구를 제공하지 않습니다. 기존 툴바 코드는 수정하지 않았습니다.

## 저장과 호환성

Bridge는 별도 작품 파일이나 새 Canvas 데이터 형식을 만들지 않습니다. 카드·연결선은 기존 저장·실행 취소 처리를 사용합니다. 화면 이동과 확대만으로 카드 자료를 변경하지 않습니다. Bridge를 끄거나 삭제해도 Canvas와 기존 그림 자료는 남습니다.

Obsidian 1.14.4와 실제 Wacom 펜에서 확인했습니다. Canvas 입력 일부는 Obsidian 내부 기능에 의존하므로 다른 Obsidian 버전의 호환성은 별도 확인이 필요합니다.

## 개발

외부 패키지 설치 없이 Node.js로 실행합니다.

```sh
node --test tests/*.test.cjs
node scripts/build.cjs
```

빌드 결과: `dist/main.js`, `dist/manifest.json`, `dist/styles.css`.
검증 내역은 [TEST_MATRIX.md](TEST_MATRIX.md), 인계는 [HANDOFF.md](HANDOFF.md)를 참고하세요.
