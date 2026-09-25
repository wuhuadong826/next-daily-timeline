import type { ScheduleData, TimeBlock } from "./schedule";
import { supabase } from "./supabase";

export interface ScheduleRepository {
  getAll(userId: string): Promise<ScheduleData>;
  saveAll(userId: string, data: ScheduleData): Promise<void>;
}

const storageKey = (userId: string) => `daily-timeline:schedule:v1:${userId}`;
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
  async getAll(userId: string): Promise<ScheduleData> {
    if (typeof window === "undefined") return EMPTY_DATA;
    const key = storageKey(userId);
    const raw = window.localStorage.getItem(key);
    let cached = EMPTY_DATA;
    try { cached = raw ? parseScheduleData(JSON.parse(raw)) : EMPTY_DATA; } catch {}
    try {
      const { data: row, error } = await supabase.from("schedules").select("data").eq("user_id", userId).maybeSingle();
      if (error) throw error;
      if (row?.data) {
        const cloud = parseScheduleData(row.data);
        window.localStorage.setItem(key, JSON.stringify(cloud));
        return cloud;
      }
      if (cached.blocks.length) await this.saveAll(userId, cached);
    } catch {}
    return cached;
  }

  async saveAll(userId: string, data: ScheduleData): Promise<void> {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(data));
    const { error } = await supabase.from("schedules").upsert({ user_id: userId, data, updated_at: new Date().toISOString() });
    if (error) throw error;
  }
}

export const scheduleRepository: ScheduleRepository = new LocalStorageScheduleRepository();
