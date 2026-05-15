"use client";

// 시작설정 모달 — 스토리 플레이 전 캐릭터/세력 설정
// crack.wrtn.ai 무림영웅전 UI/UX 참고하여 구현
import { useState } from "react";

// ─────────────────────────────────────────────
// 타입
// ─────────────────────────────────────────────

export type FactionType = "정파" | "사파" | "마교" | "독립";
export type GenderType = "남" | "여";

export type PlayerSetup = {
  name: string;          // 캐릭터 이름
  gender: GenderType;    // 성별
  factionType: FactionType; // 정파/사파/마교/독립
  faction: string;       // 구체적 세력명 (예: 화산파)
  background: string;    // 출신 배경 (선택)
};

type Props = {
  storyTitle: string;
  genre: string[];       // 장르 배열 (무협 여부 판단용)
  onConfirm: (setup: PlayerSetup) => void;
};

// ─────────────────────────────────────────────
// 무협 세력 목록
// ─────────────────────────────────────────────

const WUXIA_FACTIONS: Record<FactionType, { label: string; list: string[] }> = {
  정파: {
    label: "정파 (正派)",
    list: ["화산파", "무당파", "소림사", "개방", "남궁세가", "하북팽가", "태산파", "공동파"],
  },
  사파: {
    label: "사파 (邪派)",
    list: ["귀도", "혈교", "독룡문", "흑도련", "사천당가", "오독교"],
  },
  마교: {
    label: "마교 (魔敎)",
    list: ["명교", "일월신교", "흑마교", "혈마교"],
  },
  독립: {
    label: "독립 (獨立)",
    list: ["강호 떠돌이", "무소속 협객", "은거 고수", "상단 호위"],
  },
};

// 무협이 아닌 경우 범용 세력
const GENERIC_FACTIONS: Record<FactionType, { label: string; list: string[] }> = {
  정파: { label: "선의 세력", list: ["왕국 기사단", "빛의 교단", "수호대", "성도회"] },
  사파: { label: "악의 세력", list: ["암흑 길드", "도적단", "저주받은 자들", "지하 조직"] },
  마교: { label: "신비 세력", list: ["마법사 협회", "고대 비밀결사", "금지된 주술단"] },
  독립: { label: "독립", list: ["떠돌이 모험가", "용병", "무소속", "은둔자"] },
};

// ─────────────────────────────────────────────
// 색상 설정
// ─────────────────────────────────────────────

const FACTION_COLORS: Record<FactionType, string> = {
  정파: "border-blue-500/60 bg-blue-500/10 text-blue-300",
  사파: "border-red-500/60 bg-red-500/10 text-red-300",
  마교: "border-purple-500/60 bg-purple-500/10 text-purple-300",
  독립: "border-gray-500/60 bg-gray-500/10 text-gray-300",
};

const FACTION_ACTIVE: Record<FactionType, string> = {
  정파: "border-blue-400 bg-blue-500/20",
  사파: "border-red-400 bg-red-500/20",
  마교: "border-purple-400 bg-purple-500/20",
  독립: "border-gray-400 bg-gray-500/20",
};

// ─────────────────────────────────────────────
// 컴포넌트
// ─────────────────────────────────────────────

export function StartSettingsModal({ storyTitle, genre, onConfirm }: Props) {
  const isWuxia = genre.includes("무협");
  const factionData = isWuxia ? WUXIA_FACTIONS : GENERIC_FACTIONS;

  const [name, setName] = useState("");
  const [gender, setGender] = useState<GenderType>("남");
  const [factionType, setFactionType] = useState<FactionType>("정파");
  const [faction, setFaction] = useState(factionData["정파"].list[0]);
  const [background, setBackground] = useState("");
  const [step, setStep] = useState<1 | 2>(1); // 1=세력, 2=캐릭터

  // 세력 타입 변경 시 faction 초기화
  function handleFactionTypeChange(ft: FactionType) {
    setFactionType(ft);
    setFaction(factionData[ft].list[0]);
  }

  function handleConfirm() {
    const finalName = name.trim() || (gender === "남" ? "이름 없는 협객" : "이름 없는 여협");
    onConfirm({
      name: finalName,
      gender,
      factionType,
      faction,
      background: background.trim(),
    });
  }

  const canProceed = step === 1 ? true : true; // 이름은 선택

  return (
    // 오버레이
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4">
      <div className="bg-bg2 border border-bg3 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
        {/* 헤더 */}
        <div className="px-6 py-5 border-b border-bg3">
          <p className="text-xs text-t2 mb-1">시작 설정</p>
          <h2 className="text-t1 font-bold text-base truncate">{storyTitle}</h2>
        </div>

        {/* 단계 표시 */}
        <div className="flex px-6 pt-4 gap-2">
          {[1, 2].map((s) => (
            <div
              key={s}
              className={[
                "flex-1 h-1 rounded-full transition-all",
                s <= step ? "bg-red" : "bg-bg3",
              ].join(" ")}
            />
          ))}
        </div>

        {/* 스텝 1: 세력 선택 */}
        {step === 1 && (
          <div className="px-6 py-5">
            <p className="text-t1 font-semibold text-sm mb-4">
              {isWuxia ? "어느 세력에서 시작하시겠습니까?" : "어느 세력에 속하시겠습니까?"}
            </p>

            {/* 세력 타입 선택 */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              {(Object.keys(factionData) as FactionType[]).map((ft) => (
                <button
                  key={ft}
                  type="button"
                  onClick={() => handleFactionTypeChange(ft)}
                  className={[
                    "py-3 px-4 rounded-xl border text-sm font-medium transition-all text-left",
                    factionType === ft
                      ? FACTION_ACTIVE[ft]
                      : "border-bg3 bg-bg text-t2 hover:border-t2/50",
                  ].join(" ")}
                >
                  <span className={factionType === ft ? FACTION_COLORS[ft].split(" ").pop() : ""}>
                    {factionData[ft].label}
                  </span>
                </button>
              ))}
            </div>

            {/* 구체적 세력 선택 */}
            <p className="text-xs text-t2 mb-2">구체적 소속</p>
            <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto scrollbar-hide">
              {factionData[factionType].list.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFaction(f)}
                  className={[
                    "py-2 px-3 rounded-lg border text-sm transition-all text-left",
                    faction === f
                      ? `${FACTION_COLORS[factionType]} font-semibold`
                      : "border-bg3 text-t2 hover:bg-bg3",
                  ].join(" ")}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 스텝 2: 캐릭터 설정 */}
        {step === 2 && (
          <div className="px-6 py-5 space-y-4">
            <p className="text-t1 font-semibold text-sm">캐릭터를 설정하세요</p>

            {/* 성별 */}
            <div>
              <p className="text-xs text-t2 mb-2">성별</p>
              <div className="flex gap-2">
                {(["남", "여"] as GenderType[]).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGender(g)}
                    className={[
                      "flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all",
                      gender === g
                        ? "border-red bg-red/10 text-red"
                        : "border-bg3 text-t2 hover:bg-bg3",
                    ].join(" ")}
                  >
                    {g === "남" ? "남 (男)" : "여 (女)"}
                  </button>
                ))}
              </div>
            </div>

            {/* 이름 */}
            <div>
              <p className="text-xs text-t2 mb-2">이름 (선택)</p>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={gender === "남" ? "이름 없는 협객" : "이름 없는 여협"}
                maxLength={12}
                className="w-full bg-bg border border-bg3 rounded-xl px-4 py-2.5 text-sm text-t1 placeholder:text-t2 outline-none focus:border-red/50 transition-colors"
              />
            </div>

            {/* 배경 (선택) */}
            <div>
              <p className="text-xs text-t2 mb-2">출신 배경 (선택)</p>
              <textarea
                value={background}
                onChange={(e) => setBackground(e.target.value)}
                placeholder={
                  isWuxia
                    ? "예: 평범한 농가 출신, 어릴 때부터 무공에 뜻을 품었다..."
                    : "캐릭터의 배경 이야기를 간략히 작성하세요..."
                }
                rows={3}
                maxLength={200}
                className="w-full bg-bg border border-bg3 rounded-xl px-4 py-2.5 text-sm text-t1 placeholder:text-t2 outline-none focus:border-red/50 transition-colors resize-none"
              />
            </div>

            {/* 선택된 세력 표시 */}
            <div className={`py-2.5 px-4 rounded-xl border text-sm ${FACTION_COLORS[factionType]}`}>
              <span className="opacity-70 mr-2">세력:</span>
              <span className="font-semibold">{faction}</span>
              <span className="opacity-60 ml-2">({factionData[factionType].label})</span>
            </div>
          </div>
        )}

        {/* 버튼 */}
        <div className="px-6 pb-6 flex gap-3">
          {step === 2 && (
            <button
              type="button"
              onClick={() => setStep(1)}
              className="flex-1 py-3 rounded-xl border border-bg3 text-t2 text-sm hover:bg-bg3 transition-colors"
            >
              이전
            </button>
          )}
          {step === 1 && (
            <button
              type="button"
              onClick={() => setStep(2)}
              disabled={!canProceed}
              className="flex-1 py-3 rounded-xl bg-red text-white text-sm font-semibold hover:bg-red/90 transition-colors disabled:opacity-50"
            >
              다음
            </button>
          )}
          {step === 2 && (
            <button
              type="button"
              onClick={handleConfirm}
              className="flex-1 py-3 rounded-xl bg-red text-white text-sm font-semibold hover:bg-red/90 transition-colors"
            >
              플레이 시작
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
