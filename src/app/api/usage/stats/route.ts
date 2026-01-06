import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin()
    
    // Get user from auth header
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '') || request.cookies.get('sb-access-token')?.value
    
    if (!token) {
      // Try to get user from Supabase session
      const { data: { user }, error: authError } = await supabase.auth.getUser(
        request.cookies.get('sb-access-token')?.value || ''
      )
      
      if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    // Get user ID from cookie or session
    const { data: { user } } = await supabase.auth.getUser(token || '')
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = user.id
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)

    // Get AI messages today
    const { count: aiMessagesToday } = await supabase
      .from('chat_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', today.toISOString())

    // Get drafts this month
    const { count: draftsThisMonth } = await supabase
      .from('drafts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', firstOfMonth.toISOString())

    // Get active cases (status = OPEN or no status)
    const { count: activeCases } = await supabase
      .from('case_tracker')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .or('status.eq.OPEN,status.eq.Pending,status.is.null')

    // Get total files uploaded
    const { count: filesUploaded } = await supabase
      .from('uploaded_files')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)

    // Get summaries this month
    const { count: summariesThisMonth } = await supabase
      .from('summaries')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', firstOfMonth.toISOString())

    return NextResponse.json({
      aiMessagesToday: aiMessagesToday || 0,
      draftsThisMonth: draftsThisMonth || 0,
      activeCases: activeCases || 0,
      filesUploaded: filesUploaded || 0,
      summariesThisMonth: summariesThisMonth || 0,
      lastUpdated: new Date().toISOString()
    })
  } catch (error: any) {
    console.error('Usage stats error:', error)
    return NextResponse.json({ error: 'Failed to fetch usage stats' }, { status: 500 })
  }
}
