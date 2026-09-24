import type { ScheduleData, TimeBlock } from "./schedule";

export interface ScheduleRepository {
  getAll(): Promise<ScheduleData>;
  saveAll(data: ScheduleData): Promise<void>;
}

const STORAGE_KEY = "daily-timeline:schedule:v1";
const EMPTY_DATA: ScheduleData = { version: 1, blocks: [] };

function isTimeBlock(value: unknown): value is TimeBlock {
  if (!value || typeof value !== "object") return false;
  const block = value as Partial<TimeBlock>;
  return ["id", "date", "title", "startTime", "endTime", "note", "createdAt", "updatedAt"].every(
    (key) => typeof block[key as keyof TimeBlock] === "string",
  );
}

export function parseScheduleData(value: unknown): ScheduleData {
  if (!value || typeof value !== "object") throw new Error("文件格式无效");
  const data = value as Partial<ScheduleData>;
  if (data.version !== 1 || !Array.isArray(data.blocks) || !data.blocks.every(isTimeBlock)) throw new Error("这不是有效的每日时间轴备份文件");
  return { version: 1, blocks: data.blocks };
}

class LocalStorageScheduleRepository implements ScheduleRepository {
  async getAll(): Promise<ScheduleData> {
    if (typeof window === "undefined") return EMPTY_DATA;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    let cached = EMPTY_DATA;
    try { cached = raw ? parseScheduleData(JSON.parse(raw)) : EMPTY_DATA; } catch {}
    try {
      const response = await fetch("/api/schedule", { cache: "no-store" });
      if (!response.ok) throw new Error("cloud unavailable");
      const payload = (await response.json()) as { schedule: unknown | null };
      if (payload.schedule) {
        const cloud = parseScheduleData(payload.schedule);
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cloud));
        return cloud;
      }
      if (cached.blocks.length) await this.saveAll(cached);
    } catch {}
    return cached;
  }

  async saveAll(data: ScheduleData): Promise<void> {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    const response = await fetch("/api/schedule", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error("云端保存失败");
  }
}

export const scheduleRepository: ScheduleRepository = new LocalStorageScheduleRepository();
