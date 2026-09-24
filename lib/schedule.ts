export type TimeBlock = {
  id: string;
  date: string;
  title: string;
  startTime: string;
  endTime: string;
  note: string;
  createdAt: string;
  updatedAt: string;
};

export type ScheduleData = { version: 1; blocks: TimeBlock[] };
export type TimeBlockDraft = Pick<TimeBlock, "date" | "title" | "startTime" | "endTime" | "note">;

export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function minutesToTime(total: number): string {
  const safe = Math.max(0, Math.min(1439, total));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

export function durationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes}分钟`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}小时${rest}分钟` : `${hours}小时`;
}

export function formatCountdown(minutes: number): string {
  return durationLabel(Math.max(0, Math.ceil(minutes)));
}

export function sortBlocks(blocks: TimeBlock[]): TimeBlock[] {
  return [...blocks].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
}

export function addDays(date: string, amount: number): string {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + amount);
  return localDateKey(value);
}

export function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function nowTime(date = new Date()): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function validateDraft(draft: TimeBlockDraft): string | null {
  if (!draft.title.trim()) return "请填写任务名称";
  if (!draft.startTime || !draft.endTime) return "请填写开始和结束时间";
  if (timeToMinutes(draft.endTime) <= timeToMinutes(draft.startTime)) return "结束时间必须晚于开始时间；MVP 暂不支持跨午夜任务";
  return null;
}

export function shiftBlock(block: TimeBlock, minutes: number): TimeBlock | null {
  const start = timeToMinutes(block.startTime) + minutes;
  const end = timeToMinutes(block.endTime) + minutes;
  if (start < 0 || end > 1439) return null;
  return { ...block, startTime: minutesToTime(start), endTime: minutesToTime(end), updatedAt: new Date().toISOString() };
}
