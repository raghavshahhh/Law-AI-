// Helper to log activities to case timeline from any feature
import { safeDbOperation } from '@/lib/prisma'

export type ActivityType = 
  | 'AI_CHAT'
  | 'DRAFT_CREATED'
  | 'SUMMARY_CREATED'
  | 'DOCUMENT_UPLOADED'
  | 'HEARING_ADDED'
  | 'HEARING_UPDATED'
  | 'STATUS_CHANGED'
  | 'NOTE_ADDED'
  | 'RESEARCH_DONE'
  | 'NOTICE_CREATED'
  | 'CLIENT_LINKED'
  | 'CASE_CREATED'
  | 'CASE_UPDATED'

export type FeatureType = 
  | 'AI_ASSISTANT'
  | 'DOC_GENERATOR'
  | 'JUDGMENT_SUMMARIZER'
  | 'CRM'
  | 'ACTS'
  | 'NEWS'
  | 'CASE_TRACKER'
  | 'NOTICES'
  | 'DRAFTS'
  | 'RESEARCH'

interface LogActivityParams {
  caseId: string
  userId: string
  type: ActivityType
  feature?: FeatureType
  title: string
  content: string
  metadata?: Record<string, any>
  referenceId?: string
}

export async function logCaseActivity(params: LogActivityParams): Promise<boolean> {
  const { caseId, userId, type, feature, title, content, metadata, referenceId } = params

  if (!caseId || !userId) {
    console.log('logCaseActivity: Missing caseId or userId')
    return false
  }

  try {
    await safeDbOperation(async () => {
      const { prisma } = await import('@/lib/prisma')
      if (!prisma) throw new Error('Database unavailable')

      // Try to create activity in new schema
      try {
        await (prisma as any).caseActivity.create({
          data: {
            caseId,
            userId,
            type,
            feature: feature || null,
            title,
            content: content.substring(0, 10000),
            metadata: metadata || null,
            referenceId: referenceId || null
          }
        })

        // Update case's updatedAt timestamp
        await (prisma as any).case.update({
          where: { id: caseId },
          data: { updatedAt: new Date() }
        }).catch(() => {})
      } catch (e) {
        // New tables don't exist yet, fallback to updating CaseTracker
        console.log('CaseActivity table not available, using fallback')
        await prisma.caseTracker.update({
          where: { id: caseId },
          data: { 
            lastUpdate: new Date(),
            details: {
              lastActivity: {
                type,
                title,
                content: content.substring(0, 500),
                createdAt: new Date().toISOString()
              }
            }
          }
        }).catch(() => {})
      }
    }, null)

    return true
  } catch (error) {
    console.error('logCaseActivity error:', error)
    return false
  }
}

// Shorthand helpers for common activities
export const logAIChat = (caseId: string, userId: string, question: string, answer: string) =>
  logCaseActivity({
    caseId,
    userId,
    type: 'AI_CHAT',
    feature: 'AI_ASSISTANT',
    title: question.substring(0, 100),
    content: answer,
    metadata: { question }
  })

export const logDraftCreated = (caseId: string, userId: string, draftType: string, title: string, draftId: string) =>
  logCaseActivity({
    caseId,
    userId,
    type: 'DRAFT_CREATED',
    feature: 'DRAFTS',
    title: `Draft: ${title}`,
    content: `Created ${draftType} document`,
    referenceId: draftId,
    metadata: { draftType }
  })

export const logSummaryCreated = (caseId: string, userId: string, docTitle: string, summary: string, summaryId: string) =>
  logCaseActivity({
    caseId,
    userId,
    type: 'SUMMARY_CREATED',
    feature: 'JUDGMENT_SUMMARIZER',
    title: `Summary: ${docTitle}`,
    content: summary.substring(0, 2000),
    referenceId: summaryId,
    metadata: { docTitle }
  })

export const logResearch = (caseId: string, userId: string, query: string, result: string, researchId: string) =>
  logCaseActivity({
    caseId,
    userId,
    type: 'RESEARCH_DONE',
    feature: 'RESEARCH',
    title: `Research: ${query.substring(0, 80)}`,
    content: result.substring(0, 2000),
    referenceId: researchId,
    metadata: { query }
  })

export const logNoticeCreated = (caseId: string, userId: string, noticeType: string, recipient: string, noticeId: string) =>
  logCaseActivity({
    caseId,
    userId,
    type: 'NOTICE_CREATED',
    feature: 'NOTICES',
    title: `Notice to ${recipient}`,
    content: `Created ${noticeType} notice`,
    referenceId: noticeId,
    metadata: { noticeType, recipient }
  })

export const logDocumentUploaded = (caseId: string, userId: string, filename: string, fileId: string) =>
  logCaseActivity({
    caseId,
    userId,
    type: 'DOCUMENT_UPLOADED',
    feature: 'DOC_GENERATOR',
    title: `Uploaded: ${filename}`,
    content: `Document "${filename}" was uploaded to the case`,
    referenceId: fileId,
    metadata: { filename }
  })

export const logNoteAdded = (caseId: string, userId: string, note: string) =>
  logCaseActivity({
    caseId,
    userId,
    type: 'NOTE_ADDED',
    feature: 'CASE_TRACKER',
    title: 'Note Added',
    content: note
  })
