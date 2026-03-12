import { createClient } from '@supabase/supabase-js'

// 👇 Remplace ces deux valeurs par les tiennes (Settings → API dans Supabase)
const SUPABASE_URL  = 'https://gvnpiirgeylbunmrofky.supabase.co'
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2bnBpaXJnZXlsYnVubXJvZmt5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzMTQ4MDgsImV4cCI6MjA4ODg5MDgwOH0.7wRe4NrColjlQdZ7Tvh3HdFuX_BwEEOcqZS6Gd2RJDQ'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON)
