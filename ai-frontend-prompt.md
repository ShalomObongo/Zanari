# Zanari AI Frontend Generation Prompt

## Generated for: Vercel v0, Lovable.ai, or similar AI frontend tools

---

## **HIGH-LEVEL GOAL**

Create a responsive React Native mobile application for Zanari, an automated savings platform that integrates with M-PESA to help Kenyan users save money effortlessly through transaction round-ups and goal-based savings. The app should provide a clean, trustworthy, and encouraging user experience with a focus on financial security and growth.

---

## **DETAILED, STEP-BY-STEP INSTRUCTIONS**

### **Project Setup & Foundation**

1. **Initialize React Native Project:**
   - Create a new React Native project using TypeScript
   - Set up the project structure with the following folders:
     ```
     src/
     ├── components/     # Reusable UI components
     ├── screens/        # Main app screens
     ├── navigation/     # Navigation configuration
     ├── services/       # API and external service integrations
     ├── utils/          # Utility functions and helpers
     ├── types/          # TypeScript type definitions
     ├── hooks/          # Custom React hooks
     ├── context/        # React contexts for state management
     └── assets/         # Images, fonts, and static assets
     ```

2. **Install Dependencies:**
   - Install required packages: `@react-navigation/native`, `@react-navigation/bottom-tabs`, `@react-navigation/stack`
   - Install UI library: `react-native-paper` for consistent styling
   - Install forms and validation: `react-hook-form`, `@hookform/resolvers`, `yup`
   - Install state management: `@reduxjs/toolkit`, `react-redux`
   - Install charts: `react-native-svg-charts`
   - Install icons: `@expo/vector-icons` or `react-native-vector-icons`

3. **Set Up Navigation:**
   - Create a bottom tab navigator with 3 main tabs: Home, Goals, History
   - Implement a stack navigator for nested screens
   - Set up navigation types with TypeScript

### **Core Components Development**

4. **Create Theme System:**
   - Implement a theme provider with the following design tokens:
     ```typescript
     const theme = {
       colors: {
         primary: '#2E7D32',
         secondary: '#1976D2',
         accent: '#FF9800',
         success: '#4CAF50',
         warning: '#FF9800',
         error: '#F44336',
         background: '#F5F5F5',
         surface: '#FFFFFF',
         // ... rest of the color palette
       },
       typography: {
         fontFamily: 'Inter',
         fontSize: {
           h1: 32, h2: 28, h3: 24, h4: 20,
           bodyLarge: 18, bodyMedium: 16, bodySmall: 14, caption: 12
         }
       },
       spacing: {
         xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48
       }
     }
     ```
   - Create a custom `ThemeProvider` component

5. **Build Reusable Components:**
   - **Button Component:** Create variants (primary, secondary, tertiary, destructive) with loading states
   - **Card Component:** Create reusable card with elevation and press states
   - **Input Component:** Create form inputs with validation and error handling
   - **Avatar Component:** Create user avatar with initials fallback
   - **Currency Display Component:** Create formatted currency display for KES
   - **Skeleton Loader Component:** Create loading states for content
   - **Progress Component:** Create progress bars and circular progress indicators

6. **Implement Main Screens:**

   **Home Dashboard Screen:**
   - Create a dashboard showing wallet balance, recent transactions, and goal progress
   - Implement a balance display component with large, clear typography
   - Add recent transactions list (last 5 transactions)
   - Create goal progress overview cards
   - Add basic savings chart using react-native-svg-charts
   - Include floating action button for quick actions

   **Goals Screen:**
   - Create a goal list with progress indicators
   - Implement goal creation form with amount input and date picker
   - Create goal detail screen with funding options
   - Add progress tracking with visual indicators
   - Implement goal completion celebrations

   **Transaction History Screen:**
   - Create searchable and filterable transaction list
   - Implement transaction categories and type indicators
   - Add transaction detail view
   - Implement pull-to-refresh functionality
   - Add export functionality for transaction history

   **Onboarding Flow:**
   - Create multi-step onboarding wizard
   - Implement phone number verification with OTP
   - Create PIN setup with confirmation
   - Add KYC document upload interface
   - Implement M-PESA linking with STK push handling

   **Settings Screen:**
   - Create user profile management
   - Implement security settings (PIN change, biometrics)
   - Add M-PESA account management
   - Create notification preferences
   - Add help and support sections

### **Data & State Management**

7. **Set Up Redux Store:**
   - Create slices for: user, goals, transactions, settings
   - Implement async thunks for API calls
   - Set up persist store for offline capability

8. **Implement API Service:**
   - Create API service layer for Supabase integration
   - Implement authentication services
   - Create transaction and goals services
   - Add error handling and retry logic

9. **Add Form Validation:**
   - Create validation schemas using Yup
   - Implement client-side validation for all forms
   - Add real-time validation feedback
   - Implement proper error messaging

### **Key Features Implementation**

10. **Round-Up Savings Logic:**
    - Create round-up calculation utilities
    - Implement transaction monitoring
    - Add user preferences for round-up settings
    - Create savings allocation logic

11. **M-PESA Integration:**
    - Create M-PESA service integration
    - Implement STK push handling
    - Add transaction status tracking
    - Create error handling for M-PESA failures

12. **Notifications System:**
    - Implement in-app notifications
    - Add push notification handling
    - Create notification settings management
    - Add notification history

### **Performance & Optimization**

13. **Implement Performance Optimizations:**
    - Add code splitting for large screens
    - Implement lazy loading for images and components
    - Add virtual scrolling for large lists
    - Implement proper component unmounting

14. **Add Offline Support:**
    - Implement offline data storage
    - Add conflict resolution for data sync
    - Create offline indicators
    - Implement retry logic for failed operations

---

## **CODE EXAMPLES, DATA STRUCTURES & CONSTRAINTS**

### **TypeScript Interfaces**

```typescript
interface User {
  id: string;
  phoneNumber: string;
  pin: string;
  isVerified: boolean;
  kycStatus: 'pending' | 'verified' | 'rejected';
  mpesaLinked: boolean;
  createdAt: Date;
}

interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate?: Date;
  icon: string;
  status: 'active' | 'completed' | 'paused';
  createdAt: Date;
}

interface Transaction {
  id: string;
  type: 'deposit' | 'withdrawal' | 'savings' | 'roundup';
  amount: number;
  description: string;
  date: Date;
  goalId?: string;
  status: 'pending' | 'completed' | 'failed';
}
```

### **Component Example Structure**

```typescript
// components/Button.tsx
import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'tertiary' | 'destructive';
  size?: 'small' | 'medium' | 'large';
  loading?: boolean;
  disabled?: boolean;
  onPress: () => void;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'medium',
  loading = false,
  disabled = false,
  onPress,
  children
}) => {
  const theme = useTheme();

  // Button styling logic based on variant and size
  // ... implementation

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      style={[styles.button, { backgroundColor }]}
    >
      {loading ? (
        <ActivityIndicator color="white" />
      ) : (
        <Text style={[styles.text, { color: textColor }]}>{children}</Text>
      )}
    </TouchableOpacity>
  );
};
```

### **API Integration Example**

```typescript
// services/api.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabase: SupabaseClient = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

export const api = {
  auth: {
    signIn: async (phoneNumber: string, pin: string) => {
      // Implementation
    },
    signUp: async (phoneNumber: string, pin: string) => {
      // Implementation
    }
  },
  goals: {
    getAll: async () => {
      const { data, error } = await supabase
        .from('goals')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    create: async (goal: Omit<Goal, 'id' | 'createdAt'>) => {
      // Implementation
    }
  }
  // ... other API endpoints
};
```

### **CRITICAL CONSTRAINTS**

#### **What to Implement:**
- ✅ Use React Native with TypeScript
- ✅ Use React Native Paper as the base UI library
- ✅ Implement responsive design with mobile-first approach
- ✅ Follow the exact color palette and typography defined
- ✅ Implement WCAG 2.1 Level AA accessibility
- ✅ Use Redux Toolkit for state management
- ✅ Implement proper error handling and loading states
- ✅ Add comprehensive form validation
- ✅ Use the defined navigation structure (3 bottom tabs)

#### **What NOT to Implement:**
- ❌ Do NOT use Expo (use React Native CLI)
- ❌ Do NOT create a web version (mobile only)
- ❌ Do NOT use CSS-in-JS libraries other than React Native Paper
- ❌ Do NOT implement complex animations without performance considerations
- ❌ Do NOT skip proper TypeScript typing
- ❌ Do NOT ignore accessibility requirements
- ❌ Do NOT use external icons beyond Material Design Icons
- ❌ Do NOT implement features outside the defined scope (MVP only)

#### **Files to Create:**
- `src/components/Button.tsx`
- `src/components/Card.tsx`
- `src/components/Input.tsx`
- `src/components/Avatar.tsx`
- `src/components/CurrencyDisplay.tsx`
- `src/components/SkeletonLoader.tsx`
- `src/components/Progress.tsx`
- `src/screens/HomeScreen.tsx`
- `src/screens/GoalsScreen.tsx`
- `src/screens/HistoryScreen.tsx`
- `src/screens/OnboardingScreen.tsx`
- `src/screens/SettingsScreen.tsx`
- `src/navigation/AppNavigator.tsx`
- `src/context/ThemeContext.tsx`
- `src/store/index.ts`
- `src/services/api.ts`

#### **Files NOT to Modify:**
- Do NOT modify any existing files in node_modules
- Do NOT modify package.json dependencies without approval
- Do NOT create files outside the src/ directory structure
- Do NOT implement backend API endpoints (frontend only)

---

## **VISUAL DESIGN CONTEXT**

### **Design Style:**
- **Aesthetic:** Clean, modern, and trustworthy
- **Color Palette:** Green primary (#2E7D32) for growth and finance, blue secondary (#1976D2) for trust
- **Typography:** Inter font family with clear hierarchy
- **Spacing:** 8-point grid system for consistent spacing
- **Icons:** Material Design Icons with financial variants

### **Mobile-First Design:**
- **Primary Layout:** Single column for mobile (320px - 767px)
- **Touch Targets:** Minimum 44x44 points for all interactive elements
- **Navigation:** Bottom tab bar with 3 main sections
- **Forms:** Guided, step-by-step with clear validation
- **Feedback:** Immediate visual feedback for all interactions

### **Key Interaction Patterns:**
- **Bottom Tab Navigation:** Home, Goals, History (Settings in slide-out menu)
- **Card-Based Layout:** For goals, transactions, and dashboard items
- **Progressive Disclosure:** Show information progressively
- **Gesture Support:** Swipe actions for lists, pull-to-refresh
- **Loading States:** Skeleton loaders and progress indicators

---

## **SUCCESS CRITERIA**

The generated application should:
1. **Load in under 3 seconds** on standard mobile connections
2. **Achieve 60fps** for all animations and interactions
3. **Pass WCAG 2.1 Level AA** accessibility requirements
4. **Work offline** for core functionality
5. **Handle 100,000+ concurrent users** with proper state management
6. **Provide intuitive navigation** with clear user flows
7. **Display accurate financial data** with proper formatting
8. **Integrate seamlessly** with M-PESA for round-up savings

---

## **IMPORTANT REMINDERS**

⚠️ **This is a financial application handling real money - security and accuracy are paramount.**

⚠️ **All AI-generated code requires careful human review, testing, and refinement before production deployment.**

⚠️ **Implement proper error handling and user feedback for all financial operations.**

⚠️ **Follow Kenyan financial regulations and data protection requirements.**

⚠️ **Test thoroughly on both Android and iOS platforms.**

⚠️ **Implement proper security measures for PIN handling and financial data.**

⚠️ **Add comprehensive logging and monitoring for production deployment.**