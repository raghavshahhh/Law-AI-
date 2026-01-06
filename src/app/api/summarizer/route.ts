export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { safeDbOperation } from '@/lib/prisma'
import { sanitizeInput, sanitizeForLog } from '@/lib/security/input-sanitizer-enhanced'
import { callAIService } from '@/lib/ai-service'
import { checkIPRateLimit, getClientIP } from '@/lib/ip-rate-limit'
import { getServerUser } from '@/lib/auth'
import { logSummaryCreated } from '@/lib/case-activity'

const summarizerSchema = z.object({
  text: z.string().min(10).max(50000),
  title: z.string().min(1).max(200),
  caseId: z.string().uuid().optional()
})

export async function POST(request: NextRequest) {
  try {
    const user = await getServerUser().catch(() => null)
    const clientIP = getClientIP(request)
    
    // Rate limit for non-authenticated users
    if (!user) {
      const rateLimit = checkIPRateLimit(clientIP, 3)
      if (!rateLimit.allowed) {
        const hoursLeft = Math.ceil((rateLimit.resetTime - Date.now()) / (1000 * 60 * 60))
        return NextResponse.json({
          ok: false,
          message: `Daily limit reached. Try again in ${hoursLeft} hours or sign up.`,
          code: 'RATE_LIMIT_EXCEEDED'
        }, { status: 429 })
      }
    }
    
    const body = await request.json()
    const { text, title, caseId } = summarizerSchema.parse(body)
    const userId = user?.id || `ip-${clientIP}`
    const sanitizedText = sanitizeInput(text)
    const sanitizedTitle = sanitizeInput(title)

    // Generate summary using AI
    const messages = [
      {
        role: 'system' as const,
        content: `You are a legal expert specializing in summarizing Indian court judgments and legal documents.

Provide a structured summary with:
1. **Case Overview**: Brief facts and parties
2. **Key Issues**: Legal questions addressed
3. **Ratio Decidendi**: Core legal reasoning
4. **Final Order**: Judgment/decision
5. **Applicable Sections**: Relevant laws cited
6. **Practical Implications**: How this affects similar cases

Be concise but comprehensive. Use Indian legal terminology.`
      },
      {
        role: 'user' as const,
        content: `Summarize this legal document titled "${sanitizedTitle}":\n\n${sanitizedText.substring(0, 15000)}`
      }
    ]

    const aiResponse = await callAIService(messages, user ? 'PRO' : 'FREE', 1500, 0.3)
    const summary = aiResponse.content
    
    if (!summary) {
      throw new Error('No summary generated')
    }


    // Save summary to database
    const savedSummary = await safeDbOperation(async () => {
      const { prisma } = await import('@/lib/prisma')
      if (!prisma) throw new Error('Database unavailable')
      
      return prisma.summary.create({
        data: {
          userId,
          title: sanitizedTitle,
          originalText: sanitizedText.substring(0, 50000),
          summary,
          caseId: caseId || null
        }
      })
    }, null)

    // Log to case timeline if case is linked
    if (savedSummary && caseId && user) {
      await logSummaryCreated(caseId, user.id, sanitizedTitle, summary, savedSummary.id)
    }

    return NextResponse.json({
      ok: true,
      id: savedSummary?.id || 'temp-' + Date.now(),
      title: sanitizedTitle,
      summary,
      caseId,
      createdAt: savedSummary?.createdAt || new Date()
    })
  } catch (error) {
    console.error('Summarizer error:', sanitizeForLog(error))
    return NextResponse.json({ 
      ok: false, 
      message: error instanceof Error ? error.message : 'An unexpected error occurred' 
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getServerUser().catch(() => null)
    const clientIP = getClientIP(request)
    const userId = user?.id || `ip-${clientIP}`
    
    const { searchParams } = new URL(request.url)
    const caseId = searchParams.get('caseId')
    
    const summaries = await safeDbOperation(async () => {
      const { prisma } = await import('@/lib/prisma')
      if (!prisma) return []
      
      const whereClause: any = { userId }
      if (caseId) {
        whereClause.caseId = caseId
      }
      
      return prisma.summary.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          title: true,
          summary: true,
          caseId: true,
          createdAt: true
        }
      })
    }, [])

    return NextResponse.json(summaries)
  } catch (error) {
    console.error('Get summaries error:', sanitizeForLog(error))
    return NextResponse.json([])
  }
}
