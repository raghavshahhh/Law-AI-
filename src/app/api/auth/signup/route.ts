import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin()
    const { email, password, fullName } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Create user with Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: fullName?.trim() || '',
        }
      }
    })

    if (error) {
      console.error('Signup error:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    if (data.user) {
      return NextResponse.json({
        message: 'User created successfully',
        user: {
          id: data.user.id,
          email: data.user.email,
          emailConfirmed: !!data.user.email_confirmed_at
        }
      })
    }

    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    )

  } catch (error) {
    console.error('Signup API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}