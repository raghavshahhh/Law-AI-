export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from 'next/server'
import { safeDbOperation } from '@/lib/prisma'
import { callAIService } from '@/lib/ai-service'
import { getServerUser } from '@/lib/auth'
import { logResearch } from '@/lib/case-activity'

export async function POST(request: NextRequest) {
  try {
    const user = await getServerUser().catch(() => null)
    const body = await request.json()
    const { query, caseId } = body

    if (!query || typeof query !== 'string' || query.trim().length < 2) {
      return NextResponse.json({ 
        ok: false, 
        message: 'Please provide a valid search query' 
      }, { status: 400 })
    }

    const sanitizedQuery = query.trim().substring(0, 500)
    const userId = user?.id || 'anonymous'

    // Build context-aware prompt if case is linked
    let caseContext = ''
    if (caseId && user) {
      const caseData = await safeDbOperation(async () => {
        const { prisma } = await import('@/lib/prisma')
        if (!prisma) return null
        return prisma.case.findFirst({
          where: { id: caseId, userId: user.id },
          select: { title: true, caseType: true, court: true, petitioner: true, respondent: true }
        }).catch(() => null)
      }, null)
      
      if (caseData) {
        caseContext = `\n\n[Research Context: Case "${caseData.title}", Type: ${caseData.caseType}, Court: ${caseData.court || 'N/A'}]`
      }
    }

    // Generate AI-powered legal research
    const messages = [
      {
        role: 'system' as const,
        content: `You are a legal research expert specializing in Indian law. Provide comprehensive, accurate legal analysis including:
- Relevant statutory provisions (IPC, CrPC, CPC, Constitution, NI Act, etc.)
- Key case laws and precedents with citations
- Legal principles and interpretations
- Practical implications for lawyers

Format your response clearly with sections. Be specific and cite actual sections/cases.${caseContext}`
      },
      {
        role: 'user' as const,
        content: `Provide detailed legal research on: "${sanitizedQuery}"`
      }
    ]

    const aiResponse = await callAIService(messages, user ? 'PRO' : 'FREE', 2000, 0.5)
    const result = aiResponse.content

    if (!result) {
      throw new Error('No response from AI service')
    }


    // Save to database
    const savedResearch = await safeDbOperation(async () => {
      const { prisma } = await import('@/lib/prisma')
      if (!prisma) throw new Error('Database unavailable')
      
      return prisma.research.create({
        data: {
          userId,
          query: sanitizedQuery,
          result,
          type: 'all',
          caseId: caseId || null
        }
      })
    }, null)

    // Log to case timeline if case is linked
    if (savedResearch && caseId && user) {
      await logResearch(caseId, user.id, sanitizedQuery, result, savedResearch.id)
    }

    return NextResponse.json({
      ok: true,
      id: savedResearch?.id || `temp-${Date.now()}`,
      query: sanitizedQuery,
      result,
      content: result, // Alias for compatibility
      caseId,
      createdAt: savedResearch?.createdAt || new Date().toISOString()
    })
  } catch (error: any) {
    console.error('Research error:', error)
    return NextResponse.json({ 
      ok: false, 
      message: error.message || 'Research failed. Please try again.' 
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getServerUser().catch(() => null)
    const { searchParams } = new URL(request.url)
    const caseId = searchParams.get('caseId')
    const userId = user?.id || 'anonymous'

    const research = await safeDbOperation(async () => {
      const { prisma } = await import('@/lib/prisma')
      if (!prisma) return []
      
      const whereClause: any = { userId }
      if (caseId) {
        whereClause.caseId = caseId
      }
      
      return prisma.research.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          query: true,
          result: true,
          caseId: true,
          createdAt: true
        }
      })
    }, [])

    return NextResponse.json(research)
  } catch (error) {
    console.error('Get research error:', error)
    return NextResponse.json([])
  }
}
