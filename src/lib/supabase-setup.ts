import { getSupabaseAdmin } from './supabase-server'

export async function setupNotificationsTable() {
  try {
    const supabase = getSupabaseAdmin()
    console.log('🔧 Setting up notifications table...')

    // Create notifications table
    const { error: tableError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS notifications (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
          title VARCHAR(255) NOT NULL,
          message TEXT NOT NULL,
          type VARCHAR(50) DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error', 'welcome', 'feature', 'payment', 'system')),
          category VARCHAR(50) DEFAULT 'system' CHECK (category IN ('system', 'user', 'payment', 'feature', 'security')),
          read BOOLEAN DEFAULT FALSE,
          action_url TEXT,
          action_text VARCHAR(100),
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    })

    if (tableError) {
      console.error('❌ Table creation error:', tableError)
      return false
    }

    // Create indexes
    await supabase.rpc('exec_sql', {
      sql: `
        CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
        CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
        CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, read) WHERE read = FALSE;
      `
    })

    // Enable RLS
    await supabase.rpc('exec_sql', {
      sql: `ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;`
    })

    // Create RLS policies
    await supabase.rpc('exec_sql', {
      sql: `
        DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
        DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
        DROP POLICY IF EXISTS "System can insert notifications" ON notifications;
        DROP POLICY IF EXISTS "Users can delete their own notifications" ON notifications;

        CREATE POLICY "Users can view their own notifications" ON notifications
          FOR SELECT USING (auth.uid() = user_id);

        CREATE POLICY "Users can update their own notifications" ON notifications
          FOR UPDATE USING (auth.uid() = user_id);

        CREATE POLICY "System can insert notifications" ON notifications
          FOR INSERT WITH CHECK (true);

        CREATE POLICY "Users can delete their own notifications" ON notifications
          FOR DELETE USING (auth.uid() = user_id);
      `
    })

    console.log('✅ Notifications table setup complete!')
    return true
  } catch (error) {
    console.error('❌ Setup failed:', error)
    return false
  }
}

export async function createWelcomeNotification(userId: string, userName: string) {
  try {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        title: `Welcome to LAW.AI, ${userName}! 🎉`,
        message: 'Your AI-powered legal assistant is ready. Explore our features to revolutionize your legal practice.',
        type: 'welcome',
        category: 'system',
        action_url: '/dashboard',
        action_text: 'Get Started',
        metadata: { isWelcome: true, userName },
        read: false
      })
      .select()
      .single()

    if (error) {
      console.error('❌ Welcome notification error:', error)
      return null
    }

    console.log('✅ Welcome notification created:', data)
    return data
  } catch (error) {
    console.error('❌ Welcome notification failed:', error)
    return null
  }
}