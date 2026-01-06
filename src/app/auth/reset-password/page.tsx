'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import toast from 'react-hot-toast'
import { Eye, EyeOff, Lock, Loader2 } from 'lucide-react'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isValidSession, setIsValidSession] = useState(false)
  const [isCheckingSession, setIsCheckingSession] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const handleAuthStateChange = async () => {
      try {
        const supabase = getSupabase()
        setIsCheckingSession(true)
        
        // First, check if there are tokens in the URL hash (from email link)
        const hashParams = new URLSearchParams(window.location.hash.substring(1))
        const accessToken = hashParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token')
        const type = hashParams.get('type')
        
        console.log('URL Hash params:', { 
          hasAccessToken: !!accessToken, 
          hasRefreshToken: !!refreshToken, 
          type 
        })
        
        if (type === 'recovery' && accessToken && refreshToken) {
          console.log('Setting session from URL tokens...')
          
          // Set the session with the tokens from the URL
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          })
          
          if (error) {
            console.error('Session error:', error)
            setError('Invalid or expired reset link. Please request a new password reset.')
          } else if (data.session) {
            console.log('Session set successfully')
            setIsValidSession(true)
            // Clear the URL hash to clean up the URL
            window.history.replaceState(null, '', window.location.pathname)
          }
        } else {
          // Check if user already has a valid session
          const { data: { session }, error: sessionError } = await supabase.auth.getSession()
          
          if (sessionError) {
            console.error('Session check error:', sessionError)
            setError('Unable to verify session. Please try again.')
          } else if (session) {
            console.log('Existing session found')
            setIsValidSession(true)
          } else {
            console.log('No valid session found')
            setError('Invalid reset link. Please request a new password reset.')
          }
        }
      } catch (err) {
        console.error('Auth error:', err)
        setError('Something went wrong. Please try again.')
      } finally {
        setIsCheckingSession(false)
      }
    }
    
    // Add a small delay to ensure the page has loaded
    const timer = setTimeout(handleAuthStateChange, 100)
    return () => clearTimeout(timer)
  }, [])

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (password !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }

    setLoading(true)

    try {
      const supabase = getSupabase()
      console.log('Updating password...')
      
      // Update the user's password
      const { data, error } = await supabase.auth.updateUser({
        password: password
      })

      if (error) {
        console.error('Password update error:', error)
        throw error
      }

      if (data.user) {
        console.log('Password updated successfully')
        toast.success('Password updated successfully!')
        
        // Sign out to ensure clean state and redirect to login
        await supabase.auth.signOut()
        
        // Redirect with success message
        router.push('/auth/login?message=Password updated successfully. Please sign in with your new password.')
      }
    } catch (error: any) {
      console.error('Reset password error:', error)
      toast.error(error.message || 'Failed to update password')
    } finally {
      setLoading(false)
    }
  }

  // Show loading state while checking session
  if (isCheckingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex items-center justify-center p-8">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
              <p className="text-gray-600">Verifying reset link...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Show error state if session is invalid
  if (error || !isValidSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-gradient-to-br from-red-600 to-red-700 rounded-xl flex items-center justify-center mb-4">
              <span className="text-white text-xl">✕</span>
            </div>
            <CardTitle className="text-2xl font-bold">Invalid Reset Link</CardTitle>
            <p className="text-gray-600">{error || 'Please use a valid password reset link from your email.'}</p>
          </CardHeader>
          <CardContent>
            <div className="text-center space-y-3">
              <Button 
                onClick={() => router.push('/auth/forgot-password')}
                className="w-full"
              >
                Request New Reset Link
              </Button>
              <Button 
                variant="outline"
                onClick={() => router.push('/auth/login')}
                className="w-full"
              >
                Back to Login
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Show password reset form
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center mb-4">
            <Lock className="text-white h-6 w-6" />
          </div>
          <CardTitle className="text-2xl font-bold">Reset Password</CardTitle>
          <p className="text-gray-600">Enter your new password</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter new password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-10"
                  required
                  minLength={6}
                />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Password'
              )}
            </Button>
          </form>

          <div className="text-center">
            <Button 
              variant="ghost"
              onClick={() => router.push('/auth/login')}
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              Back to Login
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}