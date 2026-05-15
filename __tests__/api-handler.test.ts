// lib/api-handler.ts 테스트
// withHandler 래퍼의 정상/에러 처리 검증
import { describe, it, expect, vi } from "vitest";
import { withHandler } from "@/lib/api-handler";
import { NextRequest } from "next/server";

// NextRequest 생성 헬퍼
function makeRequest(url = "http://localhost/api/test"): NextRequest {
  return new NextRequest(url);
}

describe("withHandler", () => {
  it("핸들러가 정상 Response를 반환하면 그대로 전달한다", async () => {
    const expected = new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

    const handler = withHandler(async () => expected);
    const result = await handler(makeRequest());

    expect(result.status).toBe(200);
    const body = await result.json();
    expect(body).toEqual({ ok: true });
  });

  it("핸들러가 201 Response를 반환하면 그대로 전달한다", async () => {
    const handler = withHandler(async () => new Response(null, { status: 201 }));
    const result = await handler(makeRequest());

    expect(result.status).toBe(201);
  });

  it("핸들러가 Response 인스턴스를 throw하면 그대로 반환한다 (401)", async () => {
    const unauthorized = new Response("Unauthorized", { status: 401 });
    const handler = withHandler(async () => {
      throw unauthorized;
    });

    const result = await handler(makeRequest());

    expect(result.status).toBe(401);
  });

  it("핸들러가 Response 인스턴스를 throw하면 그대로 반환한다 (403)", async () => {
    const forbidden = new Response("Forbidden", { status: 403 });
    const handler = withHandler(async () => {
      throw forbidden;
    });

    const result = await handler(makeRequest());

    expect(result.status).toBe(403);
  });

  it("핸들러가 일반 Error를 throw하면 500 JSON을 반환한다", async () => {
    const handler = withHandler(async () => {
      throw new Error("DB 연결 실패");
    });

    const result = await handler(makeRequest());

    expect(result.status).toBe(500);
    const body = await result.json();
    expect(body).toHaveProperty("error");
    // err.message는 응답에 포함되지 않아야 함 — 고정 메시지만 반환
    expect(body.error).toBe("서버 내부 오류가 발생했습니다.");
  });

  it("핸들러가 Error 외 값을 throw하면 500 JSON에 기본 메시지가 담긴다", async () => {
    const handler = withHandler(async () => {
      // eslint-disable-next-line @typescript-eslint/no-throw-literal
      throw "문자열 예외";
    });

    const result = await handler(makeRequest());

    expect(result.status).toBe(500);
    const body = await result.json();
    expect(body).toHaveProperty("error");
    // 기본 메시지가 있어야 함
    expect(typeof body.error).toBe("string");
  });
});
