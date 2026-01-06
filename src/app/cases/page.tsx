'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useCase, Case, CaseType, CaseStatus, Priority } from '@/context/CaseContext'
import { toast, Toaster } from 'react-hot-toast'
import { 
  Plus, Search, Briefcase, Calendar, MapPin, Clock, 
  Filter, ChevronRight, Scale, AlertTriangle, CheckCircle,
  Loader2, X, Target, Gavel, Users
} from 'lucide-react'
import Link from 'next/link'

const caseTypes: { value: CaseType; label: string }[] = [
  { value: 'GENERAL', label: 'General' },
  { value: 'CRIMINAL', label: 'Criminal' },
  { value: 'CIVIL', label: 'Civil' },
  { value: 'FAMILY', label: 'Family' },
  { value: 'PROPERTY', label: 'Property' },
  { value: 'CONSUMER', label: 'Consumer' },
  { value: 'CHEQUE_BOUNCE', label: 'Cheque Bounce (138 NI)' },
  { value: 'LABOUR', label: 'Labour' },
  { value: 'WRIT', label: 'Writ Petition' },
  { value: 'ARBITRATION', label: 'Arbitration' }
]

const priorities: { value: Priority; label: string; color: string }[] = [
  { value: 'LOW', label: 'Low', color: 'bg-green-100 text-green-700' },
  { value: 'MEDIUM', label: 'Medium', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'HIGH', label: 'High', color: 'bg-orange-100 text-orange-700' },
  { value: 'URGENT', label: 'Urgent', color: 'bg-red-100 text-red-700' }
]

export default function CasesPage() {
  const { user, profile } = useAuth()
  const { cases, activeCase, setActiveCase, createCase, loading, loadCases, openCases, archivedCases, urgentCases, upcomingHearings } = useCase()
  
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [filterType, setFilterType] = useState<string>('')
  const [creating, setCreating] = useState(false)
  
  const [formData, setFormData] = useState({
    title: '',
    cnrNumber: '',
    caseType: 'GENERAL' as CaseType,
    court: '',
    petitioner: '',
    respondent: '',
    nextHearing: '',
    priority: 'MEDIUM' as Priority,
    notes: ''
  })

  useEffect(() => {
    if (user) {
      loadCases()
    }
  }, [user])


  const handleCreateCase = async () => {
    if (!formData.title.trim()) {
      toast.error('Please enter a case title')
      return
    }

    setCreating(true)
    try {
      const newCase = await createCase({
        title: formData.title.trim(),
        cnrNumber: formData.cnrNumber.trim() || undefined,
        caseType: formData.caseType,
        court: formData.court.trim() || undefined,
        petitioner: formData.petitioner.trim() || undefined,
        respondent: formData.respondent.trim() || undefined,
        nextHearing: formData.nextHearing || undefined,
        priority: formData.priority,
        notes: formData.notes.trim() || undefined
      })

      if (newCase) {
        toast.success('Case created successfully')
        setShowCreateModal(false)
        setFormData({
          title: '', cnrNumber: '', caseType: 'GENERAL', court: '',
          petitioner: '', respondent: '', nextHearing: '', priority: 'MEDIUM', notes: ''
        })
        // Set as active case
        setActiveCase(newCase)
      } else {
        toast.error('Failed to create case')
      }
    } catch (error) {
      toast.error('Failed to create case')
    } finally {
      setCreating(false)
    }
  }

  const filteredCases = cases.filter(c => {
    const matchesSearch = 
      c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.cnrNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.petitioner?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.respondent?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = !filterStatus || c.status === filterStatus
    const matchesType = !filterType || c.caseType === filterType
    return matchesSearch && matchesStatus && matchesType
  })

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
    return priorities.find(p => p.value === priority)?.color || 'bg-gray-100 text-gray-600'
  }

  return (
    <div className="max-w-5xl mx-auto px-2 sm:px-0">
      <Toaster position="top-right" />
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">My Cases</h1>
          <p className="text-gray-500 text-sm mt-1">
            {activeCase 
              ? `Active: ${activeCase.title}` 
              : 'Manage your legal cases'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
            {profile?.plan || 'FREE'}
          </span>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium rounded-xl transition-colors"
          >
            <Plus className="h-4 w-4" />
            New Case
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-gray-500">Open Cases</p>
              <p className="text-xl sm:text-2xl font-semibold text-gray-900">{openCases.length}</p>
            </div>
            <Briefcase className="h-8 w-8 text-gray-200" />
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-gray-500">Urgent</p>
              <p className="text-xl sm:text-2xl font-semibold text-red-600">{urgentCases.length}</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-red-100" />
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-gray-500">Upcoming Hearings</p>
              <p className="text-xl sm:text-2xl font-semibold text-blue-600">{upcomingHearings.length}</p>
            </div>
            <Calendar className="h-8 w-8 text-blue-100" />
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-gray-500">Disposed</p>
              <p className="text-xl sm:text-2xl font-semibold text-gray-600">{archivedCases.length}</p>
            </div>
            <CheckCircle className="h-8 w-8 text-gray-200" />
          </div>
        </div>
      </div>


      {/* Search and Filter */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search cases..."
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 text-sm"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          >
            <option value="">All Status</option>
            <option value="OPEN">Open</option>
            <option value="PENDING">Pending</option>
            <option value="HEARING">Hearing</option>
            <option value="DISPOSED">Disposed</option>
          </select>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          >
            <option value="">All Types</option>
            {caseTypes.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Cases List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : filteredCases.length > 0 ? (
        <div className="space-y-4">
          {filteredCases.map((caseItem) => (
            <Link
              key={caseItem.id}
              href={`/cases/${caseItem.id}`}
              className={`block bg-white border rounded-2xl p-4 sm:p-5 hover:border-gray-300 transition-colors ${
                activeCase?.id === caseItem.id ? 'border-gray-900 ring-1 ring-gray-900' : 'border-gray-200'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    activeCase?.id === caseItem.id ? 'bg-gray-900' : 'bg-gray-100'
                  }`}>
                    <Scale className={`h-6 w-6 ${activeCase?.id === caseItem.id ? 'text-white' : 'text-gray-600'}`} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-900">{caseItem.title}</h3>
                      {activeCase?.id === caseItem.id && (
                        <span className="px-2 py-0.5 bg-gray-900 text-white text-[10px] font-medium rounded">ACTIVE</span>
                      )}
                    </div>
                    {caseItem.cnrNumber && (
                      <p className="text-sm text-gray-500 mt-0.5">CNR: {caseItem.cnrNumber}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded ${getStatusColor(caseItem.status)}`}>
                        {caseItem.status}
                      </span>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded ${getPriorityColor(caseItem.priority)}`}>
                        {caseItem.priority}
                      </span>
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                        {caseItem.caseType}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-col items-end gap-2">
                  {caseItem.nextHearing && (
                    <div className="flex items-center gap-1.5 text-sm text-blue-600">
                      <Calendar className="h-4 w-4" />
                      {new Date(caseItem.nextHearing).toLocaleDateString('en-IN')}
                    </div>
                  )}
                  {caseItem.court && (
                    <div className="flex items-center gap-1.5 text-sm text-gray-500">
                      <MapPin className="h-4 w-4" />
                      <span className="truncate max-w-[150px]">{caseItem.court}</span>
                    </div>
                  )}
                  <ChevronRight className="h-5 w-5 text-gray-400" />
                </div>
              </div>
              
              {(caseItem.petitioner || caseItem.respondent) && (
                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2 text-sm text-gray-600">
                  <Users className="h-4 w-4 text-gray-400" />
                  <span>{caseItem.petitioner || 'N/A'}</span>
                  <span className="text-gray-400">vs</span>
                  <span>{caseItem.respondent || 'N/A'}</span>
                </div>
              )}
            </Link>
          ))}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl p-8 sm:p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Briefcase className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Cases Yet</h3>
          <p className="text-gray-500 text-sm mb-4">Create your first case to start using LAW.AI</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium rounded-xl"
          >
            <Plus className="h-4 w-4 inline mr-2" />
            Create First Case
          </button>
        </div>
      )}


      {/* Create Case Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 sticky top-0 bg-white">
              <h2 className="text-lg font-semibold text-gray-900">Create New Case</h2>
              <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-gray-100 rounded-xl">
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Case Title <span className="text-red-500">*</span>
                </label>
                <input
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g., Ram vs State of Delhi"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">CNR Number</label>
                  <input
                    value={formData.cnrNumber}
                    onChange={(e) => setFormData(prev => ({ ...prev, cnrNumber: e.target.value.toUpperCase() }))}
                    placeholder="DLHC010234562024"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Case Type</label>
                  <select
                    value={formData.caseType}
                    onChange={(e) => setFormData(prev => ({ ...prev, caseType: e.target.value as CaseType }))}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 text-sm"
                  >
                    {caseTypes.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Court</label>
                <input
                  value={formData.court}
                  onChange={(e) => setFormData(prev => ({ ...prev, court: e.target.value }))}
                  placeholder="e.g., Delhi High Court"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Petitioner</label>
                  <input
                    value={formData.petitioner}
                    onChange={(e) => setFormData(prev => ({ ...prev, petitioner: e.target.value }))}
                    placeholder="Petitioner name"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Respondent</label>
                  <input
                    value={formData.respondent}
                    onChange={(e) => setFormData(prev => ({ ...prev, respondent: e.target.value }))}
                    placeholder="Respondent name"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Next Hearing</label>
                  <input
                    type="date"
                    value={formData.nextHearing}
                    onChange={(e) => setFormData(prev => ({ ...prev, nextHearing: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Priority</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value as Priority }))}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 text-sm"
                  >
                    {priorities.map(p => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Any additional notes..."
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 text-sm resize-none"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  onClick={() => setShowCreateModal(false)} 
                  className="flex-1 py-3 border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleCreateCase}
                  disabled={creating || !formData.title.trim()}
                  className="flex-1 py-3 bg-gray-900 hover:bg-gray-800 text-white font-medium rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {creating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Case'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
