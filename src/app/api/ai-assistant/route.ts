export const dynamic = "force-dynamic"
import { NextRequest, NextResponse } from 'next/server'
import { getServerUser } from '@/lib/auth'
import { safeDbOperation } from '@/lib/prisma'
import { logAIChat } from '@/lib/case-activity'

// REFINED Indian Law System Prompt - Optimized for Lawyers
const INDIAN_LAW_SYSTEM_PROMPT = `You are LAW.AI, an Indian legal assistant for advocates.

RULES:
- Use only Indian law (IPC, CrPC, CPC, NI Act, Constitution, Evidence Act, etc.)
- Always cite relevant sections when applicable (e.g., "Section 420 IPC", "Section 138 NI Act")
- Explain in simple language that clients can understand
- Add "💡 Practical Tip for Lawyer:" at the end when helpful
- Ask ONE follow-up question if it would help provide better advice
- Do NOT repeat legal disclaimers in every response
- Respond in the same language as the query (Hindi, English, or Hinglish)

KNOWLEDGE AREAS:
- Criminal: IPC, CrPC, POCSO, NDPS, SC/ST Act
- Civil: CPC, Specific Relief Act, Limitation Act
- Family: Hindu Marriage Act, Hindu Succession, Divorce, Maintenance
- Property: Transfer of Property Act, Registration Act, RERA
- Commercial: NI Act (Section 138), Companies Act, Arbitration Act
- Consumer: Consumer Protection Act 2019
- Constitutional: Fundamental Rights, Writs (Article 32, 226)
- Cyber: IT Act 2000
- Labour: Industrial Disputes Act, Factories Act

COURT PROCEDURES:
- Filing FIR, complaints, petitions
- Bail (regular, anticipatory, interim)
- Appeals and revisions
- Execution proceedings
- Limitation periods

FORMAT:
- Be concise but complete
- Use bullet points for steps/procedures
- Cite landmark cases when relevant
- Provide practical next steps

You are helpful, accurate, and focused on actionable legal guidance.`

// Build case context for AI
function buildCaseContext(caseData: any): string {
  if (!caseData) return ''
  
  let context = `\n\n[ACTIVE CASE CONTEXT]\n`
  context += `Title: ${caseData.title || 'N/A'}\n`
  if (caseData.cnrNumber) context += `CNR: ${caseData.cnrNumber}\n`
  if (caseData.caseType) context += `Type: ${caseData.caseType}\n`
  if (caseData.court) context += `Court: ${caseData.court}\n`
  if (caseData.judge) context += `Judge: ${caseData.judge}\n`
  if (caseData.petitioner) context += `Petitioner: ${caseData.petitioner}\n`
  if (caseData.respondent) context += `Respondent: ${caseData.respondent}\n`
  if (caseData.status) context += `Status: ${caseData.status}\n`
  if (caseData.stage) context += `Stage: ${caseData.stage}\n`
  if (caseData.nextHearing) context += `Next Hearing: ${caseData.nextHearing}\n`
  if (caseData.aiSummary) context += `Case Summary: ${caseData.aiSummary}\n`
  context += `\nProvide advice specifically relevant to this case context when applicable.`
  
  return context
}


export async function GET(request: NextRequest) {
  try {
    const user = await getServerUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const caseId = searchParams.get('caseId')

    const chats = await safeDbOperation(async () => {
      const { prisma } = await import('@/lib/prisma')
      if (!prisma) throw new Error('Database unavailable')
      
      const whereClause: any = { userId: user.id }
      if (caseId) {
        whereClause.caseId = caseId
      }
      
      const sessions = await prisma.chatSession.findMany({
        where: whereClause,
        include: { 
          messages: { 
            orderBy: { createdAt: 'asc' },
            take: 10 
          } 
        },
        orderBy: { updatedAt: 'desc' },
        take: 20
      })

      return sessions.flatMap(session => {
        return session.messages
          .filter(msg => msg.role === 'user')
          .map(msg => ({
            id: msg.id,
            prompt: msg.content,
            createdAt: msg.createdAt.toISOString(),
            caseId: session.caseId
          }))
      })
    }, [])

    return NextResponse.json(chats)
  } catch (error) {
    console.error('AI Assistant GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch chats' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getServerUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { prompt, message, caseId, history } = body
    const userPrompt = prompt || message
    
    if (!userPrompt?.trim()) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
    }

    // Fetch case data if caseId provided
    let caseData = null
    if (caseId) {
      caseData = await safeDbOperation(async () => {
        const { prisma } = await import('@/lib/prisma')
        if (!prisma) return null
        
        // Try new Case model first
        let caseRecord = await prisma.case.findFirst({
          where: { id: caseId, userId: user.id }
        }).catch(() => null)
        
        if (caseRecord) {
          return {
            title: caseRecord.title,
            cnrNumber: caseRecord.cnrNumber,
            caseType: caseRecord.caseType,
            court: caseRecord.court,
            judge: caseRecord.judge,
            status: caseRecord.status,
            stage: caseRecord.stage,
            nextHearing: caseRecord.nextHearing?.toISOString().split('T')[0],
            petitioner: caseRecord.petitioner,
            respondent: caseRecord.respondent,
            aiSummary: caseRecord.aiSummary
          }
        }
        
        // Fallback to CaseTracker
        const tracker = await prisma.caseTracker.findUnique({
          where: { id: caseId }
        }).catch(() => null)
        
        if (!tracker) return null
        
        const details = tracker.details as any || {}
        return {
          title: tracker.partyName,
          cnrNumber: tracker.cnr,
          caseType: details.caseType || 'General',
          court: tracker.court,
          status: tracker.status,
          nextHearing: tracker.nextDate?.toISOString().split('T')[0],
          petitioner: tracker.partyName,
          respondent: details.respondent || 'Unknown'
        }
      }, null)
    }

    // Build system prompt with case context
    let systemPrompt = INDIAN_LAW_SYSTEM_PROMPT
    if (caseData) {
      systemPrompt += buildCaseContext(caseData)
    }

    // Build conversation history
    const conversationHistory: Array<{ role: 'system' | 'user' | 'assistant', content: string }> = [
      { role: 'system', content: systemPrompt }
    ]

    if (history && Array.isArray(history)) {
      history.slice(-6).forEach((msg: { role: string, content: string }) => {
        if (msg.role === 'user' || msg.role === 'assistant') {
          conversationHistory.push({
            role: msg.role as 'user' | 'assistant',
            content: msg.content
          })
        }
      })
    }

    conversationHistory.push({ role: 'user', content: userPrompt })

    // Get AI response
    const { callAIService } = await import('@/lib/ai-service')
    
    let userPlan = 'FREE'
    try {
      const { prisma } = await import('@/lib/prisma')
      if (prisma) {
        const userProfile = await prisma.userApp.findUnique({
          where: { userId: user.id },
          select: { plan: true }
        })
        userPlan = userProfile?.plan || 'FREE'
      }
    } catch (e) {
      console.log('Could not fetch user plan, using FREE')
    }
    
    const aiResponse = await callAIService(conversationHistory, userPlan, 2000, 0.7)
    const response = aiResponse.content

    // Save to database
    const savedData = await safeDbOperation(async () => {
      const { prisma } = await import('@/lib/prisma')
      if (!prisma) return null
      
      const titleContent = userPrompt.substring(0, 50) + (userPrompt.length > 50 ? '...' : '')
      
      // Find or create session for this case
      let session = caseId 
        ? await prisma.chatSession.findFirst({
            where: { userId: user.id, caseId },
            orderBy: { updatedAt: 'desc' }
          })
        : null

      if (!session) {
        session = await prisma.chatSession.create({
          data: {
            userId: user.id,
            caseId: caseId || null,
            title: titleContent
          }
        })
      }

      // Save messages
      const [, assistantMsg] = await prisma.$transaction([
        prisma.chatMessage.create({
          data: {
            sessionId: session.id,
            role: 'user',
            content: userPrompt,
            citations: []
          }
        }),
        prisma.chatMessage.create({
          data: {
            sessionId: session.id,
            role: 'assistant',
            content: response,
            citations: []
          }
        }),
        prisma.chatSession.update({
          where: { id: session.id },
          data: { updatedAt: new Date() }
        })
      ])

      // Log to case timeline if case is linked
      if (caseId) {
        await logAIChat(caseId, user.id, userPrompt, response)
      }
      
      return { sessionId: session.id, messageId: assistantMsg.id }
    }, null)
    
    return NextResponse.json({
      response,
      message: response,
      success: true,
      caseId,
      sessionId: savedData?.sessionId,
      messageId: savedData?.messageId
    })
  } catch (error: any) {
    console.error('AI Assistant POST error:', error)
    
    const fallbackResponse = `I apologize, but I'm experiencing technical difficulties. 

Quick resources:
• Indian Kanoon (indiankanoon.org) - Case law database
• eCourts (ecourts.gov.in) - Case status
• Legislative.gov.in - Acts and laws

Please try again or consult a qualified advocate.`
    
    return NextResponse.json({
      response: fallbackResponse,
      message: fallbackResponse,
      success: false,
      error: error.message
    })
  }
}
