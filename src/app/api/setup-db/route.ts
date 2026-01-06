import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-server'

export async function POST() {
  try {
    const supabase = getSupabaseAdmin()
    console.log('🔧 Setting up notifications database...')

    // Create notifications table with direct SQL
    const { error } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS notifications (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          user_id UUID NOT NULL,
          title VARCHAR(255) NOT NULL,
          message TEXT NOT NULL,
          type VARCHAR(50) DEFAULT 'info',
          category VARCHAR(50) DEFAULT 'system',
          read BOOLEAN DEFAULT FALSE,
          action_url TEXT,
          action_text VARCHAR(100),
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
        CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
        CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

        ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

        DROP POLICY IF EXISTS "notifications_policy" ON notifications;
        CREATE POLICY "notifications_policy" ON notifications FOR ALL USING (auth.uid()::text = user_id::text);
      `
    })

    if (error) {
      console.error('❌ Database setup error:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    console.log('✅ Database setup complete!')
    return NextResponse.json({ success: true, message: 'Database setup complete!' })

  } catch (error) {
    console.error('❌ Setup failed:', error)
    return NextResponse.json({ success: false, error: 'Setup failed' }, { status: 500 })
  }
}