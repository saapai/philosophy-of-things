-- Philosophy of Things - Supabase Schema
-- Run this in the Supabase SQL Editor (https://supabase.com/dashboard)

-- Posts table (user_id links to auth.users)
CREATE TABLE IF NOT EXISTS posts (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled',
  body TEXT DEFAULT '',
  cover_image TEXT,
  status TEXT CHECK(status IN ('draft','published')) DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Images table
CREATE TABLE IF NOT EXISTS images (
  id SERIAL PRIMARY KEY,
  post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  prompt TEXT,
  parent_image_id INTEGER REFERENCES images(id),
  mode TEXT CHECK(mode IN ('initial','blend','iterate')) DEFAULT 'initial',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE images ENABLE ROW LEVEL SECURITY;

-- Anyone can read published posts
CREATE POLICY "Public can read published posts" ON posts
  FOR SELECT USING (status = 'published');

-- Users can read their own posts (including drafts)
CREATE POLICY "Users can read own posts" ON posts
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own posts
CREATE POLICY "Users can create posts" ON posts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own posts
CREATE POLICY "Users can update own posts" ON posts
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own posts
CREATE POLICY "Users can delete own posts" ON posts
  FOR DELETE USING (auth.uid() = user_id);

-- Anyone can read images (for viewing posts)
CREATE POLICY "Public can read images" ON images
  FOR SELECT USING (true);

-- Users can manage their own images
CREATE POLICY "Users can create images" ON images
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own images" ON images
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own images" ON images
  FOR DELETE USING (auth.uid() = user_id);
