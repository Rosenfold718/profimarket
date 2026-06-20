import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'
import { sql } from 'drizzle-orm'

// ─── User ────────────────────────────────────────────────────────────────────
export const users = sqliteTable('User', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  passwordHash: text('passwordHash').notNull(),
  name: text('name').notNull(),
  phone: text('phone'),
  role: text('role', { enum: ['CLIENT', 'EXECUTOR', 'ADMIN'] }).notNull().default('EXECUTOR'),
  avatar: text('avatar'),
  lastSeenAt: text('lastSeenAt'),
  createdAt: text('createdAt').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updatedAt').notNull(),
})

export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(profiles, { fields: [users.id], references: [profiles.userId] }),
  clientOrders: many(orders, { relationName: 'clientOrders' }),
  executorOrders: many(orders, { relationName: 'executorOrders' }),
  responses: many(responses, { relationName: 'executorResponses' }),
  sentMessages: many(messages, { relationName: 'senderMessages' }),
  conversations1: many(conversations, { relationName: 'convUser1' }),
  conversations2: many(conversations, { relationName: 'convUser2' }),
}))

// ─── Profile ────────────────────────────────────────────────────────────────
export const profiles = sqliteTable('Profile', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull().unique(),
  company: text('company'),
  position: text('position'),
  experienceYears: integer('experienceYears'),
  specializations: text('specializations').notNull(),
  description: text('description'),
  region: text('region'),
  city: text('city'),
  education: text('education'),
  certificates: text('certificates'),
  rating: real('rating').notNull().default(0),
  completedOrders: integer('completedOrders').notNull().default(0),
  website: text('website'),
  socialLinks: text('socialLinks'),
})

export const profilesRelations = relations(profiles, ({ one }) => ({
  user: one(users, { fields: [profiles.userId], references: [users.id] }),
}))

// ─── Category ────────────────────────────────────────────────────────────────
export const categories = sqliteTable('Category', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  icon: text('icon'),
  description: text('description'),
  order: integer('order').notNull().default(0),
})

export const categoriesRelations = relations(categories, ({ many }) => ({
  orders: many(orders),
}))

// ─── Order ──────────────────────────────────────────────────────────────────
export const orders = sqliteTable('Order', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  categoryId: text('categoryId'),
  region: text('region'),
  city: text('city'),
  budgetFrom: real('budgetFrom'),
  budgetTo: real('budgetTo'),
  deadline: text('deadline'),
  status: text('status', { enum: ['OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] }).notNull().default('OPEN'),
  clientId: text('clientId').notNull(),
  executorId: text('executorId'),
  createdAt: text('createdAt').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updatedAt').notNull(),
})

export const ordersRelations = relations(orders, ({ one, many }) => ({
  client: one(users, { fields: [orders.clientId], references: [users.id], relationName: 'clientOrders' }),
  executor: one(users, { fields: [orders.executorId], references: [users.id], relationName: 'executorOrders' }),
  category: one(categories, { fields: [orders.categoryId], references: [categories.id] }),
  responses: many(responses),
  messages: many(messages),
}))

// ─── Response ────────────────────────────────────────────────────────────────
export const responses = sqliteTable('Response', {
  id: text('id').primaryKey(),
  orderId: text('orderId').notNull(),
  executorId: text('executorId').notNull(),
  message: text('message').notNull(),
  proposedBudget: real('proposedBudget'),
  proposedDeadline: text('proposedDeadline'),
  status: text('status', { enum: ['PENDING', 'ACCEPTED', 'REJECTED'] }).notNull().default('PENDING'),
  createdAt: text('createdAt').notNull().default(sql`CURRENT_TIMESTAMP`),
})

export const responsesRelations = relations(responses, ({ one }) => ({
  order: one(orders, { fields: [responses.orderId], references: [orders.id] }),
  executor: one(users, { fields: [responses.executorId], references: [users.id], relationName: 'executorResponses' }),
}))

// ─── Message ────────────────────────────────────────────────────────────────
export const messages = sqliteTable('Message', {
  id: text('id').primaryKey(),
  orderId: text('orderId'),
  conversationId: text('conversationId'),
  senderId: text('senderId').notNull(),
  content: text('content').notNull(),
  read: integer('read', { mode: 'boolean' }).notNull().default(false),
  attachmentUrl: text('attachmentUrl'),
  attachmentName: text('attachmentName'),
  attachmentType: text('attachmentType'),
  attachmentSize: integer('attachmentSize'),
  createdAt: text('createdAt').notNull().default(sql`CURRENT_TIMESTAMP`),
})

export const messagesRelations = relations(messages, ({ one }) => ({
  order: one(orders, { fields: [messages.orderId], references: [orders.id] }),
  conversation: one(conversations, { fields: [messages.conversationId], references: [conversations.id] }),
  sender: one(users, { fields: [messages.senderId], references: [users.id], relationName: 'senderMessages' }),
}))

// ─── Conversation (direct messages between users) ───────────────────────────
export const conversations = sqliteTable('Conversation', {
  id: text('id').primaryKey(),
  user1Id: text('user1Id').notNull(),
  user2Id: text('user2Id').notNull(),
  createdAt: text('createdAt').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updatedAt').notNull(),
})

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  user1: one(users, { fields: [conversations.user1Id], references: [users.id], relationName: 'convUser1' }),
  user2: one(users, { fields: [conversations.user2Id], references: [users.id], relationName: 'convUser2' }),
  messages: many(messages),
}))