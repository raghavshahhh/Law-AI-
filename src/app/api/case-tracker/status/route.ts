import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function PATCH(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin()
    const { data: { user } } = await supabase.auth.getUser(
      request.cookies.get('sb-access-token')?.value || ''
    )
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { caseId, status } = body

    if (!caseId || !status) {
      return NextResponse.json({ error: 'Missing caseId or status' }, { status: 400 })
    }

    // Validate status
    const validStatuses = ['OPEN', 'ARCHIVED', 'CLOSED']
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    // Get current case details
    const { data: caseData, error: fetchError } = await supabase
      .from('case_tracker')
      .select('details')
      .eq('id', caseId)
      .eq('user_id', user.id)
      .single()

    if (fetchError) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 })
    }

    // Update case with new status in details
    const details = caseData?.details || {}
    details.caseStatus = status
    details.statusUpdatedAt = new Date().toISOString()

    // Add to timeline
    const timeline = details.timeline || []
    timeline.push({
      id: crypto.randomUUID(),
      type: 'status_change',
      title: `Case ${status.toLowerCase()}`,
      description: `Status changed to ${status}`,
      createdAt: new Date().toISOString()
    })
    details.timeline = timeline

    const { error: updateError } = await supabase
      .from('case_tracker')
      .update({ 
        details,
        last_update: new Date().toISOString()
      })
      .eq('id', caseId)
      .eq('user_id', user.id)

    if (updateError) {
      console.error('Update error:', updateError)
      return NextResponse.json({ error: 'Failed to update status' }, { status: 500 })
    }

    return NextResponse.json({ success: true, status })
  } catch (error: any) {
    console.error('Case status error:', error)
    return NextResponse.json({ error: 'Failed to update case status' }, { status: 500 })
  }
}
