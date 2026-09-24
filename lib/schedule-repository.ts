import type { ScheduleData, TimeBlock } from "./schedule";

export interface ScheduleRepository {
  getAll(): ScheduleData;
  saveAll(data: ScheduleData): void;
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
  getAll(): ScheduleData {
    if (typeof window === "undefined") return EMPTY_DATA;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_DATA;
    try { return parseScheduleData(JSON.parse(raw)); } catch { return EMPTY_DATA; }
  }

  saveAll(data: ScheduleData): void {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }
}

export const scheduleRepository: ScheduleRepository = new LocalStorageScheduleRepository();
