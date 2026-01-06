import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin()
    
    const { data: { user } } = await supabase.auth.getUser(
      request.cookies.get('sb-access-token')?.value || ''
    )
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const caseId = searchParams.get('caseId')

    if (!caseId) {
      return NextResponse.json({ error: 'Missing caseId' }, { status: 400 })
    }

    // Get case details
    const { data: caseData } = await supabase
      .from('case_tracker')
      .select('*')
      .eq('id', caseId)
      .eq('user_id', user.id)
      .single()

    if (!caseData) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 })
    }

    // Count documents for this case
    const { count: documentsGenerated } = await supabase
      .from('drafts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    // Count AI assists (chat sessions)
    const { count: aiAssists } = await supabase
      .from('chat_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    // Count files uploaded
    const { count: filesUploaded } = await supabase
      .from('uploaded_files')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    // Calculate health score based on activity
    const details = caseData.details || {}
    const timeline = details.timeline || []
    
    let healthScore = 20
    healthScore += Math.min((documentsGenerated || 0) * 10, 30)
    healthScore += Math.min((aiAssists || 0) * 5, 25)
    healthScore += Math.min((filesUploaded || 0) * 5, 15)
    healthScore += Math.min(timeline.length * 2, 10)
    healthScore = Math.min(healthScore, 100)

    const estimatedTimeSaved = 
      (documentsGenerated || 0) * 15 + 
      (aiAssists || 0) * 5 + 
      (filesUploaded || 0) * 2

    return NextResponse.json({
      documentsGenerated: documentsGenerated || 0,
      aiAssists: aiAssists || 0,
      filesUploaded: filesUploaded || 0,
      lastActivity: caseData.last_update || caseData.created_at,
      estimatedTimeSaved,
      healthScore
    })
  } catch (error: any) {
    console.error('Case health error:', error)
    return NextResponse.json({ error: 'Failed to fetch case health' }, { status: 500 })
  }
}
