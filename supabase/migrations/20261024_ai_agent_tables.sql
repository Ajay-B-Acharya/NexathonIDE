-- Migration: Personal Autonomous AI Coding Agent Tables
-- Ensures strict Row Level Security (RLS) so that each user's credentials,
-- conversations, and messages are completely private to them, even inside shared rooms.

-- 1. User Personal AI Credentials (Encrypted at rest on server)
CREATE TABLE IF NOT EXISTS user_ai_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,
  provider VARCHAR(50) NOT NULL DEFAULT 'groq',
  encrypted_api_key TEXT NOT NULL,
  iv TEXT NOT NULL,
  tag TEXT NOT NULL,
  selected_model VARCHAR(100) DEFAULT 'llama-3.3-70b-versatile',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for credentials
ALTER TABLE user_ai_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only read their own AI credentials"
  ON user_ai_credentials FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can only insert their own AI credentials"
  ON user_ai_credentials FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can only update their own AI credentials"
  ON user_ai_credentials FOR UPDATE
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can only delete their own AI credentials"
  ON user_ai_credentials FOR DELETE
  USING (auth.uid()::text = user_id);

-- 2. AI Conversations (Scraped by user and workspace room)
CREATE TABLE IF NOT EXISTS ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  title VARCHAR(255) NOT NULL DEFAULT 'New Conversation',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_room ON ai_conversations(user_id, room_id);

-- Enable RLS for conversations
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only view their own conversations"
  ON ai_conversations FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can create their own conversations"
  ON ai_conversations FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update their own conversations"
  ON ai_conversations FOR UPDATE
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete their own conversations"
  ON ai_conversations FOR DELETE
  USING (auth.uid()::text = user_id);

-- 3. AI Messages (Individual turns with metadata for patches and tool calls)
CREATE TABLE IF NOT EXISTS ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation_id ON ai_messages(conversation_id);

-- Enable RLS for messages
ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only view their own messages"
  ON ai_messages FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert their own messages"
  ON ai_messages FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can delete their own messages"
  ON ai_messages FOR DELETE
  USING (auth.uid()::text = user_id);
