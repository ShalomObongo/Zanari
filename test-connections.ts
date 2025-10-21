import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Test 1: Supabase Connection
async function testSupabase() {
  console.log('\n🧪 Testing Supabase connection...');
  
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    const { data, error } = await supabase.from('users').select('count').limit(1);
    if (error) throw error;
    console.log('✅ Supabase connection: SUCCESS');
    return true;
  } catch (error: any) {
    console.error('❌ Supabase connection: FAILED', error.message);
    return false;
  }
}

// Test 2: Supabase Storage
async function testStorage() {
  console.log('\n🧪 Testing Supabase storage bucket...');
  
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    const { data, error } = await supabase.storage.getBucket('kyc');
    if (error) throw error;
    console.log('✅ Storage bucket "kyc": EXISTS');
    console.log(`   └─ Public: ${data.public}, File size limit: ${data.file_size_limit} bytes`);
    return true;
  } catch (error: any) {
    console.error('❌ Storage bucket test: FAILED', error.message);
    return false;
  }
}

// Test 3: Paystack API
async function testPaystack() {
  console.log('\n🧪 Testing Paystack API connection...');
  
  const secretKey = process.env.PAYSTACK_SECRET_KEY!;
  
  try {
    const response = await axios.get('https://api.paystack.co/bank', {
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Paystack API: SUCCESS');
    console.log(`   └─ Kenyan banks available: ${response.data.data.filter((b: any) => b.country === 'kenya').length}`);
    return true;
  } catch (error: any) {
    console.error('❌ Paystack API: FAILED', error.response?.data || error.message);
    return false;
  }
}

// Test 4: Environment Variables
function testEnvVars() {
  console.log('\n🧪 Checking environment variables...');
  
  const required = [
    'EXPO_PUBLIC_SUPABASE_URL',
    'EXPO_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY',
    'PAYSTACK_SECRET_KEY'
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('❌ Missing environment variables:', missing.join(', '));
    return false;
  }
  
  console.log('✅ All required environment variables: SET');
  return true;
}

// Run all tests
async function runTests() {
  console.log('═══════════════════════════════════════════════');
  console.log('     Zanari2 Infrastructure Smoke Tests       ');
  console.log('═══════════════════════════════════════════════');
  
  const results = {
    envVars: testEnvVars(),
    supabase: await testSupabase(),
    storage: await testStorage(),
    paystack: await testPaystack()
  };
  
  console.log('\n═══════════════════════════════════════════════');
  console.log('                   Summary                     ');
  console.log('═══════════════════════════════════════════════');
  
  Object.entries(results).forEach(([test, passed]) => {
    console.log(`${passed ? '✅' : '❌'} ${test.padEnd(20)} ${passed ? 'PASSED' : 'FAILED'}`);
  });
  
  const allPassed = Object.values(results).every(r => r === true);
  
  console.log('\n' + (allPassed 
    ? '🎉 All tests passed! Infrastructure is ready.'
    : '⚠️  Some tests failed. Review errors above.'
  ));
  
  process.exit(allPassed ? 0 : 1);
}

runTests().catch(console.error);
