"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, CalendarDays, ChevronLeft, ChevronRight, Clock3, Copy, MoreHorizontal, Plus, RotateCcw, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PwaRegister } from "@/components/pwa-register";
import { parseScheduleData, scheduleRepository } from "@/lib/schedule-repository";
import { addDays, durationLabel, formatCountdown, localDateKey, minutesToTime, nowTime, shiftBlock, sortBlocks, timeToMinutes, validateDraft, type ScheduleData, type TimeBlock, type TimeBlockDraft } from "@/lib/schedule";

const blankDraft = (date: string, now = new Date()): TimeBlockDraft => {
  const rounded = Math.ceil((now.getHours() * 60 + now.getMinutes()) / 5) * 5;
  const start = Math.min(rounded, 23 * 60);
  return { date, title: "", startTime: minutesToTime(start), endTime: minutesToTime(Math.min(start + 30, 1439)), note: "" };
};

function formatDate(date: string) {
  return new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "long" }).format(new Date(`${date}T12:00:00`));
}

function getDateLabel(date: string) {
  const today = localDateKey();
  if (date === today) return "今天";
  if (date === addDays(today, 1)) return "明天";
  if (date === addDays(today, -1)) return "昨天";
  return "日程";
}

type WebTool = {
  name: string;
  title: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute: (input: unknown) => unknown | Promise<unknown>;
};

type WebModelContext = {
  registerTool: (tool: WebTool, options?: { signal?: AbortSignal }) => void | Promise<void>;
};

export default function Home() {
  const [selectedDate, setSelectedDate] = useState(localDateKey);
  const [data, setData] = useState<ScheduleData>({ version: 1, blocks: [] });
  const [hydrated, setHydrated] = useState(false);
  const [now, setNow] = useState(new Date());
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<TimeBlockDraft>(() => blankDraft(localDateKey()));
  const draftRef = useRef(draft);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [shiftMinutes, setShiftMinutes] = useState<number | null>(null);
  const [shiftFromId, setShiftFromId] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setData(scheduleRepository.getAll());
    setHydrated(true);
    const timer = window.setInterval(() => setNow(new Date()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const context = (document as Document & { modelContext?: WebModelContext }).modelContext;
    if (!context?.registerTool || !hydrated) return;
    const lifecycle = new AbortController();
    const register = async () => {
      await context.registerTool({
        name: "read_daily_timeline",
        title: "查看每日时间轴",
        description: "读取当前选中日期的全部时间块，按开始时间排序。",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: true, untrustedContentHint: false },
        execute: () => ({ date: selectedDate, blocks: sortBlocks(data.blocks.filter((block) => block.date === selectedDate)) }),
      }, { signal: lifecycle.signal });
      await context.registerTool({
        name: "create_time_block",
        title: "创建时间块",
        description: "在当前选中日期创建一个新的时间块，并立即保存到本机。",
        inputSchema: {
          type: "object",
          properties: {
            title: { type: "string" },
            startTime: { type: "string", pattern: "^([01]\\d|2[0-3]):[0-5]\\d$" },
            endTime: { type: "string", pattern: "^([01]\\d|2[0-3]):[0-5]\\d$" },
            note: { type: "string" },
          },
          required: ["title", "startTime", "endTime"],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute: (input) => {
          const value = input as Partial<Pick<TimeBlockDraft, "title" | "startTime" | "endTime" | "note">>;
          if (typeof value.title !== "string" || typeof value.startTime !== "string" || typeof value.endTime !== "string" || (value.note !== undefined && typeof value.note !== "string")) throw new Error("参数格式无效");
          const nextDraft: TimeBlockDraft = { date: selectedDate, title: value.title, startTime: value.startTime, endTime: value.endTime, note: value.note ?? "" };
          const error = validateDraft(nextDraft);
          if (error) throw new Error(error);
          const timestamp = new Date().toISOString();
          const block: TimeBlock = { ...nextDraft, id: crypto.randomUUID(), createdAt: timestamp, updatedAt: timestamp };
          const nextData: ScheduleData = { version: 1, blocks: [...data.blocks, block] };
          scheduleRepository.saveAll(nextData);
          setData(nextData);
          return { created: true, block };
        },
      }, { signal: lifecycle.signal });
    };
    void register().catch(() => undefined);
    return () => lifecycle.abort();
  }, [data.blocks, hydrated, selectedDate]);

  const dayBlocks = useMemo(() => sortBlocks(data.blocks.filter((block) => block.date === selectedDate)), [data.blocks, selectedDate]);
  const nowMinutes = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  const isToday = selectedDate === localDateKey(now);
  const current = isToday ? dayBlocks.find((block) => timeToMinutes(block.startTime) <= nowMinutes && timeToMinutes(block.endTime) > nowMinutes) : undefined;
  const next = dayBlocks.find((block) => timeToMinutes(block.startTime) > (isToday ? nowMinutes : -1));

  function commit(nextData: ScheduleData, message?: string) {
    scheduleRepository.saveAll(nextData);
    setData(nextData);
    if (message) {
      setNotice(message);
      window.setTimeout(() => setNotice(""), 2500);
    }
  }

  function replaceDraft(nextDraft: TimeBlockDraft) {
    draftRef.current = nextDraft;
    setDraft(nextDraft);
  }

  function openNew() {
    setEditingId(null);
    replaceDraft(blankDraft(selectedDate));
    setFormError("");
    setEditorOpen(true);
  }

  function openEdit(block: TimeBlock) {
    setEditingId(block.id);
    replaceDraft({ date: block.date, title: block.title, startTime: block.startTime, endTime: block.endTime, note: block.note });
    setFormError("");
    setEditorOpen(true);
  }

  function saveDraft() {
    const submitted = draftRef.current;
    const error = validateDraft(submitted);
    if (error) return setFormError(error);
    const timestamp = new Date().toISOString();
    const clean = { ...submitted, title: submitted.title.trim(), note: submitted.note.trim() };
    if (editingId) {
      commit({ version: 1, blocks: data.blocks.map((block) => block.id === editingId ? { ...block, ...clean, updatedAt: timestamp } : block) }, "修改已保存");
    } else {
      const block: TimeBlock = { ...clean, id: crypto.randomUUID(), createdAt: timestamp, updatedAt: timestamp };
      commit({ version: 1, blocks: [...data.blocks, block] }, "时间块已添加");
    }
    setEditorOpen(false);
  }

  function deleteBlock(id: string) {
    if (!window.confirm("删除这个时间块？此操作不会影响其他日程。")) return;
    commit({ version: 1, blocks: data.blocks.filter((block) => block.id !== id) }, "时间块已删除");
    setEditorOpen(false);
  }

  function quickShift(id: string, minutes: number) {
    let invalid = false;
    const blocks = data.blocks.map((block) => {
      if (block.id !== id) return block;
      const shifted = shiftBlock(block, minutes);
      if (!shifted) invalid = true;
      return shifted ?? block;
    });
    if (invalid) return setNotice("顺延后会跨到下一天，请手动调整时间");
    commit({ version: 1, blocks }, `已顺延 ${minutes} 分钟`);
    if (editingId === id) {
      const changed = blocks.find((block) => block.id === id)!;
      replaceDraft({ ...draftRef.current, startTime: changed.startTime, endTime: changed.endTime });
    }
  }

  function startNow(id: string) {
    let invalid = false;
    const blocks = data.blocks.map((block) => {
      if (block.id !== id) return block;
      const duration = timeToMinutes(block.endTime) - timeToMinutes(block.startTime);
      const start = Math.floor(nowMinutes);
      if (start + duration > 1439) { invalid = true; return block; }
      return { ...block, startTime: minutesToTime(start), endTime: minutesToTime(start + duration), updatedAt: new Date().toISOString() };
    });
    if (invalid) return setNotice("从现在开始会跨到下一天，请手动调整");
    commit({ version: 1, blocks }, "已改为从现在开始");
    if (editingId === id) {
      const changed = blocks.find((block) => block.id === id)!;
      replaceDraft({ ...draftRef.current, startTime: changed.startTime, endTime: changed.endTime });
    }
  }

  function requestShiftFrom(id: string, minutes: number) {
    setShiftFromId(id);
    setShiftMinutes(minutes);
  }

  const shiftTargets = useMemo(() => {
    if (!shiftFromId || !shiftMinutes) return [];
    const anchor = dayBlocks.find((block) => block.id === shiftFromId);
    if (!anchor) return [];
    return dayBlocks.filter((block) => timeToMinutes(block.startTime) >= timeToMinutes(anchor.startTime) && (!isToday || timeToMinutes(block.endTime) > nowMinutes));
  }, [shiftFromId, shiftMinutes, dayBlocks, isToday, nowMinutes]);

  function confirmShiftAll() {
    if (!shiftMinutes) return;
    const ids = new Set(shiftTargets.map((block) => block.id));
    const shifted = shiftTargets.map((block) => shiftBlock(block, shiftMinutes));
    if (shifted.some((block) => !block)) {
      setNotice("顺延后会有任务跨到下一天，请先缩短或手动调整最后一项");
      setShiftMinutes(null);
      return;
    }
    commit({ version: 1, blocks: data.blocks.map((block) => ids.has(block.id) ? shifted.find((item) => item?.id === block.id) ?? block : block) }, `后续 ${shiftTargets.length} 项已整体顺延`);
    setShiftMinutes(null);
    setShiftFromId(null);
  }

  function copyDay() {
    if (!dayBlocks.length) return setNotice("这一天还没有可以复制的日程");
    const target = addDays(selectedDate, 1);
    const exists = data.blocks.some((block) => block.date === target);
    if (exists && !window.confirm(`${formatDate(target)} 已有日程。继续会把这些时间块追加进去。`)) return;
    const timestamp = new Date().toISOString();
    const copies = dayBlocks.map((block) => ({ ...block, id: crypto.randomUUID(), date: target, createdAt: timestamp, updatedAt: timestamp }));
    commit({ version: 1, blocks: [...data.blocks, ...copies] }, `已复制到${formatDate(target)}`);
    setSelectedDate(target);
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `每日时间轴-${localDateKey()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function importData(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const parsed = parseScheduleData(JSON.parse(await file.text()));
      if (window.confirm(`将导入 ${parsed.blocks.length} 个时间块，并替换当前本机数据。继续吗？`)) commit(parsed, "数据已恢复");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "导入失败");
    } finally {
      event.target.value = "";
    }
  }

  const currentStatus = current
    ? { eyebrow: "现在", title: current.title, detail: `${current.startTime} – ${current.endTime}`, timing: `还剩 ${formatCountdown(timeToMinutes(current.endTime) - nowMinutes)}` }
    : { eyebrow: isToday ? "现在" : getDateLabel(selectedDate), title: isToday ? "当前没有安排" : `${formatDate(selectedDate)}的计划`, detail: next ? `下一项 ${next.startTime} 开始` : "今天暂无日程", timing: next && isToday ? `${formatCountdown(timeToMinutes(next.startTime) - nowMinutes)}后开始` : "" };

  return (
    <main className="min-h-screen bg-[#f4f7f6] text-[#17221f]">
      <PwaRegister />
      <div className="mx-auto max-w-6xl px-4 pb-16 pt-4 sm:px-6 lg:px-8 lg:pt-8">
        <header className="mb-4 flex items-center justify-between sm:mb-6">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-[#173f36] text-white"><Clock3 size={20} /></div>
            <div><p className="text-[13px] font-medium text-[#6a7773]">每日时间轴</p><h1 className="text-lg font-semibold tracking-tight">{formatDate(selectedDate)}</h1></div>
          </div>
          <div className="flex items-center gap-1">
            <button className="icon-button" onClick={exportData} aria-label="导出数据"><ArrowDownToLine size={18} /></button>
            <button className="icon-button" onClick={() => importRef.current?.click()} aria-label="导入数据"><ArrowUpFromLine size={18} /></button>
            <input ref={importRef} type="file" accept="application/json" className="hidden" onChange={importData} />
          </div>
        </header>

        <section className="now-card">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="mb-2 text-sm font-semibold text-[#b7f0dc]">{currentStatus.eyebrow} · {now.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</p>
              <h2 className="truncate text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">{currentStatus.title}</h2>
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[#d6e7e1]"><span>{currentStatus.detail}</span>{currentStatus.timing && <strong className="font-semibold text-white">{currentStatus.timing}</strong>}</div>
            </div>
            <span className="hidden rounded-full bg-white/10 px-3 py-1 text-xs text-[#d6e7e1] sm:block">{getDateLabel(selectedDate)}</span>
          </div>
          {next && next.id !== current?.id && <div className="mt-5 border-t border-white/15 pt-4 text-sm text-[#d6e7e1]">下一项：<span className="font-medium text-white">{next.startTime} – {next.endTime} {next.title}</span></div>}
          <div className="mt-5 grid grid-cols-2 gap-2 sm:flex">
            <button className="primary-light-button" onClick={() => current ? openEdit(current) : openNew()}>{current ? <MoreHorizontal size={18} /> : <Plus size={18} />}{current ? "调整当前任务" : "添加时间块"}</button>
            <button className="ghost-light-button" onClick={openNew}><Plus size={18} />添加临时事项</button>
          </div>
        </section>

        <section className="date-nav" aria-label="日期切换">
          <button className="icon-button" onClick={() => setSelectedDate(addDays(selectedDate, -1))} aria-label="前一天"><ChevronLeft size={20} /></button>
          <div className="flex min-w-0 items-center gap-2"><CalendarDays size={18} className="text-[#53746b]" /><button onClick={() => setSelectedDate(localDateKey())} className="truncate text-sm font-semibold">{getDateLabel(selectedDate)} · {selectedDate}</button></div>
          <button className="icon-button" onClick={() => setSelectedDate(addDays(selectedDate, 1))} aria-label="后一天"><ChevronRight size={20} /></button>
        </section>

        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <section className="surface-card">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div><h2 className="text-xl font-semibold tracking-tight">{getDateLabel(selectedDate)}的时间轴</h2><p className="mt-1 text-sm text-[#74807c]">{dayBlocks.length ? `${dayBlocks.length} 个时间块 · 点击即可调整` : "给这一天安排第一个时间块"}</p></div>
              <button className="solid-button" onClick={openNew}><Plus size={18} />新建</button>
            </div>
            {dayBlocks.length === 0 ? (
              <button onClick={openNew} className="empty-state"><span className="mb-3 flex size-11 items-center justify-center rounded-2xl bg-[#e7f0ed] text-[#315e53]"><Plus size={22} /></span><strong>添加第一项安排</strong><span>精确到分钟，也允许中间留白。</span></button>
            ) : (
              <div className="timeline">
                {dayBlocks.map((block) => {
                  const start = timeToMinutes(block.startTime);
                  const end = timeToMinutes(block.endTime);
                  const active = isToday && start <= nowMinutes && end > nowMinutes;
                  const showNow = isToday && nowMinutes < start && block.id === next?.id;
                  return <div key={block.id}>{showNow && <div className="now-line"><span>现在 {nowTime(now)}</span></div>}<article className={`timeline-block ${active ? "is-active" : ""}`} onClick={() => openEdit(block)}>
                    <div className="timeline-time"><strong>{block.startTime}</strong><span>{block.endTime}</span></div>
                    <div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><h3 className="truncate font-semibold">{block.title}</h3><span className="shrink-0 text-xs text-[#71807b]">{durationLabel(end - start)}</span></div>{block.note && <p className="mt-1 line-clamp-2 text-sm text-[#6e7c78]">{block.note}</p>}
                      <div className="quick-actions" onClick={(event) => event.stopPropagation()}><button onClick={() => quickShift(block.id, 10)}>+10 分钟</button><button onClick={() => quickShift(block.id, 30)}>+30 分钟</button><button onClick={() => startNow(block.id)}>从现在开始</button></div>
                    </div>
                  </article></div>;
                })}
                {isToday && nowMinutes >= timeToMinutes(dayBlocks.at(-1)!.endTime) && <div className="now-line after"><span>现在 {nowTime(now)}</span></div>}
              </div>
            )}
          </section>

          <aside className="space-y-4">
            <section className="surface-card compact-card"><h2 className="mb-3 font-semibold">复用这一天</h2><p className="mb-4 text-sm leading-6 text-[#6f7b78]">复制到第二天后，两天可以各自修改。</p><button className="outline-button w-full" onClick={copyDay}><Copy size={17} />复制日程到下一天</button></section>
            <section className="surface-card compact-card"><h2 className="mb-3 font-semibold">后续整体顺延</h2><p className="mb-4 text-sm leading-6 text-[#6f7b78]">选择当前或下一任务为起点，只调整尚未结束的任务。</p>{dayBlocks.length ? <div className="grid grid-cols-2 gap-2"><button className="soft-button" onClick={() => requestShiftFrom(current?.id ?? next?.id ?? dayBlocks[0].id, 10)}>顺延 10 分钟</button><button className="soft-button" onClick={() => requestShiftFrom(current?.id ?? next?.id ?? dayBlocks[0].id, 30)}>顺延 30 分钟</button></div> : <span className="text-sm text-[#8b9592]">添加日程后可用</span>}</section>
          </aside>
        </div>
      </div>

      {notice && <div className="toast" role="status">{notice}</div>}

      <Sheet open={editorOpen} onOpenChange={setEditorOpen}>
        <SheetContent side="bottom" className="mx-auto h-[92dvh] max-w-2xl overflow-hidden rounded-t-[28px] border-[#dce5e2] p-0 sm:h-auto sm:max-h-[92dvh]">
          <SheetHeader className="border-b border-[#e2e9e7] px-5 pb-4 pt-5 text-left"><SheetTitle className="text-xl">{editingId ? "调整时间块" : "新建时间块"}</SheetTitle><SheetDescription>修改后立即保存在这台设备上。</SheetDescription></SheetHeader>
          <div className="grid flex-1 gap-4 overflow-y-auto px-5 py-5">
            <label className="field-label">任务名称<input autoFocus className="field-input" value={draft.title} onChange={(event) => replaceDraft({ ...draftRef.current, title: event.target.value })} placeholder="例如：英语四级" /></label>
            <div className="grid grid-cols-2 gap-3"><label className="field-label">开始时间<input className="field-input" type="time" step="60" value={draft.startTime} onChange={(event) => replaceDraft({ ...draftRef.current, startTime: event.target.value })} /></label><label className="field-label">结束时间<input className="field-input" type="time" step="60" value={draft.endTime} onChange={(event) => replaceDraft({ ...draftRef.current, endTime: event.target.value })} /></label></div>
            <label className="field-label">备注（可选）<textarea className="field-input min-h-24 resize-none" value={draft.note} onChange={(event) => replaceDraft({ ...draftRef.current, note: event.target.value })} placeholder="地点、准备事项或提醒" /></label>
            {formError && <p className="rounded-xl bg-[#fff2e9] px-3 py-2 text-sm text-[#954b20]">{formError}</p>}
            {editingId && <div><p className="mb-2 text-sm font-semibold text-[#566660]">快速调整</p><div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><button className="soft-button" onClick={() => quickShift(editingId, 10)}>延后 10 分钟</button><button className="soft-button" onClick={() => quickShift(editingId, 30)}>延后 30 分钟</button><button className="soft-button" onClick={() => startNow(editingId)}>从现在开始</button><button className="soft-button" onClick={() => requestShiftFrom(editingId, 30)}><RotateCcw size={15} />后续 +30</button></div></div>}
          </div>
          <div className="grid shrink-0 grid-cols-[auto_1fr] gap-3 border-t border-[#dfe8e5] bg-white/95 px-5 py-4 backdrop-blur">{editingId ? <button className="danger-button" onClick={() => deleteBlock(editingId)} aria-label="删除时间块"><Trash2 size={19} /><span className="hidden sm:inline">删除</span></button> : <span />}<button className="solid-button justify-center py-3" onClick={saveDraft}>保存时间块</button></div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={shiftMinutes !== null} onOpenChange={(open) => !open && setShiftMinutes(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>后续整体顺延 {shiftMinutes} 分钟？</AlertDialogTitle><AlertDialogDescription>将调整 {shiftTargets.length} 个尚未结束的时间块，保持每项原时长。之前已经结束的任务不会改变。</AlertDialogDescription></AlertDialogHeader><div className="max-h-48 space-y-2 overflow-auto rounded-xl bg-[#f3f6f5] p-3">{shiftTargets.slice(0, 6).map((block) => <div key={block.id} className="flex justify-between gap-3 text-sm"><span className="truncate">{block.title}</span><span className="shrink-0 text-[#64736e]">{block.startTime} → {minutesToTime(timeToMinutes(block.startTime) + (shiftMinutes ?? 0))}</span></div>)}</div><AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction onClick={confirmShiftAll}>确认顺延</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
