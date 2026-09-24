import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { scheduleState } from "@/db/schema";
import { getChatGPTUser } from "@/app/chatgpt-auth";

async function currentUserId() {
  const user = await getChatGPTUser();
  if (!user) throw new Error("UNAUTHORIZED");
  return user.userId;
}

export async function GET() {
  try {
    const userId = await currentUserId();
    const [row] = await getDb()
      .select()
      .from(scheduleState)
      .where(eq(scheduleState.userId, userId))
      .limit(1);
    return Response.json({ schedule: row ? JSON.parse(row.data) : null });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return Response.json({ error: "请先登录" }, { status: 401 });
    }
    return Response.json({ error: "云端日程暂时不可用" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const userId = await currentUserId();
    const schedule = await request.json();
    const updatedAt = new Date().toISOString();
    await getDb()
      .insert(scheduleState)
      .values({ userId, data: JSON.stringify(schedule), updatedAt })
      .onConflictDoUpdate({
        target: scheduleState.userId,
        set: { data: JSON.stringify(schedule), updatedAt },
      });
    return Response.json({ saved: true, updatedAt });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return Response.json({ error: "请先登录" }, { status: 401 });
    }
    return Response.json({ error: "云端保存失败" }, { status: 500 });
  }
}
