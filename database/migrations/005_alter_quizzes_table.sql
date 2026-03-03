-- 005_alter_quizzes_table.sql

-- First, check if the column exists and then drop it
DO $$
BEGIN
   IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quizzes' AND column_name='questions') THEN
      ALTER TABLE quizzes DROP COLUMN questions;
   END IF;
END $$;

-- Rename id to quiz_id
DO $$
BEGIN
   IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='quizzes' AND column_name='id') THEN
      ALTER TABLE quizzes RENAME COLUMN id TO quiz_id;
   END IF;
END $$;
