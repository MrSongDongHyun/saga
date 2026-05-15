// Socket.IO 서버 — 3001 포트
// 채팅 세션 room 기능 포함
// 이벤트:
//   client → server: "join-session"  { sessionId: string }
//   client → server: "leave-session" { sessionId: string }
//   server → client: "message"       { message: MessageItem }
//   server → client: "error"         { message: string }
import { createServer } from "http";
import { Server, Socket } from "socket.io";

const PORT = 3001;

// ─────────────────────────────────────────────
// 타입 정의
// ─────────────────────────────────────────────

/** 클라이언트로 전송하는 메시지 아이템 (API 응답과 동일 구조) */
type MessageItem = {
  id: string;
  sessionId: string;
  role: string; // "USER" | "ASSISTANT" | "SYSTEM"
  content: string;
  createdAt: string;
};

/** join-session 이벤트 페이로드 */
type JoinSessionPayload = {
  sessionId: string;
};

/** leave-session 이벤트 페이로드 */
type LeaveSessionPayload = {
  sessionId: string;
};

// ─────────────────────────────────────────────
// 서버 초기화
// ─────────────────────────────────────────────

const httpServer = createServer();

export const io = new Server(httpServer, {
  cors: {
    origin: process.env.NEXTAUTH_URL ?? "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// ─────────────────────────────────────────────
// 연결 이벤트 핸들러
// ─────────────────────────────────────────────

io.on("connection", (socket: Socket) => {
  console.log(`[socket] 클라이언트 연결됨: ${socket.id}`);

  // ── join-session: 특정 채팅 세션 room 입장 ──
  socket.on("join-session", (payload: unknown) => {
    const sessionId = extractSessionId(payload);

    if (!sessionId) {
      socket.emit("error", { message: "유효하지 않은 세션 ID입니다." });
      return;
    }

    const roomName = sessionRoom(sessionId);
    socket.join(roomName);
    console.log(`[socket] ${socket.id} → room 입장: ${roomName}`);
  });

  // ── leave-session: 채팅 세션 room 퇴장 ──
  socket.on("leave-session", (payload: unknown) => {
    const sessionId = extractSessionId(payload);

    if (!sessionId) {
      socket.emit("error", { message: "유효하지 않은 세션 ID입니다." });
      return;
    }

    const roomName = sessionRoom(sessionId);
    socket.leave(roomName);
    console.log(`[socket] ${socket.id} → room 퇴장: ${roomName}`);
  });

  // ── disconnect ──
  socket.on("disconnect", () => {
    console.log(`[socket] 클라이언트 연결 해제: ${socket.id}`);
  });
});

// ─────────────────────────────────────────────
// 유틸리티
// ─────────────────────────────────────────────

/** 채팅 세션 room 이름 생성 규칙 */
function sessionRoom(sessionId: string): string {
  return `session:${sessionId}`;
}

/** 페이로드에서 sessionId 안전하게 추출 */
function extractSessionId(
  payload: unknown
): string | null {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "sessionId" in payload &&
    typeof (payload as JoinSessionPayload | LeaveSessionPayload).sessionId === "string" &&
    (payload as JoinSessionPayload | LeaveSessionPayload).sessionId.trim().length > 0
  ) {
    return (payload as JoinSessionPayload).sessionId.trim();
  }
  return null;
}

// ─────────────────────────────────────────────
// 공개 함수: AI 응답 완료 후 room에 메시지 broadcast
// (Next.js API Route는 별도 프로세스이므로 직접 호출 불가;
//  향후 Redis pub/sub 또는 동일 프로세스 구성 시 활용)
// ─────────────────────────────────────────────

/**
 * 특정 채팅 세션 room의 모든 클라이언트에게 메시지 이벤트 전송
 * @param sessionId  대상 세션 ID
 * @param message    전송할 메시지 아이템
 */
export function emitMessageToSession(
  sessionId: string,
  message: MessageItem
): void {
  const roomName = sessionRoom(sessionId);
  io.to(roomName).emit("message", { message });
  console.log(`[socket] 메시지 emit → ${roomName}: ${message.id}`);
}

// ─────────────────────────────────────────────
// 서버 기동
// ─────────────────────────────────────────────

httpServer.listen(PORT, () => {
  console.log(`[socket] Socket.IO 서버 실행 중 → http://localhost:${PORT}`);
});
