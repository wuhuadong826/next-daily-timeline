import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export const scheduleState = sqliteTable("schedule_state", {
  userId: text("user_id").primaryKey(),
  data: text("data").notNull(),
  updatedAt: text("updated_at").notNull(),
});
