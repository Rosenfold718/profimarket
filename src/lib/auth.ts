import { SignJWT, jwtVerify } from 'jose'
import { createHash, randomBytes } from 'crypto'

const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'dev-secret-change-in-prod')

// Password hashing via PBKDF2 (works in any Node.js runtime, no Bun dependency)
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex')
  const hash = createHash('sha256')
    .update(salt + password)
    .digest('hex')
  return `${salt}:${hash}`
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [salt, hash] = storedHash.split(':')
  if (!salt || !hash) return false
  const computed = createHash('sha256')
    .update(salt + password)
    .digest('hex')
  return computed === hash
}

export interface JwtPayload {
  userId: string
  email: string
  role: string
}

export async function signToken(payload: JwtPayload): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret)
}

export async function verifyToken(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret)
    return payload as unknown as JwtPayload
  } catch {
    return null
  }
}

export function getTokenFromHeaders(headers: Headers): string | null {
  const auth = headers.get('authorization')
  if (auth?.startsWith('Bearer ')) return auth.slice(7)
  const cookie = headers.get('cookie') || ''
  const match = cookie.match(/token=([^;]+)/)
  return match ? match[1] : null
}
