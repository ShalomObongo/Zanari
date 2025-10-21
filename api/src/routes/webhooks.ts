/**
 * Webhook handler for Paystack events (OPTIONAL)
 * 
 * Note: Zanari2 uses a callback-based payment flow where the mobile app
 * handles payment confirmation via onSuccess callbacks. This webhook handler
 * is optional and provides backup verification for edge cases:
 * - User closes app before callback fires
 * - Network issues prevent callback from reaching backend
 * - Recurring subscription charges (future feature)
 * - Refunds and disputes
 * 
 * For basic payment operations, see docs/PAYSTACK_CALLBACK_FLOW.md
 * 
 * Based on Paystack Webhooks documentation:
 * https://paystack.com/docs/payments/webhooks/
 * 
 * IMPORTANT: This route must be publicly accessible for Paystack to deliver events.
 * For local development, use ngrok or similar tunneling service.
 */

import { createHmac } from 'node:crypto';
import { HttpRequest, HttpResponse } from './types';
import { ok } from './responses';
import { Logger, NullLogger } from '../services/types';

interface PaystackWebhookBody {
  event: string;
  data: Record<string, unknown>;
}

export interface WebhookRouteDependencies {
  logger?: Logger;
}

/**
 * Verify Paystack webhook signature using HMAC SHA512
 * https://paystack.com/docs/payments/webhooks/#verify-event-origin
 */
function verifyWebhookSignature(body: unknown, signature: string | undefined, secret: string): boolean {
  if (!signature) {
    return false;
  }

  const hash = createHmac('sha512', secret)
    .update(JSON.stringify(body))
    .digest('hex');

  return hash === signature;
}

/**
 * Supported Paystack webhook events:
 * - charge.success: Payment completed successfully
 * - charge.failed: Payment failed
 * - transfer.success: Transfer completed
 * - transfer.failed: Transfer failed
 * - transfer.reversed: Transfer was reversed
 * - refund.processed: Refund completed
 * 
 * See full list: https://paystack.com/docs/payments/webhooks/#types-of-events
 */
export function createWebhookRoutes({ logger = NullLogger }: WebhookRouteDependencies) {
  const secret = process.env.PAYSTACK_WEBHOOK_SECRET ?? process.env.PAYSTACK_SECRET_KEY ?? null;

  if (!secret) {
    logger.warn('PAYSTACK webhook secret is not configured; webhook requests will be rejected.');
  }

  return {
    handlePaystackWebhook: async (request: HttpRequest<PaystackWebhookBody>): Promise<HttpResponse> => {
      if (!secret) {
        return {
          status: 503,
          body: {
            received: false,
            error: 'Webhook secret not configured',
            code: 'WEBHOOK_SECRET_MISSING',
          },
        };
      }

      const signature = request.headers['x-paystack-signature'];
      
      // Verify webhook signature before processing
      if (!verifyWebhookSignature(request.body, signature, secret)) {
        logger.warn('Invalid Paystack webhook signature', {
          signature,
          ip: request.headers['x-forwarded-for'] ?? request.headers['x-real-ip'],
        });
        
        // Return 200 to prevent retries for invalid signatures
        return ok({ received: false, reason: 'Invalid signature' });
      }

      const { event, data } = request.body;
      
      logger.info('Paystack webhook received', {
        event,
        reference: data.reference ?? data.transfer_code ?? 'unknown',
      });

      try {
        // Process webhook events
        switch (event) {
          case 'charge.success':
            await handleChargeSuccess(data, logger);
            break;
            
          case 'transfer.success':
            await handleTransferSuccess(data, logger);
            break;
            
          case 'transfer.failed':
            await handleTransferFailed(data, logger);
            break;
            
          case 'transfer.reversed':
            await handleTransferReversed(data, logger);
            break;
            
          default:
            logger.info('Unhandled Paystack webhook event', { event });
        }

        // Return 200 OK to acknowledge receipt
        return ok({ received: true });
      } catch (error) {
        logger.error('Error processing Paystack webhook', {
          event,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        
        // Return 200 to prevent retries for processing errors
        // Log error for manual investigation
        return ok({ received: true, processing_error: true });
      }
    },
  };
}

async function handleChargeSuccess(data: Record<string, unknown>, logger: Logger): Promise<void> {
  const reference = data.reference as string;
  const amount = data.amount as number;
  const status = data.status as string;
  
  logger.info('Processing charge.success webhook', { reference, amount, status });
  
  // TODO: Update transaction status in database
  // - Find transaction by external_reference = reference
  // - Update status to 'completed'
  // - Set completed_at timestamp
  // - Log success
}

async function handleTransferSuccess(data: Record<string, unknown>, logger: Logger): Promise<void> {
  const transferCode = data.transfer_code as string;
  const reference = data.reference as string;
  
  logger.info('Processing transfer.success webhook', { transferCode, reference });
  
  // TODO: Update transfer transaction status
  // - Find transaction by external_transaction_id = transferCode
  // - Update status to 'completed'
  // - Notify user of successful transfer
}

async function handleTransferFailed(data: Record<string, unknown>, logger: Logger): Promise<void> {
  const transferCode = data.transfer_code as string;
  const reference = data.reference as string;
  
  logger.warn('Processing transfer.failed webhook', { transferCode, reference });
  
  // TODO: Handle failed transfer
  // - Find transaction by external_transaction_id = transferCode
  // - Update status to 'failed'
  // - Reverse wallet debits
  // - Notify user of failure
  // - Optionally schedule retry
}

async function handleTransferReversed(data: Record<string, unknown>, logger: Logger): Promise<void> {
  const transferCode = data.transfer_code as string;
  const reference = data.reference as string;
  
  logger.warn('Processing transfer.reversed webhook', { transferCode, reference });
  
  // TODO: Handle reversed transfer
  // - Find transaction by external_transaction_id = transferCode
  // - Update status to 'cancelled' or create reversal transaction
  // - Credit user's wallet with reversed amount
  // - Notify user of reversal
}
