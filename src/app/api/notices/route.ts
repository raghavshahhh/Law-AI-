export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from 'next/server'
import { safeDbOperation } from '@/lib/prisma'
import { callAIService } from '@/lib/ai-service'
import { getServerUser } from '@/lib/auth'
import { logNoticeCreated } from '@/lib/case-activity'

export async function POST(request: NextRequest) {
  try {
    const user = await getServerUser().catch(() => null)
    const body = await request.json()
    const { noticeType, recipient, recipientAddress, subject, details, amount, dueDate, caseId } = body

    if (!recipient || !subject) {
      return NextResponse.json({ 
        ok: false, 
        message: 'Recipient and subject are required' 
      }, { status: 400 })
    }

    const userId = user?.id || 'anonymous'

    // Build context for AI
    let context = `Notice Type: ${noticeType || 'Legal Notice'}
Recipient: ${recipient}
${recipientAddress ? `Address: ${recipientAddress}` : ''}
Subject: ${subject}
${amount ? `Amount: ₹${amount}` : ''}
${dueDate ? `Due Date: ${dueDate}` : ''}
${details ? `Additional Details: ${details}` : ''}`

    // Get case context if linked
    if (caseId && user) {
      const caseData = await safeDbOperation(async () => {
        const { prisma } = await import('@/lib/prisma')
        if (!prisma) return null
        return prisma.case.findFirst({
          where: { id: caseId, userId: user.id },
          select: { title: true, cnrNumber: true, court: true, petitioner: true, respondent: true }
        }).catch(() => null)
      }, null)
      
      if (caseData) {
        context += `\n\nCase Reference: ${caseData.title}${caseData.cnrNumber ? ` (CNR: ${caseData.cnrNumber})` : ''}`
      }
    }

    // Generate legal notice using AI
    const messages = [
      {
        role: 'system' as const,
        content: `You are a legal expert specializing in drafting formal legal notices under Indian law. Generate professional legal notices with:
- Proper legal formatting and structure
- Formal legal language appropriate for Indian courts
- Reference to relevant Indian laws and sections
- Clear demands and timelines
- Professional closing with advocate details placeholder

Do not use asterisks for formatting. Use proper headings and paragraphs.`
      },
      {
        role: 'user' as const,
        content: `Generate a professional legal notice:\n\n${context}\n\nFormat it as a formal legal notice ready to be sent.`
      }
    ]

    const aiResponse = await callAIService(messages, user ? 'PRO' : 'FREE', 2000, 0.3)
    const content = aiResponse.content

    if (!content) {
      throw new Error('Failed to generate notice')
    }


    // Save to database
    const savedNotice = await safeDbOperation(async () => {
      const { prisma } = await import('@/lib/prisma')
      if (!prisma) throw new Error('Database unavailable')
      
      return prisma.notice.create({
        data: {
          userId,
          type: noticeType || 'legal',
          title: subject,
          content,
          recipient,
          caseId: caseId || null
        }
      })
    }, null)

    // Log to case timeline if case is linked
    if (savedNotice && caseId && user) {
      await logNoticeCreated(caseId, user.id, noticeType || 'Legal Notice', recipient, savedNotice.id)
    }

    return NextResponse.json({
      ok: true,
      id: savedNotice?.id || `temp-${Date.now()}`,
      content,
      notice: content, // Alias
      type: noticeType,
      recipient,
      subject,
      caseId,
      createdAt: savedNotice?.createdAt || new Date().toISOString()
    })
  } catch (error: any) {
    console.error('Notice generation error:', error)
    return NextResponse.json({ 
      ok: false, 
      message: error.message || 'Failed to generate notice' 
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getServerUser().catch(() => null)
    const { searchParams } = new URL(request.url)
    const caseId = searchParams.get('caseId')
    const userId = user?.id || 'anonymous'

    const notices = await safeDbOperation(async () => {
      const { prisma } = await import('@/lib/prisma')
      if (!prisma) return []
      
      const whereClause: any = { userId }
      if (caseId) {
        whereClause.caseId = caseId
      }
      
      return prisma.notice.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          type: true,
          title: true,
          content: true,
          recipient: true,
          caseId: true,
          createdAt: true
        }
      })
    }, [])

    // Map to expected format
    const formattedNotices = notices.map((n: any) => ({
      id: n.id,
      type: n.type,
      subject: n.title,
      content: n.content,
      recipient: n.recipient,
      caseId: n.caseId,
      createdAt: n.createdAt
    }))

    return NextResponse.json(formattedNotices)
  } catch (error) {
    console.error('Get notices error:', error)
    return NextResponse.json([])
  }
}
