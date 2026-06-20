import { NextRequest, NextResponse } from 'next/server';
import * as q from '@/lib/queries';
import { authenticate } from '@/lib/auth';
import type { RegisterInput, LoginInput, JoinAsGuestInput } from '@/lib/types';

// POST /api/auth — register, login, or join as guest
// Body: { action: 'register' | 'login' | 'guest', ... }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === 'register') {
      const input = body as RegisterInput;
      if (!input.username || !input.password) {
        return NextResponse.json({ error: 'username and password required' }, { status: 400 });
      }
      if (input.password.length < 6) {
        return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
      }
      const result = await q.registerUser(input);
      return NextResponse.json(result);
    }

    if (action === 'login') {
      const input = body as LoginInput;
      if (!input.username || !input.password) {
        return NextResponse.json({ error: 'username and password required' }, { status: 400 });
      }
      try {
        const result = await q.loginUser(input);
        return NextResponse.json(result);
      } catch {
        return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
      }
    }

    if (action === 'guest') {
      const input = body as JoinAsGuestInput;
      if (!input.name || !input.name.trim()) {
        return NextResponse.json({ error: 'name required' }, { status: 400 });
      }
      const result = await q.joinAsGuest(input);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: 'Invalid action. Use register, login, or guest.' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Authentication failed';
    // Distinguish "username taken" (409) from generic errors
    const status = message.includes('already taken') ? 409 : 500;
    console.error('POST /api/auth error:', error);
    return NextResponse.json({ error: message }, { status });
  }
}

// GET /api/auth — verify session and return current user info
export async function GET(req: NextRequest) {
  try {
    const session = await authenticate(req);
    if (!session) {
      return NextResponse.json({ authenticated: false }, { status: 200 });
    }
    return NextResponse.json({ authenticated: true, session });
  } catch (error) {
    console.error('GET /api/auth error:', error);
    return NextResponse.json({ error: 'Failed to verify session' }, { status: 500 });
  }
}

// DELETE /api/auth — logout (delete session)
export async function DELETE(req: NextRequest) {
  try {
    const auth = req.headers.get('authorization');
    const match = auth?.match(/^Bearer\s+(.+)$/i);
    const token = match ? match[1] : null;
    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 400 });
    }
    await q.deleteSession(token);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/auth error:', error);
    return NextResponse.json({ error: 'Failed to logout' }, { status: 500 });
  }
}