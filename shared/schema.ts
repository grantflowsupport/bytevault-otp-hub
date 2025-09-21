import { sql } from "drizzle-orm";
import { pgTable, text, varchar, boolean, integer, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Products table
export const products = pgTable("products", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  is_active: boolean("is_active").notNull().default(true),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
});

// IMAP accounts table
export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  label: text("label").notNull(),
  imap_host: text("imap_host").notNull(),
  imap_port: integer("imap_port").notNull().default(993),
  imap_user: text("imap_user").notNull(),
  imap_password_enc: text("imap_password_enc").notNull(),
  otp_regex: text("otp_regex").notNull().default("\\b\\d{6}\\b"),
  fetch_from_filter: text("fetch_from_filter"),
  is_active: boolean("is_active").notNull().default(true),
  priority: integer("priority").notNull().default(100),
  last_used_at: timestamp("last_used_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
});

// Product-Account mappings (many-to-many)
export const productAccounts = pgTable("product_accounts", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  product_id: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  account_id: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  is_active: boolean("is_active").notNull().default(true),
  sender_override: text("sender_override"),
  otp_regex_override: text("otp_regex_override"),
  weight: integer("weight").notNull().default(100),
});

// Product credentials
export const productCredentials = pgTable("product_credentials", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  product_id: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  label: text("label").notNull().default("Default"),
  login_email: text("login_email"),
  login_username: text("login_username"),
  login_password: text("login_password"),
  notes: text("notes"),
  is_active: boolean("is_active").notNull().default(true),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
});

// User access control
export const userAccess = pgTable("user_access", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  user_id: uuid("user_id").notNull(),
  product_id: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  granted_at: timestamp("granted_at", { withTimezone: true }).notNull().default(sql`now()`),
  expires_at: timestamp("expires_at", { withTimezone: true }),
});

// OTP logs
export const otpLogs = pgTable("otp_logs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  user_id: uuid("user_id"),
  product_id: uuid("product_id").references(() => products.id),
  account_id: uuid("account_id").references(() => accounts.id),
  status: text("status").notNull(), // success | no_mail | regex_miss | error | rate_limited
  detail: text("detail"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
});

// Insert schemas
export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  created_at: true,
});

export const insertAccountSchema = createInsertSchema(accounts).omit({
  id: true,
  created_at: true,
  last_used_at: true,
});

export const insertProductAccountSchema = createInsertSchema(productAccounts).omit({
  id: true,
});

export const insertProductCredentialSchema = createInsertSchema(productCredentials).omit({
  id: true,
  created_at: true,
});

export const insertUserAccessSchema = createInsertSchema(userAccess).omit({
  id: true,
  granted_at: true,
});

export const insertOtpLogSchema = createInsertSchema(otpLogs).omit({
  id: true,
  created_at: true,
});

// Types
export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;

export type Account = typeof accounts.$inferSelect;
export type InsertAccount = z.infer<typeof insertAccountSchema>;

export type ProductAccount = typeof productAccounts.$inferSelect;
export type InsertProductAccount = z.infer<typeof insertProductAccountSchema>;

export type ProductCredential = typeof productCredentials.$inferSelect;
export type InsertProductCredential = z.infer<typeof insertProductCredentialSchema>;

export type UserAccess = typeof userAccess.$inferSelect;
export type InsertUserAccess = z.infer<typeof insertUserAccessSchema>;

export type OtpLog = typeof otpLogs.$inferSelect;
export type InsertOtpLog = z.infer<typeof insertOtpLogSchema>;
