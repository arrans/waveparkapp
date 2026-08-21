import { pgTable, serial, text, integer, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const sessionsTable = pgTable("sessions", {
  id: serial("id").primaryKey(),
  date: date("date").notNull(),
  time: text("time").notNull(),
  title: text("title").notNull(),
  wave_direction: text("wave_direction").notNull(),
  capacity_booked: integer("capacity_booked").notNull(),
  capacity_available: integer("capacity_available").notNull(),
});

export const insertSessionSchema = createInsertSchema(sessionsTable).omit({ id: true });
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Session = typeof sessionsTable.$inferSelect;
