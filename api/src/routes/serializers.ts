/**
 * Serializers translate domain entities to API response representations.
 */

import { KYCDocument } from '../models/KYCDocument';
import { RoundUpRule } from '../models/RoundUpRule';
import { SavingsGoal } from '../models/SavingsGoal';
import { Transaction } from '../models/Transaction';
import { User } from '../models/User';
import { Wallet } from '../models/Wallet';

function iso(date: Date | null | undefined): string | null {
  return date ? date.toISOString() : null;
}

function mapPaymentChannel(paymentMethod: Transaction['paymentMethod']): string | null {
  if (!paymentMethod) {
    return null;
  }

  switch (paymentMethod) {
    case 'mpesa':
      return 'mobile_money';
    case 'card':
      return 'card';
    case 'internal':
      return 'bank_transfer';
    default:
      return paymentMethod;
  }
}

function derivePaystackStatus(status: Transaction['status']): string | null {
  switch (status) {
    case 'completed':
      return 'success';
    case 'pending':
      return 'processing';
    case 'failed':
      return 'failed';
    case 'cancelled':
      return 'cancelled';
    default:
      return null;
  }
}

function deriveGatewayResponse(transaction: Transaction): string | null {
  switch (transaction.status) {
    case 'completed':
      return 'Approved';
    case 'pending':
      return 'Pending';
    case 'failed':
      return transaction.description ?? 'Failed';
    case 'cancelled':
      return 'Cancelled';
    default:
      return null;
  }
}

function deriveFailureReason(transaction: Transaction): string | null {
  if (transaction.status !== 'failed') {
    return null;
  }

  return transaction.description ?? 'Transaction failed';
}

function deriveRecipientInfo(transaction: Transaction): Record<string, unknown> | null {
  if (transaction.type !== 'transfer_out') {
    return null;
  }

  const description = transaction.description ?? '';
  const nameMatch = description.match(/transfer to ([^,]+)/i);
  const phoneMatch = description.match(/(254[0-9]{9})/);

  const matchedName = nameMatch?.[1];
  const name = matchedName ? matchedName.trim() : null;
  const matchedPhone = phoneMatch?.[1];
  const phone = matchedPhone ?? null;

  if (!name && !phone) {
    return null;
  }

  return {
    name,
    phone,
  };
}

function deriveBillInfo(transaction: Transaction): Record<string, unknown> | null {
  if (transaction.type !== 'bill_payment' || !transaction.merchantInfo) {
    return null;
  }

  return {
    paybill_number: transaction.merchantInfo.paybillNumber ?? null,
    account_number: transaction.merchantInfo.accountNumber ?? null,
    biller_name: transaction.merchantInfo.name,
  };
}

function deriveSavingsGoalId(transaction: Transaction): string | null {
  if (transaction.type !== 'round_up') {
    return null;
  }

  if (transaction.toWalletId) {
    return transaction.toWalletId;
  }

  if (transaction.roundUpDetails?.roundUpRule) {
    return `goal_${transaction.roundUpDetails.roundUpRule}`;
  }

  return 'goal_savings_buffer';
}

export function serializeUser(user: User): Record<string, unknown> {
  return {
    id: user.id,
    email: user.email,
    phone: user.phone ?? null,
    first_name: user.firstName,
    last_name: user.lastName,
    kyc_status: user.kycStatus,
    status: user.status,
    notification_preferences: {
      push_enabled: user.notificationPreferences.pushEnabled,
      email_enabled: user.notificationPreferences.emailEnabled,
      transaction_alerts: user.notificationPreferences.transactionAlerts,
      savings_milestones: user.notificationPreferences.savingsMilestones,
    },
    created_at: iso(user.createdAt),
    updated_at: iso(user.updatedAt),
  };
}

export function serializeWallet(wallet: Wallet): Record<string, unknown> {
  return {
    id: wallet.id,
    wallet_type: wallet.walletType,
    balance: wallet.balance,
    available_balance: wallet.availableBalance,
    last_transaction_at: iso(wallet.lastTransactionAt ?? null),
    created_at: iso(wallet.createdAt),
    updated_at: iso(wallet.updatedAt),
    withdrawal_restrictions: wallet.withdrawalRestrictions
      ? {
          min_settlement_delay_minutes: wallet.withdrawalRestrictions.minSettlementDelayMinutes,
          locked_until: iso(wallet.withdrawalRestrictions.lockedUntil ?? null),
        }
      : null,
  };
}

export function serializeTransaction(transaction: Transaction): Record<string, unknown> {
  const paystackReference = transaction.externalReference ?? `ps_ref_${transaction.id}`;
  const externalTransactionId = transaction.externalTransactionId ?? null;
  const channel = mapPaymentChannel(transaction.paymentMethod ?? null);

  return {
    id: transaction.id,
    type: transaction.type,
    status: transaction.status,
    amount: transaction.amount,
    fee: transaction.fee,
    description: transaction.description ?? null,
    category: transaction.category,
    merchant_info: transaction.merchantInfo
      ? {
          name: transaction.merchantInfo.name,
          till_number: transaction.merchantInfo.tillNumber ?? null,
          paybill_number: transaction.merchantInfo.paybillNumber ?? null,
          account_number: transaction.merchantInfo.accountNumber ?? null,
        }
      : null,
    round_up_details: transaction.roundUpDetails
      ? {
          original_amount: transaction.roundUpDetails.originalAmount,
          round_up_amount: transaction.roundUpDetails.roundUpAmount,
          round_up_rule: transaction.roundUpDetails.roundUpRule,
          related_transaction_id: transaction.roundUpDetails.relatedTransactionId,
        }
      : null,
    parent_transaction_id: transaction.roundUpDetails ? transaction.roundUpDetails.relatedTransactionId : null,
    savings_goal_id: deriveSavingsGoalId(transaction),
    paystack_reference: paystackReference,
    paystack_transaction_id: externalTransactionId,
    paystack_transfer_id: transaction.type === 'transfer_out' ? externalTransactionId : null,
    paystack_recipient_code: transaction.type === 'transfer_out' ? transaction.externalReference ?? null : null,
    paystack_status: derivePaystackStatus(transaction.status),
    gateway_response: deriveGatewayResponse(transaction),
    channel,
    failure_reason: deriveFailureReason(transaction),
    recipient_info: deriveRecipientInfo(transaction),
    bill_info: deriveBillInfo(transaction),
    external_reference: transaction.externalReference ?? null,
    external_transaction_id: transaction.externalTransactionId ?? null,
    created_at: iso(transaction.createdAt),
    updated_at: iso(transaction.updatedAt),
    completed_at: iso(transaction.completedAt ?? null),
  };
}

export function serializeSavingsGoal(goal: SavingsGoal): Record<string, unknown> {
  const progress = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;
  return {
    id: goal.id,
    user_id: goal.userId,
    name: goal.name,
    description: goal.description ?? null,
    target_amount: goal.targetAmount,
    current_amount: goal.currentAmount,
    progress_percentage: Math.min(100, parseFloat(progress.toFixed(2))),
    target_date: goal.targetDate ? goal.targetDate.toISOString().split('T')[0] : null,
    status: goal.status,
    lock_in_enabled: goal.lockInEnabled,
    milestones: goal.milestones.map((milestone) => ({
      percentage: milestone.percentage,
      amount: milestone.amount,
      reached_at: iso(milestone.reachedAt ?? null),
      celebrated: milestone.celebrated,
    })),
    created_at: iso(goal.createdAt),
    updated_at: iso(goal.updatedAt),
    completed_at: iso(goal.completedAt ?? null),
  };
}

export function serializeRoundUpRule(rule: RoundUpRule): Record<string, unknown> {
  return {
    id: rule.id,
    user_id: rule.userId,
    increment_type: rule.incrementType,
    is_enabled: rule.isEnabled,
    auto_settings: rule.autoSettings,
    total_round_ups_count: rule.totalRoundUpsCount,
    total_amount_saved: rule.totalAmountSaved,
    last_used_at: iso(rule.lastUsedAt ?? null),
    created_at: iso(rule.createdAt),
    updated_at: iso(rule.updatedAt),
  };
}

export function serializeKYCDocument(document: KYCDocument): Record<string, unknown> {
  return {
    id: document.id,
    user_id: document.userId,
    document_type: document.documentType,
    status: document.status,
    file_path: document.filePath,
    file_name: document.fileName,
    file_size: document.fileSize,
    mime_type: document.mimeType,
    encrypted: document.encrypted,
    access_hash: document.accessHash,
    expires_at: iso(document.expiresAt ?? null),
    processed_at: iso(document.processedAt ?? null),
    verification_notes: document.verificationNotes ?? null,
    created_at: iso(document.createdAt),
    updated_at: iso(document.updatedAt),
  };
}
