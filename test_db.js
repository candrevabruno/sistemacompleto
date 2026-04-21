import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ignxshdfsstbuvxiqmju.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlnbnhzaGRmc3N0YnV2eGlxbWp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwODgxMzksImV4cCI6MjA5MDY2NDEzOX0.s2s9uXjq6r2xDfqJecijgY6JPGloEFAGsmB9xEUJqCI'
const supabase = createClient(supabaseUrl, supabaseKey)

async function test() {
  console.log("Testing auth...")
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'admin@example.com', // Change to user email if you know it, but this is a generic test
    password: 'wrong_password' // just testing if the API responds
  })
  console.log("Auth result:", error ? error.message : "Success")
}
test()
