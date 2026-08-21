import { pgTable, serial, integer, timestamp } from "drizzle-orm/pg-core";

export const refreshLogTable = pgTable("refresh_log", {
  id: serial("id").primaryKey(),
  refreshedAt: timestamp("refreshed_at", { withTimezone: true }).notNull().defaultNow(),
  inserted: integer("inserted").notNull(),
  deleted: integer("deleted").notNull(),
});

export type RefreshLog = typeof refreshLogTable.$inferSelect;
