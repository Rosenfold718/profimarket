import { Server } from 'socket.io'
import { createServer } from 'http'
import { drizzle } from 'drizzle-orm/libsql'
import { createClient } from '@libsql/client'
import { eq } from 'drizzle-orm'

// Inline schema definitions for the chat service (matching src/lib/schema.ts table names)
// We redefine them here because mini-services are independent bun projects
import { sqliteTable, text, boolean } from 'drizzle-orm/sqlite-core'

const messagesTable = sqliteTable('Message', {
  id: text('id').primaryKey(),
  orderId: text('orderId').notNull(),
  senderId: text('senderId').notNull(),
  content: text('content').notNull(),
  read: boolean('read', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('createdAt').notNull(),
})

const client = createClient({
  url: process.env.TURSO_URL || 'file:/home/z/my-project/db/custom.db',
  authToken: process.env.TURSO_AUTH_TOKEN,
})

const db = drizzle(client)

const PORT = 3003

const server = createServer()
const io = new Server(server, { cors: { origin: '*' } })

// Track which rooms each socket is in
const socketRooms = new Map<string, Set<string>>()

function getRoomName(orderId: string): string {
  return `order:${orderId}`
}

io.on('connection', (socket) => {
  console.log(`[chat] connected: ${socket.id}`)

  if (!socketRooms.has(socket.id)) {
    socketRooms.set(socket.id, new Set())
  }

  // --- joinOrder ---
  socket.on('joinOrder', (orderId: string) => {
    if (typeof orderId !== 'string' || orderId.trim() === '') {
      socket.emit('error', { event: 'joinOrder', message: 'orderId is required' })
      return
    }
    const room = getRoomName(orderId)
    socket.join(room)
    socketRooms.get(socket.id)!.add(orderId)
    console.log(`[chat] ${socket.id} joined room ${room}`)
  })

  // --- leaveOrder ---
  socket.on('leaveOrder', (orderId: string) => {
    if (typeof orderId !== 'string' || orderId.trim() === '') {
      socket.emit('error', { event: 'leaveOrder', message: 'orderId is required' })
      return
    }
    const room = getRoomName(orderId)
    socket.leave(room)
    socketRooms.get(socket.id)!.delete(orderId)
    console.log(`[chat] ${socket.id} left room ${room}`)
  })

  // --- sendMessage ---
  socket.on(
    'sendMessage',
    async (payload: { orderId: string; senderId: string; content: string }) => {
      const { orderId, senderId, content } = payload ?? {}

      // Validation
      if (typeof orderId !== 'string' || orderId.trim() === '') {
        socket.emit('error', { event: 'sendMessage', message: 'orderId is required' })
        return
      }
      if (typeof senderId !== 'string' || senderId.trim() === '') {
        socket.emit('error', { event: 'sendMessage', message: 'senderId is required' })
        return
      }
      if (typeof content !== 'string' || content.trim() === '') {
        socket.emit('error', { event: 'sendMessage', message: 'content is required' })
        return
      }
      if (content.length > 5000) {
        socket.emit('error', { event: 'sendMessage', message: 'content must be at most 5000 characters' })
        return
      }

      try {
        const now = new Date().toISOString()
        const id = crypto.randomUUID()

        const [message] = await db.insert(messagesTable).values({
          id,
          orderId,
          senderId,
          content: content.trim(),
          createdAt: now,
          read: false,
        }).returning()

        const room = getRoomName(orderId)
        // Broadcast to everyone in the room EXCEPT the sender
        socket.to(room).emit('newMessage', message)
        // Also send back to the sender so they get the server-generated id/timestamps
        socket.emit('newMessage', message)

        console.log(`[chat] message sent in ${room} by ${senderId}`)
      } catch (err: unknown) {
        console.error('[chat] sendMessage error:', err)
        socket.emit('error', { event: 'sendMessage', message: 'Failed to save message' })
      }
    },
  )

  // --- markRead ---
  socket.on(
    'markRead',
    async (payload: { orderId: string; messageId: string }) => {
      const { orderId, messageId } = payload ?? {}

      if (typeof orderId !== 'string' || orderId.trim() === '') {
        socket.emit('error', { event: 'markRead', message: 'orderId is required' })
        return
      }
      if (typeof messageId !== 'string' || messageId.trim() === '') {
        socket.emit('error', { event: 'markRead', message: 'messageId is required' })
        return
      }

      try {
        await db.update(messagesTable)
          .set({ read: true })
          .where(eq(messagesTable.id, messageId))

        const room = getRoomName(orderId)
        io.to(room).emit('messageRead', { orderId, messageId })

        console.log(`[chat] message ${messageId} marked as read in ${room}`)
      } catch (err: unknown) {
        console.error('[chat] markRead error:', err)
        socket.emit('error', { event: 'markRead', message: 'Failed to mark message as read' })
      }
    },
  )

  // --- typing ---
  socket.on(
    'typing',
    (payload: { orderId: string; userId: string }) => {
      const { orderId, userId } = payload ?? {}

      if (typeof orderId !== 'string' || orderId.trim() === '') {
        socket.emit('error', { event: 'typing', message: 'orderId is required' })
        return
      }
      if (typeof userId !== 'string' || userId.trim() === '') {
        socket.emit('error', { event: 'typing', message: 'userId is required' })
        return
      }

      const room = getRoomName(orderId)
      // Broadcast typing indicator to everyone in the room EXCEPT the typer
      socket.to(room).emit('userTyping', { orderId, userId })
    },
  )

  // --- disconnect ---
  socket.on('disconnect', () => {
    console.log(`[chat] disconnected: ${socket.id}`)
    socketRooms.delete(socket.id)
  })
})

server.listen(PORT, () => {
  console.log(`[chat] Chat service running on port ${PORT}`)
})
