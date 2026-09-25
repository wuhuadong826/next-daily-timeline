"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Copy, RefreshCw, TicketCheck } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/lib/supabase";

type InviteCode = {
  code: string;
  max_uses: number;
  use_count: number;
  disabled_at: string | null;
  created_at: string;
};

function randomCode() {
  const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase();
  return `NEXT-${suffix}`;
}

export function InviteManager() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [open, setOpen] = useState(false);
  const [codes, setCodes] = useState<InviteCode[]>([]);
  const [code, setCode] = useState(randomCode);
  const [maxUses, setMaxUses] = useState(1);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const loadCodes = useCallback(async () => {
    const { data, error } = await supabase
      .from("invite_codes")
      .select("code,max_uses,use_count,disabled_at,created_at")
      .order("created_at", { ascending: false });
    if (error) setMessage(error.message);
    else setCodes((data ?? []) as InviteCode[]);
  }, []);

  useEffect(() => {
    supabase.rpc("is_app_admin").then(({ data, error }) => {
      const allowed = !error && data === true;
      setIsAdmin(allowed);
      if (allowed) void loadCodes();
    });
  }, [loadCodes]);

  async function createInvite(event: FormEvent) {
    event.preventDefault();
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode || !Number.isInteger(maxUses) || maxUses < 1) return;
    setBusy(true);
    setMessage("");
    const { error } = await supabase.from("invite_codes").insert({
      code: cleanCode,
      max_uses: maxUses,
      use_count: 0,
      used: false,
    });
    setBusy(false);
    if (error) return setMessage(error.code === "23505" ? "这个邀请码已经存在" : error.message);
    setCode(randomCode());
    setMaxUses(1);
    setMessage("邀请码已创建");
    await loadCodes();
  }

  async function disableInvite(inviteCode: string) {
    if (!window.confirm(`停用邀请码 ${inviteCode}？停用后将不能用于注册。`)) return;
    const { error } = await supabase.from("invite_codes").update({ disabled_at: new Date().toISOString() }).eq("code", inviteCode);
    if (error) setMessage(error.message);
    else await loadCodes();
  }

  if (!isAdmin) return null;

  return (
    <>
      <button className="icon-button" onClick={() => setOpen(true)} aria-label="邀请管理" title="邀请管理"><TicketCheck size={18} /></button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="mx-auto h-[92dvh] max-w-2xl overflow-y-auto rounded-t-[28px] border-[#dce5e2] px-5 pb-6 pt-5 sm:h-auto sm:max-h-[92dvh]">
          <SheetHeader className="mb-5 text-left">
            <SheetTitle className="text-xl">邀请管理</SheetTitle>
            <SheetDescription>创建限次邀请码，或停用不再使用的邀请码。</SheetDescription>
          </SheetHeader>

          <form className="grid gap-3 rounded-2xl bg-[#f3f7f5] p-4" onSubmit={createInvite}>
            <label className="field-label">邀请码
              <div className="flex gap-2"><input required className="field-input" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} /><button type="button" className="soft-button shrink-0" onClick={() => setCode(randomCode())}><RefreshCw size={16} />随机</button></div>
            </label>
            <label className="field-label">最多注册人数<input required className="field-input" type="number" min="1" step="1" value={maxUses} onChange={(event) => setMaxUses(Number(event.target.value))} /></label>
            <button className="solid-button" disabled={busy}>{busy ? "创建中…" : "创建邀请码"}</button>
          </form>

          {message && <p className="mt-3 rounded-xl bg-[#eef4f2] px-3 py-2 text-sm text-[#315e53]">{message}</p>}

          <div className="mt-5 space-y-3">
            {codes.length === 0 ? <p className="text-sm text-[#74807c]">还没有邀请码。</p> : codes.map((item) => {
              const exhausted = item.use_count >= item.max_uses;
              const disabled = Boolean(item.disabled_at);
              const status = disabled ? "已停用" : exhausted ? "已用完" : "可用";
              return <article key={item.code} className="rounded-2xl border border-[#dce5e2] bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><strong className="block break-all">{item.code}</strong><span className="mt-1 block text-sm text-[#687672]">{item.use_count}/{item.max_uses} · {status}</span></div>
                  <button className="icon-button shrink-0" onClick={() => void navigator.clipboard.writeText(item.code)} aria-label="复制邀请码"><Copy size={17} /></button>
                </div>
                {!disabled && !exhausted && <button className="danger-button mt-3" onClick={() => void disableInvite(item.code)}>停用</button>}
              </article>;
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
