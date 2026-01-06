'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/context/AuthContext'
import { User, Lock, Bell, Palette, Save, Eye, EyeOff, X } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { getSupabase } from '@/lib/supabase'

interface SettingsModalProps {
  open: boolean
  onClose: () => void
}

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const { user, profile, refreshProfile } = useAuth()
  
  // Profile form state
  const [profileForm, setProfileForm] = useState({
    fullName: '',
    phone: '',
    organization: ''
  })
  
  // Password form state
  const [passwordForm, setPasswordForm] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  
  // Settings state
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  
  // Loading states
  const [profileLoading, setProfileLoading] = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)
  
  // Password visibility
  const [showPasswords, setShowPasswords] = useState({
    old: false,
    new: false,
    confirm: false
  })

  // Initialize form with profile data
  useEffect(() => {
    if (open) {
      setProfileForm({
        fullName: profile?.fullName || user?.user_metadata?.full_name || '',
        phone: profile?.phone || '',
        organization: profile?.organization || ''
      })
      
      // Detect current theme from DOM
      const isDark = document.documentElement.classList.contains('dark')
      setTheme(isDark ? 'dark' : 'light')
      
      // Load user settings
      loadUserSettings()
    }
  }, [profile, user, open])

  // Load user settings from server
  const loadUserSettings = async () => {
    try {
      const supabase = getSupabase()
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return

      const response = await fetch('/api/user/settings', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.ok && data.settings) {
          setEmailNotifications(data.settings.email_notifications ?? true)
          // Don't override theme from server, use current DOM state
        }
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
    }
  }

  const handleProfileUpdate = async () => {
    if (!profileForm.fullName.trim()) {
      toast.error('Name is required')
      return
    }

    setProfileLoading(true)
    try {
      const supabase = getSupabase()
      // Get auth session
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        toast.error('Please log in again')
        return
      }
      
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          fullName: profileForm.fullName.trim(),
          phone: profileForm.phone.trim() || undefined,
          organization: profileForm.organization.trim() || undefined
        })
      })

      const data = await response.json()
      
      if (data.ok) {
        toast.success(data.message || 'Profile updated successfully')
        await refreshProfile()
      } else {
        toast.error(data.message || 'Failed to update profile')
      }
    } catch (error) {
      console.error('Profile update error:', error)
      toast.error('Error updating profile')
    } finally {
      setProfileLoading(false)
    }
  }

  const handlePasswordUpdate = async () => {
    if (!passwordForm.oldPassword || !passwordForm.newPassword) {
      toast.error('All password fields are required')
      return
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('New passwords do not match')
      return
    }

    if (passwordForm.newPassword.length < 6) {
      toast.error('New password must be at least 6 characters')
      return
    }

    setPasswordLoading(true)
    try {
      const supabase = getSupabase()
      // Update password directly with Supabase
      const { error } = await supabase.auth.updateUser({
        password: passwordForm.newPassword
      })

      if (error) {
        toast.error(error.message || 'Failed to update password')
      } else {
        toast.success('Password updated successfully')
        setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' })
        setShowPasswords({ old: false, new: false, confirm: false })
      }
    } catch (error) {
      console.error('Password update error:', error)
      toast.error('Error updating password')
    } finally {
      setPasswordLoading(false)
    }
  }

  const handleNotificationToggle = async (enabled: boolean) => {
    const previousState = emailNotifications
    setEmailNotifications(enabled)
    
    try {
      // Get CSRF token
      const csrfResponse = await fetch('/api/csrf-token')
      const csrfData = await csrfResponse.json()
      
      const response = await fetch('/api/user/settings', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfData.token
        },
        body: JSON.stringify({ emailNotifications: enabled })
      })
      
      const data = await response.json()
      
      if (data.ok) {
        toast.success('Notification settings updated')
      } else {
        // Revert on failure
        setEmailNotifications(previousState)
        toast.error(data.message || 'Failed to update notification settings')
      }
    } catch (error) {
      // Revert on error
      setEmailNotifications(previousState)
      console.error('Settings update error:', error)
      toast.error('Failed to update notification settings')
    }
  }

  const handleThemeChange = async (newTheme: 'light' | 'dark') => {
    setTheme(newTheme)
    
    // Apply theme immediately using the same logic as ThemeProvider
    document.documentElement.classList.toggle('dark', newTheme === 'dark')
    document.documentElement.setAttribute('data-theme', newTheme)
    document.documentElement.style.colorScheme = newTheme
    localStorage.setItem('law-ai-theme', newTheme)
    
    // Update theme-color meta tag
    const metaThemeColor = document.querySelector('meta[name="theme-color"]')
    const themeColor = newTheme === 'dark' ? '#111827' : '#ffffff'
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', themeColor)
    }
    
    toast.success(`Switched to ${newTheme} mode`)
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <User className="h-5 w-5" />
            <span>Account Settings</span>
          </DialogTitle>
        </DialogHeader>
        
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none z-10"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>

        <Tabs defaultValue="profile" className="w-full flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="profile" className="flex items-center space-x-1">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">Profile</span>
            </TabsTrigger>
            <TabsTrigger value="password" className="flex items-center space-x-1">
              <Lock className="h-4 w-4" />
              <span className="hidden sm:inline">Password</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center space-x-1">
              <Bell className="h-4 w-4" />
              <span className="hidden sm:inline">Notifications</span>
            </TabsTrigger>
            <TabsTrigger value="theme" className="flex items-center space-x-1">
              <Palette className="h-4 w-4" />
              <span className="hidden sm:inline">Theme</span>
            </TabsTrigger>
          </TabsList>

          {/* Profile Information Tab */}
          <TabsContent value="profile" className="space-y-4 flex-1 overflow-y-auto">
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>
                  Update your personal information and contact details
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full Name *</Label>
                    <Input
                      id="fullName"
                      value={profileForm.fullName}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, fullName: e.target.value }))}
                      placeholder="Enter your full name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      value={user?.email || ''}
                      disabled
                      className="bg-gray-50"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      value={profileForm.phone}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="Enter your phone number"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="organization">Organization</Label>
                    <Input
                      id="organization"
                      value={profileForm.organization}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, organization: e.target.value }))}
                      placeholder="Enter your organization"
                    />
                  </div>
                </div>

                <Button 
                  onClick={handleProfileUpdate} 
                  disabled={profileLoading}
                  className="w-full md:w-auto"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {profileLoading ? 'Saving...' : 'Save Changes'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Password Management Tab */}
          <TabsContent value="password" className="space-y-4 flex-1 overflow-y-auto">
            <Card>
              <CardHeader>
                <CardTitle>Password Management</CardTitle>
                <CardDescription>
                  Update your account password for better security
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="oldPassword">Current Password *</Label>
                  <div className="relative">
                    <Input
                      id="oldPassword"
                      type={showPasswords.old ? 'text' : 'password'}
                      value={passwordForm.oldPassword}
                      onChange={(e) => setPasswordForm(prev => ({ ...prev, oldPassword: e.target.value }))}
                      placeholder="Enter current password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowPasswords(prev => ({ ...prev, old: !prev.old }))}
                    >
                      {showPasswords.old ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password *</Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type={showPasswords.new ? 'text' : 'password'}
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                      placeholder="Enter new password (min 6 characters)"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
                    >
                      {showPasswords.new ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password *</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showPasswords.confirm ? 'text' : 'password'}
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      placeholder="Confirm new password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
                    >
                      {showPasswords.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div className="bg-blue-50 p-3 rounded-lg">
                  <p className="text-sm text-blue-700">
                    <strong>Password Requirements:</strong>
                    <br />• Minimum 6 characters
                    <br />• Use a strong, unique password
                  </p>
                </div>

                <Button 
                  onClick={handlePasswordUpdate} 
                  disabled={passwordLoading}
                  className="w-full md:w-auto"
                >
                  <Lock className="h-4 w-4 mr-2" />
                  {passwordLoading ? 'Updating...' : 'Update Password'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="space-y-4 flex-1 overflow-y-auto">
            <Card>
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
                <CardDescription>
                  Manage how you receive notifications from LAW-AI
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Email Notifications</Label>
                    <p className="text-sm text-gray-500">
                      Receive updates about your account and legal documents
                    </p>
                  </div>
                  <Switch
                    checked={emailNotifications}
                    onCheckedChange={handleNotificationToggle}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Plan Expiry Alerts</Label>
                    <p className="text-sm text-gray-500">
                      Get notified before your subscription expires
                    </p>
                  </div>
                  <Switch checked={true} disabled />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Feature Updates</Label>
                    <p className="text-sm text-gray-500">
                      Stay informed about new features and improvements
                    </p>
                  </div>
                  <Switch checked={emailNotifications} onCheckedChange={() => {}} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Theme Tab */}
          <TabsContent value="theme" className="space-y-4 flex-1 overflow-y-auto">
            <Card>
              <CardHeader>
                <CardTitle>Appearance</CardTitle>
                <CardDescription>
                  Customize the look and feel of your dashboard
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <Label className="text-base">Theme Preference</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <Button
                      variant={theme === 'light' ? 'default' : 'outline'}
                      onClick={() => handleThemeChange('light')}
                      className="h-20 flex flex-col items-center justify-center space-y-2"
                    >
                      <div className="w-8 h-8 bg-white border-2 border-gray-300 rounded"></div>
                      <span>Light Mode</span>
                    </Button>
                    <Button
                      variant={theme === 'dark' ? 'default' : 'outline'}
                      onClick={() => handleThemeChange('dark')}
                      className="h-20 flex flex-col items-center justify-center space-y-2"
                    >
                      <div className="w-8 h-8 bg-gray-800 border-2 border-gray-600 rounded"></div>
                      <span>Dark Mode</span>
                    </Button>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <p className="text-sm text-gray-500">
                    Your theme preference will be saved and applied across all sessions.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}