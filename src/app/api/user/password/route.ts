import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-server'

export async function PUT(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin()
    const { oldPassword, newPassword } = await request.json()
    
    if (!oldPassword || !newPassword) {
      return NextResponse.json({ ok: false, message: 'Old and new passwords are required' }, { status: 400 })
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ ok: false, message: 'New password must be at least 6 characters' }, { status: 400 })
    }

    // Get user from session
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return NextResponse.json({ ok: false, message: 'Invalid session' }, { status: 401 })
    }

    // Verify old password by attempting to sign in
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password: oldPassword
    })

    if (signInError) {
      return NextResponse.json({ ok: false, message: 'Current password is incorrect' }, { status: 400 })
    }

    // Update password
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword
    })

    if (updateError) {
      console.error('Password update error:', updateError)
      return NextResponse.json({ ok: false, message: 'Failed to update password' }, { status: 500 })
    }

    return NextResponse.json({ 
      ok: true, 
      message: 'Password updated successfully' 
    })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ ok: false, message: 'Internal server error' }, { status: 500 })
  }
}