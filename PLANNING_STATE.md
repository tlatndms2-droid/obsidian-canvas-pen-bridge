# Planning State
- 단계: 요구사항 확정 / Codex 기술 검증 대기

| ID | 내용 | 상태 | 우선순위 |
|---|---|---|---|
| D01 | Windows Ink ON 유지 | 확정 | P0 |
| D02 | 필압 유지 | 확정 | P0 |
| D03 | 펜 카드 선택·이동·크기·연결 | 확정 | P0 |
| D04 | 펜 우클릭 드래그 Pan | 확정 | P0 |
| D05 | Ctrl+펜 우클릭 드래그 Zoom | 확정 | P0 |
| D06 | 원본 데이터·마우스 동작 보존 | 확정 | P0 |
| D07 | 구현 방법 | 미결정 | P0 |
| D08 | Zoom 방향·감도 | 기존 조작과 호환성 검증 필요 | P1 |

## Codex가 검증할 미확인 사항
- 이벤트가 중단되는 단계(pointerdown/move/up/cancel, pointerType, pressure, capture, preventDefault, stopPropagation, MouseEvent 차이)
- 공식 API 지원 여부 및 비공식 접근의 안정성
- Obsidian/Wacom 드라이버/드로잉 툴바 버전
- 우클릭 버튼 매핑, Windows 펜 제스처 및 컨텍스트 메뉴 충돌

## 위험
비공식 Canvas 내부 의존, 포인터 이벤트 오작동, Vault 데이터 손상. 별도 Vault·백업·파일 비교·회귀 테스트로 대응.

## 다음 질문
사용자에게 추가 기능 질문 없음. Codex가 기술 검증부터 진행.
