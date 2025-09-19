import { createClient } from '@supabase/supabase-js';

// Use environment variables with fallback to local development values
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Health check function that tests the Edge Function
export const testConnection = async (): Promise<{ success: boolean; message?: string; error?: string }> => {
  try {
    // Test the health-check Edge Function
    const { data, error } = await supabase.functions.invoke('health-check');
    
    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    if (data && data.status === 'ok') {
      return {
        success: true,
        message: `✅ Connected! Server: ${data.service} v${data.version} at ${new Date(data.timestamp).toLocaleTimeString()}`,
      };
    }

    return {
      success: false,
      error: 'Unexpected response from server',
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
};