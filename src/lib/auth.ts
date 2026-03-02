import pool from './db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { setCurrentUser } from './db';

export interface User {
  id: number;
  username: string;
  password: string;
  created_at: Date;
}

export interface JWTPayload {
  userId: number;
  username: string;
}

// JWT configuration
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-me';
const JWT_EXPIRY = '7d'; // 7 days

export function generateToken(userId: number, username: string): string {
  const payload: JWTPayload = { userId, username };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}

export async function findUserByUsername(username: string): Promise<User | null> {
  const result = await pool.query(
    'SELECT * FROM public.users WHERE username = $1',
    [username]
  );
  return result.rows[0] || null;
}

export async function verifyPassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(plainPassword, hashedPassword);
}

export function getSchemaForUser(userId: number): string {
  return `user_${userId}`;
}

// Auth middleware for API routes
export async function authenticateRequest(request: Request): Promise<{ userId: number; username: string; schema: string } | null> {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return null;

  const cookies = Object.fromEntries(
    cookieHeader.split('; ').map(c => c.split('='))
  );

  const token = cookies['token'];
  if (!token) return null;

  const payload = verifyToken(token);
  if (!payload) return null;

  // Verify user exists in database (use public schema explicitly)
  const userResult = await pool.query(
    'SELECT id, username FROM public.users WHERE id = $1',
    [payload.userId]
  );
  if (userResult.rows.length === 0) {
    return null;
  }

  // Set current user in db context
  setCurrentUser(payload.userId);

  return {
    userId: payload.userId,
    username: payload.username,
    schema: getSchemaForUser(payload.userId)
  };
}

// Helper to set token cookie
export function setTokenCookie(token: string): string {
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toUTCString();
  return `token=${token}; Path=/; HttpOnly; SameSite=Lax; Expires=${expires}`;
}

export function clearTokenCookie(): string {
  return 'token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0';
}

// Require authentication - throws error if not authenticated
export async function requireAuth(request: Request): Promise<{ userId: number; username: string; schema: string }> {
  const auth = await authenticateRequest(request);
  if (!auth) {
    throw new Error('Unauthorized');
  }
  return auth;
}
