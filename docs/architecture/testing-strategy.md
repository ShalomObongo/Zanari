# Testing Strategy

## Testing Pyramid

```
E2E Tests (10%)
    /       \
Integration Tests (30%)
    /           \
Frontend Unit  Backend Unit (60%)
```

## Test Organization

### Frontend Tests
```
apps/mobile/src/
├── __tests__/
│   ├── components/     # Component tests
│   ├── screens/        # Screen tests
│   ├── services/       # Service tests
│   └── utils/          # Utility tests
├── e2e/               # E2E tests
│   ├── auth.spec.ts
│   ├── goals.spec.ts
│   └── transactions.spec.ts
```

### Backend Tests
```
supabase/functions/
├── __tests__/
│   ├── mpesa-webhook.test.ts
│   ├── process-roundup.test.ts
│   └── utils.test.ts
```

## Test Examples

### Frontend Component Test
```typescript
// apps/mobile/src/__tests__/components/features/goals/GoalCard.test.tsx
import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { GoalCard } from '../../../components/features/goals/GoalCard';
import { SavingsGoal } from '../../../../packages/shared/src/types';

const mockGoal: SavingsGoal = {
  id: 'test-goal-id',
  user_id: 'test-user-id',
  name: 'New Phone',
  target_amount: 50000,
  current_amount: 25000,
  status: 'active',
  icon_emoji: '📱',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

describe('GoalCard', () => {
  it('renders goal information correctly', () => {
    render(<GoalCard goal={mockGoal} />);

    expect(screen.getByText('New Phone')).toBeTruthy();
    expect(screen.getByText('📱')).toBeTruthy();
    expect(screen.getByText('KES 25,000 / KES 50,000')).toBeTruthy();
  });

  it('shows progress percentage correctly', () => {
    render(<GoalCard goal={mockGoal} />);

    expect(screen.getByText('50.0%')).toBeTruthy();
  });

  it('calls onFund when Add Funds button is pressed', () => {
    const mockOnFund = jest.fn();
    render(<GoalCard goal={mockGoal} onFund={mockOnFund} />);

    fireEvent.press(screen.getByText('Add Funds'));
    expect(mockOnFund).toHaveBeenCalled();
  });

  it('shows completed message for completed goals', () => {
    const completedGoal = { ...mockGoal, status: 'completed' as const };
    render(<GoalCard goal={completedGoal} />);

    expect(screen.getByText('🎉 Goal Completed!')).toBeTruthy();
    expect(screen.queryByText('Add Funds')).toBeNull();
  });
});
```

### Backend Function Test
```typescript
// supabase/functions/__tests__/mpesa-webhook.test.ts
import { assertEquals, assertRejects } from 'https://deno.land/std@0.177.0/testing/asserts.ts';
import { processRoundUpTransaction } from '../mpesa-webhook/index.ts';

Deno.test('processRoundUpTransaction calculates correct round-up amount', async () => {
  const mockTransaction = {
    amount: 147,
    transaction_id: 'test-tx-123',
    phone_number: '+254712345678',
  };

  const result = await processRoundUpTransaction(mockTransaction);

  assertEquals(result.roundUpAmount, 3);
  assertEquals(result.status, 'processed');
});

Deno.test('processRoundUpTransaction handles invalid transactions', async () => {
  const invalidTransaction = {
    amount: -100,
    transaction_id: 'test-tx-123',
    phone_number: '+254712345678',
  };

  await assertRejects(
    () => processRoundUpTransaction(invalidTransaction),
    Error,
    'Invalid transaction amount'
  );
});
```
