import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Environment variables - Replace with actual values in production
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing Supabase environment variables. Please check your .env configuration.');
}

// Create Supabase client with React Native specific configuration
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// Database types for type safety
export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          phone?: string;
          first_name: string;
          last_name: string;
          date_of_birth?: string;
          kyc_status: 'pending' | 'approved' | 'rejected' | 'not_started';
          kyc_submitted_at?: string;
          kyc_approved_at?: string;
          notification_preferences: {
            push_enabled: boolean;
            email_enabled: boolean;
            transaction_alerts: boolean;
            savings_milestones: boolean;
          };
          pin_hash?: string;
          pin_set_at?: string;
          failed_pin_attempts: number;
          last_failed_attempt_at?: string;
          status: 'active' | 'suspended' | 'closed';
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['users']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['users']['Insert']>;
      };
      wallets: {
        Row: {
          id: string;
          user_id: string;
          wallet_type: 'main' | 'savings';
          balance: number;
          available_balance: number;
          last_transaction_at?: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['wallets']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['wallets']['Insert']>;
      };
      transactions: {
        Row: {
          id: string;
          user_id: string;
          type: 'payment' | 'transfer_in' | 'transfer_out' | 'round_up' | 'bill_payment' | 'withdrawal' | 'deposit';
          status: 'pending' | 'completed' | 'failed' | 'cancelled';
          amount: number;
          fee?: number;
          from_wallet_id?: string;
          to_wallet_id?: string;
          external_transaction_id?: string;
          external_reference?: string;
          payment_method?: 'mpesa' | 'card' | 'internal';
          merchant_info?: {
            name: string;
            till_number?: string;
            paybill_number?: string;
            account_number?: string;
          };
          round_up_details?: {
            original_amount: number;
            round_up_amount: number;
            round_up_rule: string;
            related_transaction_id: string;
          };
          category: 'airtime' | 'groceries' | 'school_fees' | 'utilities' | 'transport' | 'entertainment' | 'savings' | 'transfer' | 'other';
          auto_categorized: boolean;
          description?: string;
          retry_count: number;
          last_retry_at?: string;
          next_retry_at?: string;
          created_at: string;
          updated_at: string;
          completed_at?: string;
        };
        Insert: Omit<Database['public']['Tables']['transactions']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['transactions']['Insert']>;
      };
      savings_goals: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description?: string;
          target_amount: number;
          current_amount: number;
          target_date?: string;
          status: 'active' | 'completed' | 'paused' | 'cancelled';
          lock_in_enabled: boolean;
          milestones?: Array<{
            percentage: number;
            amount: number;
            reached_at?: string;
            celebrated: boolean;
          }>;
          created_at: string;
          updated_at: string;
          completed_at?: string;
        };
        Insert: Omit<Database['public']['Tables']['savings_goals']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['savings_goals']['Insert']>;
      };
      round_up_rules: {
        Row: {
          id: string;
          user_id: string;
          increment_type: '10' | '50' | '100' | 'auto';
          is_enabled: boolean;
          auto_settings?: {
            min_increment: number;
            max_increment: number;
            analysis_period_days: number;
            last_analysis_at?: string;
          };
          total_round_ups_count: number;
          total_amount_saved: number;
          last_used_at?: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['round_up_rules']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['round_up_rules']['Insert']>;
      };
      kyc_documents: {
        Row: {
          id: string;
          user_id: string;
          document_type: 'national_id' | 'passport' | 'driving_license' | 'selfie';
          file_path: string;
          file_name: string;
          file_size: number;
          mime_type: string;
          status: 'uploaded' | 'processing' | 'approved' | 'rejected';
          verification_notes?: string;
          encrypted: boolean;
          access_hash: string;
          expires_at?: string;
          extracted_data?: {
            full_name?: string;
            id_number?: string;
            date_of_birth?: string;
            issue_date?: string;
            expiry_date?: string;
          };
          uploaded_at: string;
          processed_at?: string;
        };
        Insert: Omit<Database['public']['Tables']['kyc_documents']['Row'], 'id' | 'uploaded_at'>;
        Update: Partial<Database['public']['Tables']['kyc_documents']['Insert']>;
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
}

export default supabase;