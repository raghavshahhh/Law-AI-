'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useCase, Case } from '@/context/CaseContext'
import { toast, Toaster } from 'react-hot-toast'
import { 
  ArrowLeft, Briefcase, Calendar, MapPin, User, Users, Clock, 
  MessageSquare, FileText, BookOpen, Bell, Scale, Sparkles,
  ChevronRight, Edit, Trash2, Plus, CheckCircle, AlertTriangle,
  Loader2, History, Target, Gavel
} from 'lucide-react'
import Link from 'next/link'

interface Activity {
  id: string
  type: string
  feature?: string
  title: string
  content: string
  metadata?: any
  createdAt: string
}

const activityIcons: Record<string, any> = {
  AI_CHAT: MessageSquare,
  DRAFT_CREATED: FileText,
  SUMMARY_CREATED: BookOpen,
  DOCUMENT_UPLOADED: FileText,
  HEARING_ADDED: Calendar,
  HEARING_UPDATED: Calendar,
  STATUS_CHANGED: Target,
  NOTE_ADDED: Edit,
  RESEARCH_DONE: BookOpen,
  NOTICE_CREATED: Bell,
  CASE_CREATED: Briefcase,
  CASE_UPDATED: Edit
}

const activityColors: Record<string, string> = {
  AI_CHAT: 'bg-blue-100 text-blue-600',
  DRAFT_CREATED: 'bg-green-100 text-green-600',
  SUMMARY_CREATED: 'bg-purple-100 text-purple-600',
  RESEARCH_DONE: 'bg-indigo-100 text-indigo-600',
  NOTICE_CREATED: 'bg-orange-100 text-orange-600',
  HEARING_ADDED: 'bg-yellow-100 text-yellow-600',
  STATUS_CHANGED: 'bg-gray-100 text-gray-600',
  CASE_CREATED: 'bg-gray-900 text-white'
}


export default function CaseDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const { setActiveCase } = useCase()
  
  const [caseData, setCaseData] = useState<Case | null>(null)
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'timeline' | 'details' | 'hearings'>('timeline')

  const caseId = params.id as string

  useEffect(() => {
    if (caseId && user) {
      loadCaseData()
      loadActivities()
    }
  }, [caseId, user])

  const loadCaseData = async () => {
    try {
      const response = await fetch(`/api/cases?includeActivities=false`)
      const data = await response.json()
      if (data.cases) {
        const found = data.cases.find((c: any) => c.id === caseId)
        if (found) {
          setCaseData(found)
        }
      }
    } catch (error) {
      console.error('Failed to load case:', error)
      toast.error('Failed to load case')
    } finally {
      setLoading(false)
    }
  }

  const loadActivities = async () => {
    try {
      const response = await fetch(`/api/cases/${caseId}/activities?limit=50`)
      const data = await response.json()
      if (data.activities) {
        setActivities(data.activities)
      }
    } catch (error) {
      console.error('Failed to load activities:', error)
    }
  }

  const handleSetActive = () => {
    if (caseData) {
      setActiveCase(caseData)
      toast.success(`Now working on: ${caseData.title}`)
    }
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      OPEN: 'bg-green-100 text-green-700',
      PENDING: 'bg-yellow-100 text-yellow-700',
      HEARING: 'bg-blue-100 text-blue-700',
      DISPOSED: 'bg-gray-100 text-gray-600',
      ARCHIVED: 'bg-gray-100 text-gray-500'
    }
    return colors[status] || 'bg-gray-100 text-gray-600'
  }

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      URGENT: 'bg-red-100 text-red-700',
      HIGH: 'bg-orange-100 text-orange-700',
      MEDIUM: 'bg-yellow-100 text-yellow-700',
      LOW: 'bg-green-100 text-green-700'
    }
    return colors[priority] || 'bg-gray-100 text-gray-600'
  }

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!caseData) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <Briefcase className="h-12 w-12 text-gray-300 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Case Not Found</h2>
        <p className="text-gray-500 mb-4">This case doesn't exist or you don't have access.</p>
        <Link href="/case-tracker" className="text-gray-900 hover:underline">
          ← Back to Cases
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-2 sm:px-0">
      <Toaster position="top-right" />
      
      {/* Header */}
      <div className="mb-6">
        <button 
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 bg-gray-900 rounded-2xl flex items-center justify-center flex-shrink-0">
              <Scale className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{caseData.title}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                {caseData.cnrNumber && (
                  <span className="text-sm text-gray-500">CNR: {caseData.cnrNumber}</span>
                )}
                <span className={`px-2.5 py-1 text-xs font-medium rounded-lg ${getStatusColor(caseData.status)}`}>
                  {caseData.status}
                </span>
                <span className={`px-2.5 py-1 text-xs font-medium rounded-lg ${getPriorityColor(caseData.priority)}`}>
                  {caseData.priority}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handleSetActive}
              className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium rounded-xl transition-colors"
            >
              Set as Active
            </button>
          </div>
        </div>
      </div>


      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
            <MapPin className="h-4 w-4" />
            Court
          </div>
          <p className="font-medium text-gray-900 truncate">{caseData.court || 'Not specified'}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
            <Calendar className="h-4 w-4" />
            Next Hearing
          </div>
          <p className="font-medium text-gray-900">
            {caseData.nextHearing 
              ? new Date(caseData.nextHearing).toLocaleDateString('en-IN')
              : 'Not scheduled'}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
            <History className="h-4 w-4" />
            Activities
          </div>
          <p className="font-medium text-gray-900">{activities.length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
            <Target className="h-4 w-4" />
            Stage
          </div>
          <p className="font-medium text-gray-900">{caseData.stage || 'Filing'}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
        {[
          { id: 'timeline', label: 'Timeline', icon: History },
          { id: 'details', label: 'Details', icon: FileText },
          { id: 'hearings', label: 'Hearings', icon: Gavel }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Timeline Tab */}
      {activeTab === 'timeline' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Case Timeline</h2>
            <p className="text-sm text-gray-500">{activities.length} activities</p>
          </div>
          
          {activities.length > 0 ? (
            <div className="space-y-3">
              {activities.map((activity, index) => {
                const Icon = activityIcons[activity.type] || History
                const colorClass = activityColors[activity.type] || 'bg-gray-100 text-gray-600'
                
                return (
                  <div key={activity.id} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorClass}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      {index < activities.length - 1 && (
                        <div className="w-0.5 flex-1 bg-gray-200 my-2" />
                      )}
                    </div>
                    <div className="flex-1 pb-4">
                      <div className="bg-white border border-gray-200 rounded-xl p-4">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h3 className="font-medium text-gray-900">{activity.title}</h3>
                          <span className="text-xs text-gray-400 whitespace-nowrap">
                            {new Date(activity.createdAt).toLocaleDateString('en-IN')}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 line-clamp-3">{activity.content}</p>
                        {activity.feature && (
                          <span className="inline-block mt-2 px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded">
                            {activity.feature.replace('_', ' ')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center">
              <History className="h-10 w-10 text-gray-300 mx-auto mb-4" />
              <h3 className="font-medium text-gray-900 mb-2">No Activity Yet</h3>
              <p className="text-sm text-gray-500 mb-4">
                Start using AI Assistant, Drafts, or Research with this case to see activity here.
              </p>
              <button
                onClick={handleSetActive}
                className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium rounded-xl"
              >
                Set as Active & Start Working
              </button>
            </div>
          )}
        </div>
      )}

      {/* Details Tab */}
      {activeTab === 'details' && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Case Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="text-sm text-gray-500">Petitioner</label>
              <p className="font-medium text-gray-900">{caseData.petitioner || 'Not specified'}</p>
            </div>
            <div>
              <label className="text-sm text-gray-500">Respondent</label>
              <p className="font-medium text-gray-900">{caseData.respondent || 'Not specified'}</p>
            </div>
            <div>
              <label className="text-sm text-gray-500">Case Type</label>
              <p className="font-medium text-gray-900">{caseData.caseType}</p>
            </div>
            <div>
              <label className="text-sm text-gray-500">Judge</label>
              <p className="font-medium text-gray-900">{caseData.judge || 'Not assigned'}</p>
            </div>
            <div>
              <label className="text-sm text-gray-500">Filing Date</label>
              <p className="font-medium text-gray-900">
                {caseData.filingDate 
                  ? new Date(caseData.filingDate).toLocaleDateString('en-IN')
                  : 'Not specified'}
              </p>
            </div>
            <div>
              <label className="text-sm text-gray-500">Client</label>
              <p className="font-medium text-gray-900">{caseData.clientName || 'Not linked'}</p>
            </div>
          </div>
          
          {caseData.notes && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <label className="text-sm text-gray-500">Notes</label>
              <p className="mt-1 text-gray-700 whitespace-pre-wrap">{caseData.notes}</p>
            </div>
          )}
          
          {caseData.aiSummary && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4 text-gray-500" />
                <label className="text-sm text-gray-500">AI Summary</label>
              </div>
              <p className="text-gray-700 whitespace-pre-wrap">{caseData.aiSummary}</p>
            </div>
          )}
        </div>
      )}

      {/* Hearings Tab */}
      {activeTab === 'hearings' && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Hearings</h2>
            <button className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg">
              <Plus className="h-4 w-4 inline mr-1" />
              Add Hearing
            </button>
          </div>
          
          {caseData.nextHearing ? (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Calendar className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Next Hearing</p>
                  <p className="text-sm text-gray-600">
                    {new Date(caseData.nextHearing).toLocaleDateString('en-IN', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <Calendar className="h-10 w-10 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No hearings scheduled</p>
            </div>
          )}
        </div>
      )}

      {/* Quick Actions */}
      <div className="mt-6 bg-gray-50 border border-gray-200 rounded-2xl p-4">
        <h3 className="text-sm font-medium text-gray-900 mb-3">Quick Actions</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Link
            href="/ai-assistant"
            onClick={handleSetActive}
            className="flex items-center gap-2 p-3 bg-white border border-gray-200 rounded-xl hover:border-gray-300 transition-colors"
          >
            <MessageSquare className="h-5 w-5 text-gray-600" />
            <span className="text-sm font-medium text-gray-900">AI Chat</span>
          </Link>
          <Link
            href="/drafts"
            onClick={handleSetActive}
            className="flex items-center gap-2 p-3 bg-white border border-gray-200 rounded-xl hover:border-gray-300 transition-colors"
          >
            <FileText className="h-5 w-5 text-gray-600" />
            <span className="text-sm font-medium text-gray-900">Create Draft</span>
          </Link>
          <Link
            href="/research"
            onClick={handleSetActive}
            className="flex items-center gap-2 p-3 bg-white border border-gray-200 rounded-xl hover:border-gray-300 transition-colors"
          >
            <BookOpen className="h-5 w-5 text-gray-600" />
            <span className="text-sm font-medium text-gray-900">Research</span>
          </Link>
          <Link
            href="/summarizer"
            onClick={handleSetActive}
            className="flex items-center gap-2 p-3 bg-white border border-gray-200 rounded-xl hover:border-gray-300 transition-colors"
          >
            <Sparkles className="h-5 w-5 text-gray-600" />
            <span className="text-sm font-medium text-gray-900">Summarize</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
