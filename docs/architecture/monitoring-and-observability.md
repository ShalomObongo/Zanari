# Monitoring and Observability

## Monitoring Stack

- **Frontend Monitoring:** Sentry for React Native error tracking and performance
- **Backend Monitoring:** Supabase logs + custom logging in Edge Functions
- **Error Tracking:** Sentry for error aggregation and alerting
- **Performance Monitoring:** Custom metrics for API response times and database queries

## Key Metrics

### Frontend Metrics
- App startup time
- Screen load times
- API request success/failure rates
- User interaction events
- Crash rates

### Backend Metrics
- Request rate and response times
- Database query performance
- Error rates by endpoint
- M-PESA API success rates
- Background job processing times

## Implementation

```typescript
// apps/mobile/src/services/monitoring.ts
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: __DEV__ ? 'development' : 'production',
  debug: __DEV__,
});

export const trackEvent = (name: string, data?: Record<string, any>) => {
  if (!__DEV__) {
    Sentry.addBreadcrumb({
      message: name,
      data,
      level: 'info',
    });
  }
};

export const trackError = (error: Error, context?: Record<string, any>) => {
  if (!__DEV__) {
    Sentry.captureException(error, {
      extra: context,
    });
  }
};

export const trackPerformance = (name: string, start: number) => {
  const duration = Date.now() - start;
  if (!__DEV__) {
    Sentry.addBreadcrumb({
      message: `Performance: ${name}`,
      data: { duration },
      level: 'info',
    });
  }
};
```
