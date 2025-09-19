# Backend Architecture

## Supabase Edge Functions Structure

```
supabase/functions/
├── _shared/               # Shared utilities
│   ├── supabase.ts       # Supabase client setup
│   ├── auth.ts           # Authentication helpers
│   ├── validation.ts     # Input validation
│   ├── errors.ts         # Error handling
│   └── types.ts          # Shared types
├── mpesa-webhook/         # M-PESA transaction webhook
│   └── index.ts
├── mpesa-stk-push/       # STK push handler
│   └── index.ts
├── process-roundup/      # Round-up processing
│   └── index.ts
├── send-notification/     # Notification service
│   └── index.ts
└── analytics/            # Analytics calculations
    └── index.ts
```

## Edge Function Template

```typescript
// supabase/functions/mpesa-webhook/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { verifyMpesaSignature } from '../_shared/auth.ts';
import { processRoundUpTransaction } from '../_shared/mpesa.ts';
import { logError } from '../_shared/errors.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verify webhook signature
    const signature = req.headers.get('x-mpesa-signature');
    if (!signature || !verifyMpesaSignature(await req.text(), signature)) {
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Parse webhook data
    const webhookData = await req.json();

    // Process the transaction
    const result = await processRoundUpTransaction(webhookData);

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    await logError('mpesa-webhook', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
```

## Database Access Pattern

```typescript
// supabase/functions/_shared/supabase.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

export const supabase = createClient(supabaseUrl, supabaseServiceKey);

export const createSupabaseClient = (authToken?: string) => {
  return createClient(supabaseUrl, supabaseServiceKey, {
    global: {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    },
  });
};
```

## Security Implementation

```typescript
// supabase/functions/_shared/auth.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export async function verifyUser(authToken: string): Promise<UserId | null> {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { data: { user }, error } = await supabase.auth.getUser(authToken);

  if (error || !user) {
    return null;
  }

  return user.id;
}

export async function verifyMpesaSignature(payload: string, signature: string): Promise<boolean> {
  const secret = Deno.env.get('MPESA_WEBHOOK_SECRET')!;
  const expectedSignature = await crypto.subtle.sign(
    'HMAC',
    await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    ),
    new TextEncoder().encode(payload)
  );

  const receivedSignature = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(signature),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  return await crypto.subtle.verify(
    'HMAC',
    receivedSignature,
    new TextEncoder().encode(payload)
  );
}
```
