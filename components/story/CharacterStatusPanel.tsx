"use client";

// 캐릭터 STATUS 패널
// crack.wrtn.ai 무림영웅전 STATUS 패널 참고 구현
// 우측 슬라이드 패널 — 접기/펼치기 가능
import { useState } from "react";

// ─────────────────────────────────────────────
// 타입
// ─────────────────────────────────────────────

export type CharacterStatus = {
  name: string;          // 이름
  gender: string;        // 성별 (남/여)
  age: number;           // 나이
  nickname: string;      // 별호
  level: string;         // 경지
  internalPower: number; // 내공
  fame: number;          // 명성
  faction: string;       // 세력
  position: string;      // 직책
  skills: {
    fist: string;        // 권법
    mind: string;        // 심법
    lightness: string;   // 경공
  };
  inventory: string[];   // 소지품
  relationships: string[]; // 의연
  stage: string;         // 입무
  location: string;      // 위치
  traits: string[];      // 특징
};

export const DEFAULT_STATUS: CharacterStatus = {
  name: "이름 없는 자",
  gender: "남",
  age: 0,
  nickname: "없음",
  level: "범인",
  internalPower: 0,
  fame: 0,
  faction: "",
  position: "",
  skills: { fist: "", mind: "", lightness: "" },
  inventory: [],
  relationships: [],
  stage: "캐릭터 생성",
  location: "",
  traits: [],
};

type Props = {
  status: CharacterStatus;
  turnCount: number;
  isOpen: boolean;
  onToggle: () => void;
};

// ─────────────────────────────────────────────
// 스탯 행 컴포넌트
// ─────────────────────────────────────────────

function StatRow({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string | number;
  highlight?: boolean;
}) {
  const isEmpty = value === "" || value === 0;
  return (
    <div className="flex items-baseline gap-1.5 py-0.5">
      <span className="text-t2 text-xs shrink-0 w-14">{label}</span>
      <span className="text-t2 text-xs opacity-50">|</span>
      <span
        className={[
          "text-xs",
          isEmpty ? "text-t2/40" : highlight ? "text-red font-semibold" : "text-t1",
        ].join(" ")}
      >
        {isEmpty ? "—" : String(value)}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────
// 섹션 구분선
// ─────────────────────────────────────────────

function Divider() {
  return <div className="border-t border-bg3/50 my-2" />;
}

// ─────────────────────────────────────────────
// 메인 컴포넌트
// ─────────────────────────────────────────────

export function CharacterStatusPanel({ status, turnCount, isOpen, onToggle }: Props) {
  // 숫자 값 포맷: 양수면 초록, 음수면 빨간색으로 표시
  const powerDisplay =
    status.internalPower > 0
      ? `${status.internalPower}`
      : status.internalPower < 0
        ? `${status.internalPower}`
        : "0";

  const fameDisplay = `${status.fame}`;

  return (
    <>
      {/* 토글 버튼 (항상 표시) */}
      <button
        type="button"
        onClick={onToggle}
        aria-label={isOpen ? "STATUS 패널 닫기" : "STATUS 패널 열기"}
        className={[
          "fixed right-0 top-1/2 -translate-y-1/2 z-30",
          "w-7 h-20 bg-bg2 border border-r-0 border-bg3 rounded-l-xl",
          "flex items-center justify-center text-t2 hover:text-t1 hover:bg-bg3 transition-all",
          isOpen ? "right-64" : "right-0",
        ].join(" ")}
        style={{ transition: "right 300ms ease" }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={isOpen ? "rotate-0" : "rotate-180"}
          style={{ transition: "transform 300ms ease" }}
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>

      {/* 패널 본체 */}
      <div
        className={[
          "fixed right-0 top-0 h-full z-20 w-64",
          "bg-bg2/95 backdrop-blur-sm border-l border-bg3",
          "overflow-y-auto scrollbar-hide",
          "transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "translate-x-full",
        ].join(" ")}
      >
        <div className="p-4">
          {/* 헤더 */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-t2 text-xs font-mono font-semibold tracking-widest">STATUS</span>
            <span className="text-t2/50 text-xs font-mono">{turnCount}</span>
          </div>

          {/* 기본 정보 */}
          <div className="mb-2">
            <p className="text-t1 text-xs font-semibold">
              [{status.name}][{status.gender}][{status.age}세]
            </p>
          </div>

          <StatRow label="별호" value={`'${status.nickname}'`} />
          <StatRow label="경지" value={status.level} highlight />
          <StatRow label="내공" value={powerDisplay} highlight={status.internalPower > 0} />
          <StatRow label="명성" value={fameDisplay} />

          <Divider />

          <StatRow label="세력" value={status.faction} />
          <StatRow label="직책" value={status.position} />

          <Divider />

          {/* 무공 */}
          <p className="text-t2/50 text-xs font-mono mb-1">[무공]</p>
          <StatRow label="권법" value={status.skills.fist} />
          <StatRow label="심법" value={status.skills.mind} />
          <StatRow label="경공" value={status.skills.lightness} />

          <Divider />

          {/* 소지품 */}
          <p className="text-t2/50 text-xs font-mono mb-1">[소지품]</p>
          {status.inventory.length > 0 ? (
            status.inventory.map((item, i) => (
              <p key={i} className="text-t1 text-xs py-0.5">
                · {item}
              </p>
            ))
          ) : (
            <p className="text-t2/40 text-xs py-0.5">—</p>
          )}

          <Divider />

          {/* 의연 (인간관계) */}
          <p className="text-t2/50 text-xs font-mono mb-1">[의연]</p>
          {status.relationships.length > 0 ? (
            status.relationships.map((rel, i) => (
              <p key={i} className="text-t1 text-xs py-0.5">
                · {rel}
              </p>
            ))
          ) : (
            <p className="text-t2/40 text-xs py-0.5">—</p>
          )}

          <Divider />

          <StatRow label="입무" value={status.stage} />
          <StatRow label="위치" value={status.location} />

          {/* 특징 */}
          {status.traits.length > 0 && (
            <>
              <Divider />
              <p className="text-t2/50 text-xs font-mono mb-1">[특징]</p>
              {status.traits.map((trait, i) => (
                <p key={i} className="text-t1 text-xs py-0.5">
                  · {trait}
                </p>
              ))}
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────
// STATUS 업데이트 파서
// AI 응답의 [STATUS_UPDATE]...[/STATUS_UPDATE] 섹션을 파싱하여
// 기존 status에 병합
// ─────────────────────────────────────────────

export function parseStatusUpdate(
  raw: string,
  current: CharacterStatus
): CharacterStatus {
  const match = raw.match(/\[STATUS_UPDATE\]([\s\S]*?)\[\/STATUS_UPDATE\]/);
  if (!match) return current;

  const updated = { ...current, skills: { ...current.skills } };
  const lines = match[1].trim().split("\n");

  for (const line of lines) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const val = line.slice(colonIdx + 1).trim();
    if (!key || !val) continue;

    // 숫자 증감 처리 (+5, -3) 또는 절대값
    const numParsed = parseFloat(val.replace(/[^0-9+\-.]/g, ""));
    const isRelative = val.startsWith("+") || val.startsWith("-");

    switch (key) {
      case "이름":
        updated.name = val;
        break;
      case "성별":
        updated.gender = val;
        break;
      case "나이":
        updated.age = isRelative
          ? updated.age + numParsed
          : isNaN(numParsed) ? updated.age : numParsed;
        break;
      case "별호":
        updated.nickname = val.replace(/^'|'$/g, "");
        break;
      case "경지":
        updated.level = val;
        break;
      case "내공":
        updated.internalPower = isRelative
          ? updated.internalPower + numParsed
          : isNaN(numParsed) ? updated.internalPower : numParsed;
        break;
      case "명성":
        updated.fame = isRelative
          ? updated.fame + numParsed
          : isNaN(numParsed) ? updated.fame : numParsed;
        break;
      case "세력":
        updated.faction = val;
        break;
      case "직책":
        updated.position = val;
        break;
      case "권법":
        updated.skills.fist = val;
        break;
      case "심법":
        updated.skills.mind = val;
        break;
      case "경공":
        updated.skills.lightness = val;
        break;
      case "소지품추가":
        if (!updated.inventory.includes(val)) {
          updated.inventory = [...updated.inventory, val];
        }
        break;
      case "소지품제거":
        updated.inventory = updated.inventory.filter((i) => i !== val);
        break;
      case "의연추가":
        if (!updated.relationships.includes(val)) {
          updated.relationships = [...updated.relationships, val];
        }
        break;
      case "입무":
        updated.stage = val;
        break;
      case "위치":
        updated.location = val;
        break;
      case "특징추가":
        if (!updated.traits.includes(val)) {
          updated.traits = [...updated.traits, val];
        }
        break;
    }
  }

  return updated;
}

// ─────────────────────────────────────────────
// AI 응답 전체 파서
// [STORY], [STATUS_UPDATE], [CHOICES] 섹션 분리
// ─────────────────────────────────────────────

export function parseAIResponse(raw: string): {
  story: string;
  rawStatus: string;
  choices: string[];
} {
  // [STORY] 섹션 추출
  const storyMatch = raw.match(/\[STORY\]([\s\S]*?)\[\/STORY\]/);
  const story = storyMatch ? storyMatch[1].trim() : raw;

  // [STATUS_UPDATE] 섹션 추출 (파싱은 parseStatusUpdate에서)
  const statusMatch = raw.match(/\[STATUS_UPDATE\]([\s\S]*?)\[\/STATUS_UPDATE\]/);
  const rawStatus = statusMatch ? raw : "";

  // [CHOICES] 섹션 추출
  const choicesMatch = raw.match(/\[CHOICES\]([\s\S]*?)\[\/CHOICES\]/);
  const choices: string[] = [];
  if (choicesMatch) {
    choicesMatch[1]
      .trim()
      .split("\n")
      .forEach((line) => {
        const clean = line.replace(/^[-*\d.]\s*/, "").trim();
        if (clean) choices.push(clean);
      });
  }

  return { story, rawStatus, choices };
}
