"use client";

import { FormEvent, useState } from "react";
import { Clock3 } from "lucide-react";
import { supabase } from "@/lib/supabase";

export function AuthScreen() {
  const [registering, setRegistering] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const result = registering
      ? await supabase.auth.signUp({
          email,
          password,
          options: { data: { invite_code: inviteCode.trim() } },
        })
      : await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (result.error) {
      setMessage(result.error.message.includes("Database error")
        ? "邀请码无效、已使用，或注册信息有误"
        : result.error.message);
      return;
    }
    if (registering && !result.data.session) {
      setMessage("注册成功，请到邮箱完成验证后再登录。");
      setRegistering(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f4f7f6] px-4 py-10 text-[#17221f]">
      <section className="w-full max-w-sm rounded-[24px] border border-[#dce5e2] bg-white p-6 shadow-[0_18px_50px_rgba(23,63,54,.10)]">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-[#173f36] text-white"><Clock3 size={21} /></div>
          <div><p className="text-sm text-[#6a7773]">Next</p><h1 className="text-xl font-semibold">{registering ? "使用邀请码注册" : "登录每日时间轴"}</h1></div>
        </div>
        <form className="grid gap-4" onSubmit={submit}>
          <label className="field-label">邮箱<input required type="email" autoComplete="email" className="field-input" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <label className="field-label">密码<input required minLength={6} type="password" autoComplete={registering ? "new-password" : "current-password"} className="field-input" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
          {registering && <label className="field-label">邀请码<input required className="field-input" value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} /></label>}
          {message && <p className="rounded-xl bg-[#eef4f2] px-3 py-2 text-sm text-[#315e53]">{message}</p>}
          <button className="solid-button mt-1 justify-center" disabled={busy}>{busy ? "请稍候…" : registering ? "注册账号" : "登录"}</button>
        </form>
        <button className="mt-5 w-full text-sm font-medium text-[#486b62]" onClick={() => { setRegistering(!registering); setMessage(""); }}>
          {registering ? "已有账号？返回登录" : "没有账号？使用邀请码注册"}
        </button>
      </section>
    </main>
  );
}
