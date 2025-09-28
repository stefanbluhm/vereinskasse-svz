import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://kfvvtpiciedygqpzqnsp.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmdnZ0cGljaWVkeWdxcHpxbnNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkwNjg4ODIsImV4cCI6MjA3NDY0NDg4Mn0.2dJUr_ACpaKTh8x658ojL8UmawiX9Qg5oAaftb4MBVY'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
