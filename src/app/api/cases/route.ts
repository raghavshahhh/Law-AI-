export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/lib/auth'
import { safeDbOperation } from '@/lib/prisma'

// GET - Fetch all cases for user
export async function GET(request: NextRequest) {
  try {
    const user = await getServerUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const includeActivities = searchParams.get('includeActivities') === 'true'

    const cases = await safeDbOperation(async () => {
      const { prisma } = await import('@/lib/prisma')
      if (!prisma) throw new Error('Database unavailable')

      // Try new Case model first
      try {
        const whereClause: any = { userId: user.id }
        if (status && status !== 'all') {
          whereClause.status = status.toUpperCase()
        }

        return await (prisma as any).case.findMany({
          where: whereClause,
          include: {
            client: true,
            activities: includeActivities ? {
              orderBy: { createdAt: 'desc' },
              take: 10
            } : false,
            _count: { select: { activities: true, hearings: true, documents: true } }
          },
          orderBy: [
            { nextHearing: 'asc' },
            { updatedAt: 'desc' }
          ]
        })
      } catch (e) {
        // Fallback to CaseTracker for backward compatibility
        console.log('Case table not available, using CaseTracker fallback')
        const trackers = await prisma.caseTracker.findMany({
          where: { userId: user.id },
          orderBy: [
            { nextDate: 'asc' },
            { updatedAt: 'desc' }
          ]
        })
        
        // Map CaseTracker to Case-like structure
        return trackers.map((t: any) => ({
          id: t.id,
          title: t.partyName,
          cnrNumber: t.cnr,
          caseType: (t.details as any)?.caseType || 'GENERAL',
          court: t.court,
          status: t.status?.toUpperCase() || 'OPEN',
          nextHearing: t.nextDate,
          petitioner: t.partyName,
          respondent: (t.details as any)?.respondent,
          priority: 'MEDIUM',
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
          _count: { activities: 0, hearings: 0, documents: 0 }
        }))
      }
    }, [])

    return NextResponse.json({ cases, success: true })
  } catch (error: any) {
    console.error('Cases GET error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}


// POST - Create new case
export async function POST(request: NextRequest) {
  try {
    const user = await getServerUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      title, cnrNumber, caseNumber, caseType, court, judge,
      petitioner, respondent, clientId, clientRole,
      filingDate, nextHearing, priority, tags, notes
    } = body

    if (!title?.trim()) {
      return NextResponse.json({ error: 'Case title is required' }, { status: 400 })
    }

    const newCase = await safeDbOperation(async () => {
      const { prisma } = await import('@/lib/prisma')
      if (!prisma) throw new Error('Database unavailable')

      // Try new Case model first
      try {
        const created = await (prisma as any).case.create({
          data: {
            userId: user.id,
            title: title.trim(),
            cnrNumber: cnrNumber?.trim() || null,
            caseNumber: caseNumber?.trim() || null,
            caseType: caseType || 'GENERAL',
            court: court?.trim() || null,
            judge: judge?.trim() || null,
            petitioner: petitioner?.trim() || null,
            respondent: respondent?.trim() || null,
            clientId: clientId || null,
            clientRole: clientRole || null,
            filingDate: filingDate ? new Date(filingDate) : null,
            nextHearing: nextHearing ? new Date(nextHearing) : null,
            priority: priority || 'MEDIUM',
            tags: tags || [],
            notes: notes?.trim() || null
          },
          include: { client: true }
        })

        // Create activity for case creation
        await (prisma as any).caseActivity.create({
          data: {
            caseId: created.id,
            userId: user.id,
            type: 'CASE_CREATED',
            feature: 'CASE_TRACKER',
            title: 'Case Created',
            content: `Case "${title}" was created`,
            metadata: { caseType, court, petitioner, respondent }
          }
        }).catch(() => {})

        return created
      } catch (e) {
        // Fallback to CaseTracker
        console.log('Case table not available, using CaseTracker fallback')
        const created = await prisma.caseTracker.create({
          data: {
            userId: user.id,
            cnr: cnrNumber?.trim() || `TEMP-${Date.now()}`,
            partyName: petitioner?.trim() || title.trim(),
            court: court?.trim() || 'Not specified',
            status: 'Pending',
            nextDate: nextHearing ? new Date(nextHearing) : null,
            lastUpdate: new Date(),
            details: {
              title,
              caseType: caseType || 'GENERAL',
              respondent: respondent?.trim(),
              priority: priority || 'MEDIUM',
              notes: notes?.trim()
            }
          }
        })
        
        // Return in Case-like structure
        return {
          id: created.id,
          title: title.trim(),
          cnrNumber: created.cnr,
          caseType: caseType || 'GENERAL',
          court: created.court,
          status: 'OPEN',
          nextHearing: created.nextDate,
          petitioner: created.partyName,
          respondent: respondent?.trim(),
          priority: priority || 'MEDIUM',
          createdAt: created.createdAt,
          updatedAt: created.updatedAt
        }
      }
    }, null)

    if (!newCase) {
      return NextResponse.json({ error: 'Failed to create case' }, { status: 500 })
    }

    return NextResponse.json({ case: newCase, success: true })
  } catch (error: any) {
    console.error('Cases POST error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PATCH - Update case
export async function PATCH(request: NextRequest) {
  try {
    const user = await getServerUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'Case ID is required' }, { status: 400 })
    }

    const updatedCase = await safeDbOperation(async () => {
      const { prisma } = await import('@/lib/prisma')
      if (!prisma) throw new Error('Database unavailable')

      // Try new Case model first
      try {
        const existing = await (prisma as any).case.findFirst({
          where: { id, userId: user.id }
        })
        if (!existing) throw new Error('Case not found in new schema')

        // Build update data
        const updateData: any = {}
        const allowedFields = [
          'title', 'cnrNumber', 'caseNumber', 'caseType', 'court', 'judge',
          'petitioner', 'respondent', 'clientId', 'clientRole', 'status', 'stage',
          'filingDate', 'nextHearing', 'disposedDate', 'priority', 'tags', 'notes',
          'aiSummary', 'aiPrediction'
        ]

        for (const field of allowedFields) {
          if (updates[field] !== undefined) {
            if (['filingDate', 'nextHearing', 'disposedDate'].includes(field)) {
              updateData[field] = updates[field] ? new Date(updates[field]) : null
            } else {
              updateData[field] = updates[field]
            }
          }
        }

        const updated = await (prisma as any).case.update({
          where: { id },
          data: updateData,
          include: { client: true }
        })

        // Log status change
        if (updates.status && updates.status !== existing.status) {
          await (prisma as any).caseActivity.create({
            data: {
              caseId: id,
              userId: user.id,
              type: 'STATUS_CHANGED',
              feature: 'CASE_TRACKER',
              title: 'Status Updated',
              content: `Status changed from ${existing.status} to ${updates.status}`,
              metadata: { oldStatus: existing.status, newStatus: updates.status }
            }
          }).catch(() => {})
        }

        return updated
      } catch (e) {
        // Fallback to CaseTracker
        const existing = await prisma.caseTracker.findFirst({
          where: { id, userId: user.id }
        })
        if (!existing) throw new Error('Case not found')

        const updateData: any = { lastUpdate: new Date() }
        if (updates.nextHearing) updateData.nextDate = new Date(updates.nextHearing)
        if (updates.court) updateData.court = updates.court
        if (updates.status) updateData.status = updates.status

        const updated = await prisma.caseTracker.update({
          where: { id },
          data: updateData
        })

        return {
          id: updated.id,
          title: updated.partyName,
          cnrNumber: updated.cnr,
          court: updated.court,
          status: updated.status?.toUpperCase() || 'OPEN',
          nextHearing: updated.nextDate,
          updatedAt: updated.updatedAt
        }
      }
    }, null)

    if (!updatedCase) {
      return NextResponse.json({ error: 'Failed to update case' }, { status: 500 })
    }

    return NextResponse.json({ case: updatedCase, success: true })
  } catch (error: any) {
    console.error('Cases PATCH error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Delete case
export async function DELETE(request: NextRequest) {
  try {
    const user = await getServerUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Case ID is required' }, { status: 400 })
    }

    await safeDbOperation(async () => {
      const { prisma } = await import('@/lib/prisma')
      if (!prisma) throw new Error('Database unavailable')

      // Try new Case model first
      try {
        const existing = await (prisma as any).case.findFirst({
          where: { id, userId: user.id }
        })
        if (!existing) throw new Error('Case not found in new schema')

        await (prisma as any).case.delete({ where: { id } })
      } catch (e) {
        // Fallback to CaseTracker
        const existing = await prisma.caseTracker.findFirst({
          where: { id, userId: user.id }
        })
        if (!existing) throw new Error('Case not found')

        await prisma.caseTracker.delete({ where: { id } })
      }
    }, null)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Cases DELETE error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
