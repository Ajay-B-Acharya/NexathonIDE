import { Pool } from 'pg';

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
        owner_id UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW()
      );
      
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

initDatabase().catch(() => process.exit(1));