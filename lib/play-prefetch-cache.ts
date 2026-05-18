// 스토리 플레이 선택지 프리페치 캐시
// 서버 메모리에 저장 (재시작 시 초기화됨)
// prefetchId → { choice → Promise<rawReply> }

type PrefetchEntry = {
  promises: Map<string, Promise<string>>;
  createdAt: number;
};

const prefetchCache = new Map<string, PrefetchEntry>();
const TTL_MS = 10 * 60 * 1000; // 10분

/** 만료된 항목 정리 */
function cleanup() {
  const now = Date.now();
  prefetchCache.forEach((entry, key) => {
    if (now - entry.createdAt > TTL_MS) {
      prefetchCache.delete(key);
    }
  });
}

/** 프리페치 항목 등록 */
export function setPrefetchEntry(
  prefetchId: string,
  promises: Map<string, Promise<string>>
): void {
  cleanup();
  prefetchCache.set(prefetchId, { promises, createdAt: Date.now() });
  // TTL 후 자동 삭제
  setTimeout(() => prefetchCache.delete(prefetchId), TTL_MS);
}

/** 특정 선택지의 Promise 조회 */
export function getPrefetchPromise(
  prefetchId: string,
  choice: string
): Promise<string> | null {
  const entry = prefetchCache.get(prefetchId);
  if (!entry) return null;
  return entry.promises.get(choice) ?? null;
}

/** 프리페치 항목 삭제 */
export function deletePrefetchEntry(prefetchId: string): void {
  prefetchCache.delete(prefetchId);
}
