import { useEffect, useRef } from "react";
import { FileText, Bot, Zap, AppWindow, Plug, MoreHorizontal, ChevronRight, Shield, BookOpen, Lightbulb, AlertCircle, CheckCircle2, UserCheck, Building2, BadgeCheck } from "lucide-react";
import { TRUST_BADGE_META, TRUST_BADGE_ORDER, type TrustBadgeKind } from "../data/badges";

// 배지 안내 섹션용 아이콘 (TrustBadges 컴포넌트와 동일한 아이콘 사용)
const BADGE_GUIDE_ICONS: Record<TrustBadgeKind, React.ReactNode> = {
  REVIEWED: <CheckCircle2 size={13} />,
  VERIFIED: <UserCheck size={13} />,
  OFFICIAL: <Building2 size={13} />,
};

const ASSET_TYPES = [
  {
    type: "프롬프트",
    badge: { bg: "bg-blue-50",    text: "text-blue-600"   },
    icon: <FileText size={15} />,
    desc: "Claude, GPT 등 LLM에 전달할 질문/지시 템플릿입니다. 입력 변수를 채우면 최적화된 프롬프트가 완성됩니다.",
    examples: ["회의록 요약 프롬프트", "고객 응대 답변 생성기", "코드 리뷰 요청 템플릿"],
  },
  {
    type: "맞춤형 AI",
    badge: { bg: "bg-violet-50",  text: "text-violet-600" },
    icon: <Bot size={15} />,
    desc: "특정 역할·지식베이스를 갖춘 AI 어시스턴트입니다. 대화 형태로 반복 사용하며 맥락을 유지합니다.",
    examples: ["IT 헬프데스크 AI", "사내 HR 정책 안내 봇", "법무 검토 도우미"],
  },
  {
    type: "자동화",
    badge: { bg: "bg-orange-50",  text: "text-orange-600" },
    icon: <Zap size={15} />,
    desc: "반복 업무를 자동으로 처리하는 워크플로우입니다. 트리거 조건이 발생하면 정해진 단계를 순서대로 실행합니다.",
    examples: ["신규 계약서 검토 자동화", "승인 알림 발송 워크플로우", "데이터 정제 파이프라인"],
  },
  {
    type: "앱",
    badge: { bg: "bg-emerald-50", text: "text-emerald-600" },
    icon: <AppWindow size={15} />,
    desc: "AI 기능이 내장된 웹 애플리케이션 또는 API 서비스입니다. 브라우저에서 바로 접속하거나 API 키로 연동합니다.",
    examples: ["인사이트 대시보드", "AI 이미지 분석 서비스", "사내 문서 검색 앱"],
  },
  {
    type: "시스템 연결 도구(MCP)",
    badge: { bg: "bg-cyan-50",    text: "text-cyan-600"   },
    icon: <Plug size={15} />,
    desc: "Model Context Protocol 기반으로 AI 에이전트가 외부 시스템에 안전하게 접근할 수 있도록 하는 도구입니다.",
    examples: ["Jira 이슈 조회 MCP", "사내 DB 쿼리 실행 MCP", "파일 시스템 탐색 MCP"],
  },
  {
    type: "기타",
    badge: { bg: "bg-gray-100",   text: "text-gray-600"   },
    icon: <MoreHorizontal size={15} />,
    desc: "위 유형에 속하지 않는 AI 관련 자산입니다. 상세 화면에서 구체적인 형태와 사용 방법을 확인하세요.",
    examples: ["파인튜닝 데이터셋", "평가 벤치마크", "학습 자료 모음"],
  },
];

const STEPS = [
  { n: "01", label: "탐색",    desc: "AI Playground에서 원하는 자산을 검색하거나 유형 필터로 둘러봅니다." },
  { n: "02", label: "확인",    desc: "자산 카드를 클릭해 상세 화면에서 기능, 제한 사항, 비용, 데이터 처리 방식을 확인합니다." },
  { n: "03", label: "사용",    desc: "유형에 따라 복사, 접속, 실행 등의 방법으로 자산을 바로 활용합니다." },
  { n: "04", label: "즐겨찾기", desc: "자주 쓰는 자산은 ★을 눌러 저장하고 내 도구함에서 빠르게 접근합니다." },
  { n: "05", label: "피드백",  desc: "문제가 있거나 개선이 필요하면 상세 화면 하단의 오류 제보를 활용합니다." },
];

const USAGE_AFTER_APPROVAL = [
  { type: "프롬프트",     usage: "원문을 복사해서 바로 사용" },
  { type: "맞춤형 AI",     usage: "승인된 링크로 접속해서 사용" },
  { type: "자동화",       usage: "안내에 따라 설치하거나, 승인된 워크플로를 실행" },
  { type: "브라우저 앱",   usage: "플랫폼 안에서 바로 실행" },
  { type: "백엔드 앱",     usage: "승인된 서비스 주소로 이동해서 사용" },
  { type: "MCP",         usage: "안내된 절차대로 연결하고 기능 사용" },
  { type: "기타",         usage: "열람하거나 다운로드" },
];

const NOTICES = [
  { icon: <Shield size={13} />, text: "조건부 승인 자산은 사용 전 부서장 또는 보안팀의 별도 확인이 필요할 수 있습니다." },
  { icon: <AlertCircle size={13} />, text: "외부 API를 호출하는 자산은 사용량에 따라 비용이 발생할 수 있습니다. 비용 정보를 반드시 확인하세요." },
  { icon: <AlertCircle size={13} />, text: "개인정보 및 기밀 데이터를 입력할 때는 해당 자산의 데이터 처리 방식을 먼저 확인하세요." },
];

function SectionCard({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-md overflow-hidden">
      <div className="px-6 py-4 border-b border-border">
        <h2 className="text-[15px] font-semibold text-foreground">{title}</h2>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

export default function PlaygroundGuideScreen({
  scrollTarget,
  onScrolled,
}: {
  scrollTarget?: string | null;
  onScrolled?: () => void;
} = {}) {
  const badgeSectionRef = useRef<HTMLDivElement>(null);

  // 배지 클릭으로 진입한 경우("badges") 배지 안내 섹션으로 스크롤
  useEffect(() => {
    if (scrollTarget === "badges" && badgeSectionRef.current) {
      badgeSectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      onScrolled?.();
    }
  }, [scrollTarget, onScrolled]);

  return (
    <div className="px-10 py-8">
      <div className="mb-6">
        <h1 className="text-[22px] font-semibold text-foreground tracking-tight">Playground 가이드</h1>
        <p className="text-[13px] text-muted-foreground mt-1">DAOU AX Playground를 처음 사용하는 분을 위한 안내입니다.</p>
      </div>

      <div className="flex flex-col gap-5 max-w-[900px] mx-auto">
        {/* Playground 소개 */}
        <SectionCard title={<span className="flex items-center gap-2"><BookOpen size={15} /> Playground란?</span>}>
          <p className="text-[13px] text-foreground leading-relaxed">
            DAOU AX Playground는 사내에서 검증된 AI 자산을 한 곳에서 탐색하고 바로 사용할 수 있는 AI 자산 마켓플레이스입니다.
            등록된 자산은 거버넌스 심의를 거쳐 품질·보안·비용 기준을 충족한 경우에만 카탈로그에 공개됩니다.
          </p>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {[
              { label: "탐색 및 검색",   desc: "유형·키워드로 원하는 AI 자산을 빠르게 찾습니다." },
              { label: "즉시 사용",       desc: "별도 설정 없이 복사, 접속, 실행으로 바로 활용합니다." },
              { label: "도구함 관리",     desc: "자주 쓰는 자산을 즐겨찾기로 저장하고 관리합니다." },
            ].map(c => (
              <div key={c.label} className="bg-muted/40 rounded-md p-3.5">
                <p className="text-[12px] font-semibold text-foreground mb-1">{c.label}</p>
                <p className="text-[12px] text-muted-foreground leading-relaxed">{c.desc}</p>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* 사용 순서 */}
        <SectionCard title={<span className="flex items-center gap-2"><ChevronRight size={15} /> 이렇게 사용하세요</span>}>
          <ol className="flex flex-col gap-3">
            {STEPS.map((s, i) => (
              <li key={s.n} className="flex items-start gap-3">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 text-primary text-[11px] font-semibold flex items-center justify-center" style={{ fontFamily: "'DM Mono', monospace" }}>
                  {s.n}
                </span>
                <div className="pt-0.5">
                  <span className="text-[13px] font-medium text-foreground">{s.label} — </span>
                  <span className="text-[13px] text-muted-foreground">{s.desc}</span>
                </div>
                {i < STEPS.length - 1 && <div className="hidden" />}
              </li>
            ))}
          </ol>
        </SectionCard>

        {/* 자산 유형 안내 */}
        <SectionCard title={<span className="flex items-center gap-2"><Lightbulb size={15} /> 자산 유형 안내</span>}>
          <div className="flex flex-col gap-4">
            {ASSET_TYPES.map(t => (
              <div key={t.type} className="flex gap-4 items-start">
                <div className="flex-shrink-0 pt-0.5">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[12px] font-medium ${t.badge.bg} ${t.badge.text}`}>
                    {t.icon}
                    {t.type}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-foreground leading-relaxed">{t.desc}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">예: {t.examples.join(", ")}</p>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* 배지 안내 */}
        <div ref={badgeSectionRef} className="scroll-mt-6">
          <SectionCard title={<span className="flex items-center gap-2"><BadgeCheck size={15} /> 배지 안내</span>}>
            <p className="text-[13px] text-muted-foreground leading-relaxed mb-4">
              자산 카드와 상세 화면의 이름 옆 배지는 그 자산이 어떤 확인을 거쳤는지 알려줍니다.
            </p>
            <div className="flex flex-col gap-3">
              {TRUST_BADGE_ORDER.map(kind => {
                const meta = TRUST_BADGE_META[kind];
                return (
                  <div key={kind} className="flex items-start gap-4">
                    <div className="flex-shrink-0 pt-0.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] font-medium ${meta.cls}`}>
                        {BADGE_GUIDE_ICONS[kind]}
                        {meta.label}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-foreground">{meta.fullName}</p>
                      <p className="text-[12px] text-muted-foreground mt-0.5">{meta.meaning}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] text-muted-foreground mt-4 pt-3 border-t border-border">
              ‘활용 검증’과 ‘공식 예시’는 한 자산에 함께 붙지 않습니다. ‘심의 통과’는 게시된 모든 자산에 표시됩니다.
            </p>
          </SectionCard>
        </div>

        {/* 승인 후 사용 방식 */}
        <SectionCard title={<span className="flex items-center gap-2"><CheckCircle2 size={15} /> 승인 후 이렇게 사용해요</span>}>
          <div className="rounded-md border border-border overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide px-4 py-3 whitespace-nowrap">유형</th>
                  <th className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide px-4 py-3">승인 후 실제 사용 방식</th>
                </tr>
              </thead>
              <tbody>
                {USAGE_AFTER_APPROVAL.map(row => (
                  <tr key={row.type} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 text-[12px] font-medium text-foreground whitespace-nowrap">{row.type}</td>
                    <td className="px-4 py-3 text-[12px] text-muted-foreground">{row.usage}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        {/* 주의 사항 */}
        <SectionCard title={<span className="flex items-center gap-2"><Shield size={15} /> 사용 전 주의 사항</span>}>
          <ul className="flex flex-col gap-2.5">
            {NOTICES.map((n, i) => (
              <li key={i} className="flex items-start gap-2.5 text-[13px] text-foreground leading-relaxed">
                <span className="flex-shrink-0 mt-0.5 text-muted-foreground">{n.icon}</span>
                {n.text}
              </li>
            ))}
          </ul>
          <div className="mt-4 p-3.5 rounded-md bg-primary/5 border border-primary/20">
            <p className="text-[12px] text-primary font-medium">문의 및 자산 등록</p>
            <p className="text-[12px] text-muted-foreground mt-1">
              신규 AI 자산을 등록하거나 플랫폼 사용 관련 문의는 DAOU AX 운영팀 채널로 연락해 주세요.
              자산 등록 가이드는 운영자 메뉴에서 확인할 수 있습니다.
            </p>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
