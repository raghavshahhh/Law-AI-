import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { safeDbOperation } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin()
    
    // Get user from session
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 })
    }

    // Extract user ID from auth header
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return NextResponse.json({ ok: false, message: 'Invalid session' }, { status: 401 })
    }

    // Get user profile from database
    const userProfile = await safeDbOperation(async () => {
      const { prisma } = await import('@/lib/prisma')
      if (!prisma) throw new Error('Database unavailable')
      
      return await prisma.userApp.findUnique({
        where: { userId: user.id },
        select: {
          userId: true,
          plan: true,
          usageCount: true,
          expiryDate: true,
          createdAt: true
        }
      })
    }, null)

    // If no profile exists, create one with FREE plan and 7-day trial
    if (!userProfile) {
      // Calculate trial end date (7 days from now)
      const trialEndDate = new Date()
      trialEndDate.setDate(trialEndDate.getDate() + 7)
      
      const newProfile = await safeDbOperation(async () => {
        const { prisma } = await import('@/lib/prisma')
        if (!prisma) throw new Error('Database unavailable')
        
        return await prisma.userApp.create({
          data: {
            userId: user.id,
            email: user.email!,
            plan: 'FREE',
            usageCount: 0,
            expiryDate: trialEndDate // Using expiryDate as trial end date for FREE users
          }
        })
      }, {
        userId: user.id,
        plan: 'FREE',
        usageCount: 0,
        expiryDate: trialEndDate
      })
      
      return NextResponse.json({
        ok: true,
        profile: {
          id: user.id,
          email: user.email,
          fullName: user.user_metadata?.full_name || user.user_metadata?.name,
          plan: 'FREE',
          usageCount: 0,
          expiryDate: null,
          trialEndDate: trialEndDate,
          createdAt: new Date()
        }
      })
    }

    // For FREE users, expiryDate is used as trialEndDate
    const isPaidPlan = userProfile.plan === 'PLUS' || userProfile.plan === 'PRO'
    
    return NextResponse.json({
      ok: true,
      profile: {
        id: user.id,
        email: user.email,
        fullName: user.user_metadata?.full_name || user.user_metadata?.name,
        plan: userProfile.plan,
        usageCount: userProfile.usageCount,
        expiryDate: isPaidPlan ? userProfile.expiryDate : null,
        trialEndDate: !isPaidPlan ? userProfile.expiryDate : null,
        createdAt: userProfile.createdAt
      }
    })

  } catch (error) {
    console.error('Profile GET error:', error)
    return NextResponse.json({ 
      ok: false, 
      message: 'Internal server error',
      profile: {
        plan: 'FREE',
        usageCount: 0
      }
    }, { status: 500 })
  }
}


export async function PUT(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin()
    const { fullName, phone, organization } = await request.json()
    
    // Get user from session
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 })
    }

    // Extract user ID from auth header or session
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return NextResponse.json({ ok: false, message: 'Invalid session' }, { status: 401 })
    }

    // Update user profile
    const { error } = await supabase
      .from('user_profiles')
      .upsert({
        user_id: user.id,
        full_name: fullName,
        phone: phone || null,
        organization: organization || null,
        updated_at: new Date().toISOString()
      })

    if (error) {
      console.error('Profile update error:', error)
      return NextResponse.json({ ok: false, message: 'Failed to update profile' }, { status: 500 })
    }

    return NextResponse.json({ 
      ok: true, 
      message: 'Profile updated successfully' 
    })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ ok: false, message: 'Internal server error' }, { status: 500 })
  }
}