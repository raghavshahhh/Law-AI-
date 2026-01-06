export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/lib/auth'
import { safeDbOperation } from '@/lib/prisma'

// GET - Fetch activities for a case (Timeline)
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getServerUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const caseId = params.id
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const limit = parseInt(searchParams.get('limit') || '50')

    const activities = await safeDbOperation(async () => {
      const { prisma } = await import('@/lib/prisma')
      if (!prisma) throw new Error('Database unavailable')

      // Try new Case model first
      try {
        const caseExists = await (prisma as any).case.findFirst({
          where: { id: caseId, userId: user.id }
        })
        if (!caseExists) throw new Error('Case not found in new schema')

        const whereClause: any = { caseId }
        if (type) {
          whereClause.type = type.toUpperCase()
        }

        return (prisma as any).caseActivity.findMany({
          where: whereClause,
          orderBy: { createdAt: 'desc' },
          take: limit
        })
      } catch (e) {
        // Fallback to CaseTracker
        const tracker = await prisma.caseTracker.findFirst({
          where: { id: caseId, userId: user.id }
        })
        if (!tracker) throw new Error('Case not found')
        
        // Return empty activities for legacy cases
        return []
      }
    }, [])

    return NextResponse.json({ activities, success: true })
  } catch (error: any) {
    console.error('Activities GET error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}


// POST - Add activity to case timeline
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getServerUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const caseId = params.id
    const body = await request.json()
    const { type, feature, title, content, metadata, referenceId } = body

    if (!type || !title || !content) {
      return NextResponse.json({ 
        error: 'type, title, and content are required' 
      }, { status: 400 })
    }

    const activity = await safeDbOperation(async () => {
      const { prisma } = await import('@/lib/prisma')
      if (!prisma) throw new Error('Database unavailable')

      // Try new schema first
      try {
        const caseExists = await (prisma as any).case.findFirst({
          where: { id: caseId, userId: user.id }
        })
        if (!caseExists) throw new Error('Case not found in new schema')

        // Create activity
        const created = await (prisma as any).caseActivity.create({
          data: {
            caseId,
            userId: user.id,
            type,
            feature: feature || null,
            title,
            content,
            metadata: metadata || null,
            referenceId: referenceId || null
          }
        })

        // Update case's updatedAt
        await (prisma as any).case.update({
          where: { id: caseId },
          data: { updatedAt: new Date() }
        })

        return created
      } catch (e) {
        // Fallback - just verify case exists in CaseTracker
        const tracker = await prisma.caseTracker.findFirst({
          where: { id: caseId, userId: user.id }
        })
        if (!tracker) throw new Error('Case not found')
        
        // Return mock activity
        return {
          id: `temp-${Date.now()}`,
          caseId,
          userId: user.id,
          type,
          feature,
          title,
          content,
          createdAt: new Date()
        }
      }
    }, null)

    if (!activity) {
      return NextResponse.json({ error: 'Failed to create activity' }, { status: 500 })
    }

    return NextResponse.json({ activity, success: true })
  } catch (error: any) {
    console.error('Activities POST error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
