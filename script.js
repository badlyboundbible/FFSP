// Import the Supabase library
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// Initialize the Supabase client
const supabase = createClient(
    "https://cfmtrhlovulezzswxqsu.supabase.co", // Replace with your actual Supabase Project URL
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNmbXRyaGxvdnVsZXp6c3d4cXN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzM2NDc1NjEsImV4cCI6MjA0OTIyMzU2MX0.J72n-YGyt1HkeYG4GGuKvZ9JeSZDz4rj1pI6bYPLEIU" // Replace with your actual Supabase Public API Key
);

// Test the Supabase connection
(async function testConnection() {
    console.log("Testing Supabase connection...");

    const { data, error } = await supabase.from("fantasy_football").select("*");

    if (error) {
        console.error("Supabase Error:", error);
    } else {
        console.log("Supabase Data:", data);
    }
})();
