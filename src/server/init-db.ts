import 'dotenv/config';
import { Pool } from 'pg';

try {
  process.loadEnvFile();
} catch {}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/collaborative_ide',
  max: 5,
});

async function initDatabase() {
  const client = await pool.connect();
  try {
    console.log('Initializing database...');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(255) UNIQUE NOT NULL,
        avatar_url TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
      
      CREATE TABLE IF NOT EXISTS rooms (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        repository_url TEXT,
        branch TEXT,
        commit_sha TEXT,
        primary_language TEXT,
        owner_id UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW()
      );
      
      ALTER TABLE rooms ADD COLUMN IF NOT EXISTS description TEXT;
      ALTER TABLE rooms ADD COLUMN IF NOT EXISTS repository_url TEXT;
      ALTER TABLE rooms ADD COLUMN IF NOT EXISTS branch TEXT;
      ALTER TABLE rooms ADD COLUMN IF NOT EXISTS commit_sha TEXT;
      ALTER TABLE rooms ADD COLUMN IF NOT EXISTS primary_language TEXT;
      
      CREATE TABLE IF NOT EXISTS workspace_files (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
        path TEXT NOT NULL,
        content TEXT DEFAULT '',
        language VARCHAR(50) DEFAULT 'plaintext',
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(room_id, path)
      );
      
      CREATE INDEX IF NOT EXISTS idx_workspace_files_room_id ON workspace_files(room_id);
      
      CREATE TABLE IF NOT EXISTS user_rooms (
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
        joined_at TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (user_id, room_id)
      );

      CREATE TABLE IF NOT EXISTS user_ai_credentials (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL UNIQUE,
        provider VARCHAR(50) NOT NULL DEFAULT 'groq',
        encrypted_api_key TEXT NOT NULL,
        iv TEXT NOT NULL,
        tag TEXT NOT NULL,
        selected_model VARCHAR(100) DEFAULT 'llama-3.3-70b-versatile',
        api_endpoint VARCHAR(500),
        custom_provider_name VARCHAR(100),
        custom_protocol VARCHAR(50) DEFAULT 'openai',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      ALTER TABLE user_ai_credentials ADD COLUMN IF NOT EXISTS api_endpoint VARCHAR(500);
      ALTER TABLE user_ai_credentials ADD COLUMN IF NOT EXISTS custom_provider_name VARCHAR(100);
      ALTER TABLE user_ai_credentials ADD COLUMN IF NOT EXISTS custom_protocol VARCHAR(50) DEFAULT 'openai';

      UPDATE user_ai_credentials
        SET selected_model = 'llama-3.3-70b-versatile'
        WHERE selected_model = 'llama-3.1-70b-versatile';

      CREATE TABLE IF NOT EXISTS ai_conversations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL,
        room_id TEXT NOT NULL,
        title VARCHAR(255) NOT NULL DEFAULT 'New Conversation',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_room ON ai_conversations(user_id, room_id);

      CREATE TABLE IF NOT EXISTS ai_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL,
        role VARCHAR(20) NOT NULL,
        content TEXT NOT NULL,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation_id ON ai_messages(conversation_id);
    `);
    
    console.log('Database initialized successfully!');
  } catch (error) {
    console.error('Database initialization failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

initDatabase().catch((err) => {
  console.error('Fatal database initialization error:', err);
  process.exit(1);
});