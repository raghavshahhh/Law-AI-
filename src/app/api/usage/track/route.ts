import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin()
    const { data: { user } } = await supabase.auth.getUser(
      request.cookies.get('sb-access-token')?.value || ''
    )
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { type, caseId, metadata } = body

    // Map type to feature
    const featureMap: Record<string, string> = {
      'ai_message': 'AI_ASSISTANT',
      'draft': 'DOC_GENERATOR',
      'summary': 'JUDGMENT_SUMMARIZER',
      'file_upload': 'CASE_TRACKER',
      'research': 'RESEARCH',
      'notice': 'NOTICES'
    }

    const feature = featureMap[type] || 'AI_ASSISTANT'

    // Upsert usage event
    const { error: usageError } = await supabase
      .from('usage_events')
      .upsert({
        user_id: user.id,
        feature,
        count: 1,
        created_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,feature'
      })

    if (usageError) {
      console.error('Usage tracking error:', usageError)
    }

    // If caseId provided, add to case timeline
    if (caseId) {
      await addToTimeline(user.id, caseId, type, metadata)
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Usage track error:', error)
    return NextResponse.json({ error: 'Failed to track usage' }, { status: 500 })
  }
}

async function addToTimeline(userId: string, caseId: string, type: string, metadata?: any) {
  try {
    const supabase = getSupabaseAdmin()
    // Get or create timeline table entry
    // For now, we'll store timeline in case_tracker details JSON
    const { data: caseData } = await supabase
      .from('case_tracker')
      .select('details')
      .eq('id', caseId)
      .eq('user_id', userId)
      .single()

    const details = caseData?.details || {}
    const timeline = details.timeline || []

    timeline.push({
      id: crypto.randomUUID(),
      type,
      title: getTimelineTitle(type),
      description: metadata?.description || null,
      createdAt: new Date().toISOString()
    })

    await supabase
      .from('case_tracker')
      .update({ 
        details: { ...details, timeline },
        last_update: new Date().toISOString()
      })
      .eq('id', caseId)
      .eq('user_id', userId)
  } catch (error) {
    console.error('Timeline update error:', error)
  }
}

function getTimelineTitle(type: string): string {
  const titles: Record<string, string> = {
    'ai_message': 'AI conversation',
    'draft': 'Document generated',
    'summary': 'Judgment summarized',
    'file_upload': 'File uploaded',
    'research': 'Research conducted',
    'notice': 'Notice created',
    'hearing': 'Hearing updated',
    'note': 'Note added'
  }
  return titles[type] || 'Activity recorded'
}
