import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import bcrypt from 'bcryptjs';
import { publicSchemaSQL, initializeUserSchema } from '@/lib/schema';

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    // Create users table if not exists
    await pool.query(publicSchemaSQL.createUsersTable);

    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE username = $1',
      [username]
    );

    if (existingUser.rows.length > 0) {
      return NextResponse.json(
        { error: 'Username already exists' },
        { status: 409 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const newUser = await pool.query(
      'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id, username',
      [username, hashedPassword]
    );

    const user = newUser.rows[0];

    // Create user schema
    const schemaName = `user_${user.id}`;
    await pool.query(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`);

    // Initialize tables in the new schema
    const client = await pool.connect();
    try {
      await initializeUserSchema(client, schemaName);
    } finally {
      client.release();
    }

    return NextResponse.json({
      success: true,
      user: { id: user.id, username: user.username }
    }, { status: 201 });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Registration failed' },
      { status: 500 }
    );
  }
}
