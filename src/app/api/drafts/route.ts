export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma, safeDbOperation } from '@/lib/prisma'
import { sanitizeInput } from '@/lib/security/input-sanitizer-enhanced'
import { checkIPRateLimit, getClientIP } from '@/lib/ip-rate-limit'
import { getServerUser } from '@/lib/auth'
import { logDraftCreated } from '@/lib/case-activity'

const draftSchema = z.object({
  type: z.string(),
  inputs: z.record(z.string().max(2000)).optional(),
  formData: z.record(z.string().max(2000)).optional(),
  title: z.string().optional(),
  caseId: z.string().uuid().optional()
})

const DRAFT_TEMPLATES: Record<string, string> = {
  rent: 'Rental Agreement',
  sale: 'Sale Deed',
  partnership: 'Partnership Deed',
  employment: 'Employment Contract',
  nda: 'Non-Disclosure Agreement',
  loan: 'Loan Agreement',
  legal_notice: 'Legal Notice',
  affidavit: 'Affidavit'
}

export async function POST(request: NextRequest) {
  try {
    // Try to get authenticated user
    const user = await getServerUser().catch(() => null)
    const clientIP = getClientIP(request)
    
    // Rate limit for non-authenticated users
    if (!user) {
      const rateLimit = checkIPRateLimit(clientIP, 3)
      if (!rateLimit.allowed) {
        const hoursLeft = Math.ceil((rateLimit.resetTime - Date.now()) / (1000 * 60 * 60))
        return NextResponse.json({
          ok: false,
          error: `Daily limit reached. Try again in ${hoursLeft} hours or sign up for unlimited access.`,
          code: 'RATE_LIMIT_EXCEEDED'
        }, { status: 429 })
      }
    }
    
    const body = await request.json()
    const { type, inputs, formData, title, caseId } = draftSchema.parse(body)
    const userId = user?.id || `ip-${clientIP}`
    const documentInputs = inputs || formData || {}

    // Sanitize inputs
    const sanitizedInputs: Record<string, string> = {}
    for (const [key, value] of Object.entries(documentInputs)) {
      if (typeof value === 'string' && value.trim()) {
        sanitizedInputs[key] = sanitizeInput(value.trim())
      }
    }

    const templateType = DRAFT_TEMPLATES[type] || type
    
    // Generate document
    const { generateSimpleDocument } = await import('@/lib/simple-templates')
    const content = generateSimpleDocument(type, sanitizedInputs)
    
    if (!content) {
      throw new Error('Failed to generate document')
    }

    const draftTitle = title || `${templateType} - ${new Date().toLocaleDateString('en-IN')}`


    // Save draft to database
    const savedDraft = await safeDbOperation(async () => {
      const { prisma } = await import('@/lib/prisma')
      if (!prisma) throw new Error('Database unavailable')
      
      return prisma.draft.create({
        data: {
          userId,
          type,
          title: draftTitle,
          content,
          inputs: sanitizedInputs,
          caseId: caseId || null
        }
      })
    }, null)

    // Log to case timeline if case is linked
    if (savedDraft && caseId && user) {
      await logDraftCreated(caseId, user.id, templateType, draftTitle, savedDraft.id)
    }

    return NextResponse.json({
      ok: true,
      id: savedDraft?.id || 'temp-' + Date.now(),
      title: draftTitle,
      content,
      type,
      caseId,
      createdAt: savedDraft?.createdAt || new Date()
    })
  } catch (error) {
    console.error('Draft generation error:', error)
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to generate draft'
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
    
    const drafts = await safeDbOperation(async () => {
      const { prisma } = await import('@/lib/prisma')
      if (!prisma) return []
      
      const whereClause: any = { userId }
      if (caseId) {
        whereClause.caseId = caseId
      }
      
      return prisma.draft.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          title: true,
          type: true,
          content: true,
          caseId: true,
          createdAt: true
        }
      })
    }, [])

    return NextResponse.json(drafts)
  } catch (error) {
    console.error('Drafts GET error:', error)
    return NextResponse.json([])
  }
}
