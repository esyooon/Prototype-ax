import type { SelfDiagnosisAnswers } from "./types";

// 등록자 자가진단 질문 — AssetRegisterScreen(등록 마법사)과 GovernanceScreen(운영자 심의 상세)
// 양쪽에서 동일한 문구를 참조하도록 공용 파일로 분리했습니다.
export const DIAG_QUESTIONS: { key: keyof SelfDiagnosisAnswers; q: string; example: string; why: string }[] = [
  {
    key: "q1",
    q: "개인정보나 중요한 회사 정보를 다루나요?",
    example: "예: 직원 이름·연락처, 계약 금액, 고객 정보",
    why: "민감한 정보가 외부에 유출되거나 부적절하게 처리될 위험이 있어 심의가 필요합니다.",
  },
  {
    key: "q2",
    q: "회사 밖의 AI나 서비스로 데이터를 보내나요?",
    example: "예: Gemini API 호출, OpenAI API 전송, 외부 SaaS 연동",
    why: "외부 서비스로 사내 데이터가 전송되면 데이터 주권과 보안 정책을 검토해야 합니다.",
  },
  {
    key: "q3",
    q: "회사 시스템이나 문서를 계정 권한으로 읽나요?",
    example: "예: Google Drive 문서 조회, Confluence 페이지 읽기",
    why: "사내 자산에 접근하는 경우 권한 범위와 감사 추적이 필요합니다.",
  },
  {
    key: "q4",
    q: "메일 발송, 문서 수정, 삭제, 일정 등록 같은 동작을 하나요?",
    example: "예: 이메일 자동 발송, 문서 내용 수정, 캘린더 일정 생성",
    why: "쓰기 동작은 되돌리기 어려운 변경을 일으킬 수 있어 더 엄격한 검토가 필요합니다.",
  },
  {
    key: "q5",
    q: "사람이 확인하지 않아도 다음 단계까지 자동으로 실행되나요?",
    example: "예: AI가 판단해서 직접 메일 발송, 승인 없이 문서 등록",
    why: "완전 자동 실행은 오작동 시 영향 범위가 커서 별도 안전장치가 필요합니다.",
  },
  {
    key: "q6",
    q: "정해진 시간이나 조건에 따라 반복 실행되나요?",
    example: "예: 매일 오전 9시 실행, 폼 제출 시 자동 트리거",
    why: "반복 실행은 누적 영향이 크고 모니터링 체계가 필요합니다.",
  },
];
