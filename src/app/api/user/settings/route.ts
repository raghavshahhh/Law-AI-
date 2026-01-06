import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin()
    
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

    // Get user settings
    const { data: settings, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Settings fetch error:', error)
      return NextResponse.json({ ok: false, message: 'Failed to fetch settings' }, { status: 500 })
    }

    // Return default settings if none exist
    const userSettings = settings || {
      emailNotifications: true,
      theme: 'light'
    }

    return NextResponse.json({ 
      ok: true, 
      settings: userSettings 
    })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ ok: false, message: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin()
    const body = await request.json()
    
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

    // Update user settings
    const { error } = await supabase
      .from('user_settings')
      .upsert({
        user_id: user.id,
        email_notifications: body.emailNotifications,
        theme: body.theme,
        updated_at: new Date().toISOString()
      })

    if (error) {
      console.error('Settings update error:', error)
      return NextResponse.json({ ok: false, message: 'Failed to update settings' }, { status: 500 })
    }

    return NextResponse.json({ 
      ok: true, 
      message: 'Settings updated successfully' 
    })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ ok: false, message: 'Internal server error' }, { status: 500 })
  }
}