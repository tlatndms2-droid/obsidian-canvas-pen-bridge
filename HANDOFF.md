# HANDOFF — Canvas Windows Ink

## Current Goal
Windows Ink ON에서 필압, 펜 카드 조작, 펜 우클릭 Pan, Ctrl+펜 우클릭 Zoom 동시 지원.
## Current Version
미확인. 개발 저장소·기존 버전 미제공.
## Completed
요구사항 확정. **Windows Ink ON + 드로잉 툴바 OFF에서도 기본 Canvas의 카드 이동·크기 조절·연결선 드래그가 실패함**을 사용자 확인.
## In Progress
Windows 펜 이벤트 원인 분석, 공식 API 지원 검증, 최소 변경안 선정, 실기기 검증.
## Decisions
P0: Ink ON·필압·펜 카드 조작·우클릭 Pan·Ctrl 우클릭 Zoom·Vault 보호. P1: 마우스 및 드로잉 분리·재실행 안정성.
## Known Issues
Ink ON 필압 정상/Canvas 펜 드래그 실패. Ink OFF Canvas 조작 정상으로 보고/필압 실패. 원인 미확정. 이벤트 로그 없음.
## Verification
TEST_MATRIX.md. 별도 개발 Vault, 백업, 실제 장치 검증.
## Next Action
1. 버전/펜 버튼 매핑 수집. 2. 기본 Canvas 재현. 3. 제스처/포인터 이벤트와 공식 API 조사. 4. 최소 변경안 보고 및 승인. 5. 구현 후 회귀 검증. 6. HANDOFF·README·버전 갱신.
## Do Not Change
Ink OFF 해결, 필압 제거, `.canvas` 형식 변경, 무관한 데이터 수정, 원인 없는 전역 이벤트 변환, 승인 없는 드로잉 툴바 변경.
## Relevant Files
PLANNING.md, PLANNING_STATE.md, TEST_MATRIX.md, CODEX_TASK.md. 프로젝트 참고 문서 01~08. 최상위 PROJECT_INSTRUCTIONS.md는 현재 확인되지 않음.
