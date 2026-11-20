interface StorageAccess {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
}
export interface QuotaStorage extends StorageAccess {
  transaction<T>(callback: (transaction: StorageAccess) => Promise<T>): Promise<T>;
}
interface ScanUsage {
  minute: number;
  attempts: Record<string, number>;
  day: number;
  dailyTotal: number;
}

export class ScanQuota {
  constructor(private readonly ctx: { storage: QuotaStorage }) {}

  async fetch(request: Request) {
    // The public Worker verifies the grant before making this internal request.
    const user = await request.text();
    const seconds = Math.floor(Date.now() / 1000);
    const minute = Math.floor(seconds / 60);
    const day = Math.floor(seconds / 86400);
    const retryAfter = await this.ctx.storage.transaction(async (tx) => {
      const previous = await tx.get<ScanUsage>("usage");
      const attempts = previous?.minute === minute ? previous.attempts : {};
      const dailyTotal = previous?.day === day ? previous.dailyTotal : 0;
      const count = attempts[user] ?? 0;
      if (dailyTotal >= 120) return 86400 - (seconds % 86400);
      if (count >= 6) return 60 - (seconds % 60);
      attempts[user] = count + 1;
      await tx.put<ScanUsage>("usage", { minute, attempts, day, dailyTotal: dailyTotal + 1 });
      return 0;
    });
    if (retryAfter === 0) return new Response(null, { status: 204 });
    return Response.json(
      { error: "Scan limit reached. Try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfter) },
      },
    );
  }
}
