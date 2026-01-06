import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { sanitizeForLog } from '@/lib/security/input-sanitizer-enhanced'

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin()
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Sign in with Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (error) {
      console.error('Login error:', sanitizeForLog(error))
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      )
    }

    if (data.user && data.session) {
      return NextResponse.json({
        message: 'Login successful',
        user: {
          id: data.user.id,
          email: data.user.email,
          name: data.user.user_metadata?.full_name || data.user.user_metadata?.name
        },
        session: {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token
        }
      })
    }

    return NextResponse.json(
      { error: 'Invalid credentials' },
      { status: 401 }
    )

  } catch (error) {
    console.error('Login API error:', sanitizeForLog(error))
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}