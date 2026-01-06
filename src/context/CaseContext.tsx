'use client'

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react'
import { useAuth } from './AuthContext'

export type CaseStatus = 'OPEN' | 'PENDING' | 'HEARING' | 'RESERVED' | 'DISPOSED' | 'ARCHIVED' | 'CLOSED'
export type CaseType = 'GENERAL' | 'CRIMINAL' | 'CIVIL' | 'FAMILY' | 'PROPERTY' | 'CONSUMER' | 'LABOUR' | 'TAX' | 'CORPORATE' | 'WRIT' | 'ARBITRATION' | 'CHEQUE_BOUNCE'
export type CaseStage = 'FILING' | 'NOTICE' | 'APPEARANCE' | 'FRAMING_ISSUES' | 'EVIDENCE' | 'ARGUMENTS' | 'RESERVED' | 'JUDGMENT' | 'APPEAL' | 'EXECUTION'
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'

export interface Case {
  id: string
  title: string
  cnrNumber?: string
  caseNumber?: string
  caseType: CaseType
  court?: string
  judge?: string
  petitioner?: string
  respondent?: string
  clientId?: string
  clientName?: string
  status: CaseStatus
  stage?: CaseStage
  filingDate?: string
  nextHearing?: string
  priority: Priority
  tags?: string[]
  notes?: string
  aiSummary?: string
  aiPrediction?: string
  createdAt: string
  updatedAt: string
  // Counts
  activitiesCount?: number
  hearingsCount?: number
  documentsCount?: number
}

interface CaseContextType {
  cases: Case[]
  activeCase: Case | null
  setActiveCase: (caseItem: Case | null) => void
  loadCases: () => Promise<void>
  createCase: (data: Partial<Case>) => Promise<Case | null>
  updateCase: (id: string, data: Partial<Case>) => Promise<Case | null>
  deleteCase: (id: string) => Promise<boolean>
  loading: boolean
  openCases: Case[]
  archivedCases: Case[]
  urgentCases: Case[]
  upcomingHearings: Case[]
}

const defaultCaseContext: CaseContextType = {
  cases: [],
  activeCase: null,
  setActiveCase: () => {},
  loadCases: async () => {},
  createCase: async () => null,
  updateCase: async () => null,
  deleteCase: async () => false,
  loading: false,
  openCases: [],
  archivedCases: [],
  urgentCases: [],
  upcomingHearings: []
}

const CaseContext = createContext<CaseContextType>(defaultCaseContext)


// Map API response to Case interface
function mapApiToCase(data: any): Case {
  return {
    id: data.id,
    title: data.title || data.partyName || 'Untitled Case',
    cnrNumber: data.cnrNumber || data.cnr,
    caseNumber: data.caseNumber,
    caseType: data.caseType || 'GENERAL',
    court: data.court,
    judge: data.judge,
    petitioner: data.petitioner || data.partyName,
    respondent: data.respondent,
    clientId: data.clientId,
    clientName: data.client?.name,
    status: data.status || 'OPEN',
    stage: data.stage,
    filingDate: data.filingDate,
    nextHearing: data.nextHearing || data.nextDate,
    priority: data.priority || 'MEDIUM',
    tags: data.tags || [],
    notes: data.notes,
    aiSummary: data.aiSummary,
    aiPrediction: data.aiPrediction,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    activitiesCount: data._count?.activities || 0,
    hearingsCount: data._count?.hearings || 0,
    documentsCount: data._count?.documents || 0
  }
}

// Map CaseTracker (legacy) to Case interface for backward compatibility
function mapCaseTrackerToCase(tracker: any): Case {
  const details = tracker.details || {}
  return {
    id: tracker.id,
    title: tracker.partyName || 'Untitled Case',
    cnrNumber: tracker.cnr,
    caseType: details.caseType || 'GENERAL',
    court: tracker.court,
    status: (tracker.status?.toUpperCase() as CaseStatus) || 'OPEN',
    nextHearing: tracker.nextDate ? new Date(tracker.nextDate).toISOString() : undefined,
    petitioner: tracker.partyName,
    respondent: details.respondent,
    priority: 'MEDIUM',
    createdAt: tracker.createdAt,
    updatedAt: tracker.updatedAt || tracker.lastUpdate
  }
}

export function CaseProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [cases, setCases] = useState<Case[]>([])
  const [activeCase, setActiveCaseState] = useState<Case | null>(null)
  const [loading, setLoading] = useState(false)

  const loadCases = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      // Try new Cases API first
      let response = await fetch('/api/cases')
      let data = await response.json()
      
      let mappedCases: Case[] = []
      
      if (data.cases && Array.isArray(data.cases) && data.cases.length > 0) {
        mappedCases = data.cases.map(mapApiToCase)
      } else {
        // Fallback to CaseTracker API for backward compatibility
        response = await fetch('/api/case-tracker')
        data = await response.json()
        if (data.cases && Array.isArray(data.cases)) {
          mappedCases = data.cases.map(mapCaseTrackerToCase)
        }
      }
      
      setCases(mappedCases)
      
      // Restore active case from localStorage
      if (typeof window !== 'undefined') {
        const savedCaseId = localStorage.getItem('activeCaseId')
        if (savedCaseId) {
          const savedCase = mappedCases.find((c: Case) => c.id === savedCaseId)
          if (savedCase) setActiveCaseState(savedCase)
        }
      }
    } catch (error) {
      console.error('Failed to load cases:', error)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (user) {
      loadCases()
    }
  }, [user, loadCases])

  const setActiveCase = (caseItem: Case | null) => {
    setActiveCaseState(caseItem)
    if (typeof window !== 'undefined') {
      if (caseItem) {
        localStorage.setItem('activeCaseId', caseItem.id)
      } else {
        localStorage.removeItem('activeCaseId')
      }
    }
  }

  const createCase = async (data: Partial<Case>): Promise<Case | null> => {
    try {
      const response = await fetch('/api/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      
      const result = await response.json()
      if (result.case) {
        const newCase = mapApiToCase(result.case)
        setCases(prev => [newCase, ...prev])
        return newCase
      }
      return null
    } catch (error) {
      console.error('Failed to create case:', error)
      return null
    }
  }

  const updateCase = async (id: string, data: Partial<Case>): Promise<Case | null> => {
    try {
      const response = await fetch('/api/cases', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...data })
      })
      
      const result = await response.json()
      if (result.case) {
        const updatedCase = mapApiToCase(result.case)
        setCases(prev => prev.map(c => c.id === id ? updatedCase : c))
        if (activeCase?.id === id) {
          setActiveCaseState(updatedCase)
        }
        return updatedCase
      }
      return null
    } catch (error) {
      console.error('Failed to update case:', error)
      return null
    }
  }

  const deleteCase = async (id: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/cases?id=${id}`, { method: 'DELETE' })
      if (response.ok) {
        setCases(prev => prev.filter(c => c.id !== id))
        if (activeCase?.id === id) {
          setActiveCase(null)
        }
        return true
      }
      return false
    } catch (error) {
      console.error('Failed to delete case:', error)
      return false
    }
  }

  // Computed lists
  const openCases = cases.filter(c => 
    !['DISPOSED', 'ARCHIVED', 'CLOSED'].includes(c.status)
  )
  const archivedCases = cases.filter(c => 
    ['DISPOSED', 'ARCHIVED', 'CLOSED'].includes(c.status)
  )
  const urgentCases = cases.filter(c => 
    c.priority === 'URGENT' || c.priority === 'HIGH'
  )
  const upcomingHearings = cases
    .filter(c => c.nextHearing && new Date(c.nextHearing) >= new Date())
    .sort((a, b) => new Date(a.nextHearing!).getTime() - new Date(b.nextHearing!).getTime())

  return (
    <CaseContext.Provider value={{ 
      cases, 
      activeCase, 
      setActiveCase, 
      loadCases,
      createCase,
      updateCase,
      deleteCase,
      loading,
      openCases,
      archivedCases,
      urgentCases,
      upcomingHearings
    }}>
      {children}
    </CaseContext.Provider>
  )
}

export function useCase(): CaseContextType {
  return useContext(CaseContext)
}
