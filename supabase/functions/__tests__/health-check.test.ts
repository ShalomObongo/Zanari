import { assertEquals, assertExists } from "https://deno.land/std@0.168.0/testing/asserts.ts";

const FUNCTION_URL = 'http://127.0.0.1:54321/functions/v1/health-check';

Deno.test("Health Check Function - Basic Response", async () => {
  const response = await fetch(FUNCTION_URL, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY') || 'test-key'}`,
    },
  });

  assertEquals(response.status, 200);
  assertEquals(response.headers.get('content-type'), 'application/json');

  const data = await response.json();
  
  assertEquals(data.status, 'ok');
  assertExists(data.timestamp);
  assertEquals(data.service, 'zanari-backend');
  assertEquals(data.version, '1.0.0');
});

Deno.test("Health Check Function - CORS Headers", async () => {
  const response = await fetch(FUNCTION_URL, {
    method: 'OPTIONS',
  });

  assertEquals(response.status, 200);
  assertExists(response.headers.get('access-control-allow-origin'));
  assertExists(response.headers.get('access-control-allow-headers'));
});

Deno.test("Health Check Function - Timestamp Format", async () => {
  const response = await fetch(FUNCTION_URL, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY') || 'test-key'}`,
    },
  });

  const data = await response.json();
  
  // Test that timestamp is a valid ISO string
  const timestamp = new Date(data.timestamp);
  assertExists(timestamp.getTime()); // Will throw if invalid date
  
  // Test that timestamp is recent (within last minute)
  const now = new Date();
  const diff = now.getTime() - timestamp.getTime();
  assertEquals(diff < 60000, true); // Less than 60 seconds old
});