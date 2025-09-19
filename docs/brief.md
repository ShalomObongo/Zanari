# Project Brief: Zanari

## Executive Summary

Zanari is an automated savings application designed for the Kenyan market that enables users to save effortlessly as they spend. The solution integrates with multiple mobile money systems (M-PESA, Airtel Money, T-Kash) and provides debit card functionality, addressing the critical need for structured saving tools among millions of Kenyans using digital money. With a cloud-native microservices architecture leveraging existing payment APIs, Zanari minimizes regulatory complexity while delivering automated savings rules, goal tracking, and group savings capabilities through both mobile and web interfaces.

## Problem Statement

**Current State and Pain Points:**
- Millions of Kenyans lack structured saving tools despite widespread adoption of mobile money
- Manual saving requires discipline and consistent effort that many users struggle to maintain
- Existing mobile money systems focus on payments rather than savings behaviors
- No integrated solution automatically captures savings opportunities during daily spending
- Young professionals, students, and small business owners lack accessible savings platforms

**Impact of the Problem:**
- Reduced financial resilience among Kenyan mobile money users
- Missed opportunities for wealth accumulation through micro-savings
- Limited access to goal-oriented saving mechanisms
- Fragmented financial management across multiple payment platforms

**Why Existing Solutions Fall Short:**
- Mobile money wallets are payment-focused, not savings-focused
- Traditional banking apps often have high minimums and complex onboarding
- No automated "save as you spend" functionality integrated with daily transactions
- Limited support for group savings (chama) in digital formats
- Poor user experience for savings goal tracking and visualization

## Proposed Solution

**Core Concept and Approach:**
Zanari is a mobile/web application that automatically saves money whenever users spend, integrating seamlessly with Kenya's mobile money ecosystem and providing debit card functionality for comprehensive financial management.

**Key Differentiators:**
- **Automated Savings Engine**: "Save as you spend" functionality that rounds up transactions or applies custom rules
- **Multi-Platform Integration**: Single wallet supporting M-PESA, Airtel Money, and T-Kash
- **Debit Card Functionality**: Virtual and physical cards linked to savings wallet
- **Group Savings (Chama)**: Digital platform for traditional group savings with transparency
- **Goal-Oriented Interface**: Visual tracking of savings progress toward specific objectives

**Why This Solution Will Succeed:**
- Leverages existing, trusted mobile money infrastructure rather than replacing it
- Minimizes regulatory barriers through partnerships with licensed providers
- Addresses proven behavioral savings patterns (automation, goal-setting)
- Built for Kenyan market specifics with local mobile money integration
- Scales from simple MVP to comprehensive financial platform

**Product Vision:**
Become Kenya's leading automated savings platform by making saving effortless, accessible, and integrated into daily financial behaviors.

## Target Users

### Primary User Segment: Young Professionals (25-35 years)

**Demographic Profile:**
- Urban and peri-urban residents in major Kenyan cities
- Tech-savvy smartphone users with active mobile money accounts
- Income range: KES 50,000 - 200,000 monthly
- Educated with at least college diploma or university degree
- Single or newly married, early career stage

**Current Behaviors and Workflows:**
- Heavy users of M-PESA for daily transactions and bill payments
- May have basic bank accounts but prefer mobile money for convenience
- Regular online shopping and digital service subscriptions
- Some experience with investment apps or basic financial tools
- Social media active and influenced by peer financial behaviors

**Specific Needs and Pain Points:**
- Want to save but struggle with consistency and discipline
- Need automated solutions that don't require constant attention
- Desire progress tracking and achievement visualization
- Concerned about emergency funds and future financial security
- Interested in wealth building but overwhelmed by complex investment options

**Goals They're Trying to Achieve:**
- Build emergency funds equivalent to 3-6 months of expenses
- Save for specific goals (vacation, down payment, further education)
- Develop consistent saving habits without lifestyle disruption
- Access better financial opportunities through improved creditworthiness
- Participate in group savings for social and financial benefits

### Secondary User Segment: Small Business Owners

**Demographic Profile:**
- Small and medium enterprise owners in retail, services, or light manufacturing
- Age range: 30-50 years
- Business revenue: KES 100,000 - 1,000,000 monthly
- Tech-comfortable but time-constrained

**Current Behaviors:**
- Use mobile money for both business and personal transactions
- Experience irregular income patterns
- Need to separate business and personal finances
- Manage cash flow carefully for business sustainability

**Specific Needs:**
- Automated business savings for taxes and slow periods
- Separation of business and personal funds
- Emergency fund for business continuity
- Group savings for business expansion or equipment

## Goals & Success Metrics

### Business Objectives
- **User Acquisition**: 100,000 active users within 12 months of launch
- **Engagement**: 70% monthly active user rate with minimum 3 transactions per month
- **Savings Volume**: KES 50 million in total savings under management by end of year 1
- **Revenue**: Achieve break-even within 18 months through premium features and partnerships
- **Market Share**: Capture 15% of the Kenyan digital savings app market within 2 years

### User Success Metrics
- **Savings Rate**: Average 5-10% of user's monthly income saved through automation
- **Goal Achievement**: 60% of users achieve at least one savings goal within 6 months
- **Retention**: 80% user retention rate after 3 months, 60% after 12 months
- **Satisfaction**: 4.5/5 average app store rating with positive savings behavior feedback
- **Financial Inclusion**: 40% of users report improved financial security and confidence

### Key Performance Indicators (KPIs)
- **Daily Active Users (DAU)**: Number of unique users engaging with app daily
- **Average Savings Per User**: Total savings divided by active users, tracked monthly
- **Automated Rule Adoption**: Percentage of users setting up automated savings rules
- **Transaction Success Rate**: Payment processing success rate across all integrations
- **Customer Acquisition Cost (CAC)**: Cost to acquire each new user through marketing
- **Lifetime Value (LTV)**: Total revenue generated per user over their lifetime
- **Churn Rate**: Monthly percentage of users discontinuing service

## MVP Scope

### Core Features (Must Have)
- **User Onboarding & KYC**: Simple registration with identity verification and mobile money account linking
- **Basic Wallet Functionality**: Single wallet view showing balance, recent transactions, and savings summary
- **M-PESA Integration**: Full integration with M-PESA for deposits, withdrawals, and payments
- **Automated Round-up Savings**: Automatic saving of spare change from transactions (e.g., round KES 1,247 to KES 1,250, save KES 3)
- **Basic Goal Tracking**: Create savings goals with target amounts and target dates
- **Transaction History**: Complete record of all deposits, withdrawals, and savings transfers
- **Basic Security**: PIN protection, transaction notifications, and encrypted data storage
- **Mobile App**: Android and iOS app via react native
- **Basic Analytics**: Simple savings progress charts and monthly summaries

### Out of Scope for MVP
- **Physical Debit Cards**: Virtual cards only for MVP phase
- **Airtel Money and T-Kash Integration**: M-PESA only initially
- **Advanced Group Savings (Chama)**: Basic individual savings only
- **Investment Features**: Pure savings product, no investment integration
- **Web Dashboard**: Mobile app only for MVP
- **Advanced Analytics**: Basic progress tracking only
- **Multiple Wallet Support**: Single unified wallet initially
- **Credit Scoring**: No credit features in MVP
- **Bill Payment Integration**: Focus on savings, not bill payments

### MVP Success Criteria
- **Technical Stability**: 99.9% uptime with payment processing success rate > 98%
- **Savings Activity**: Average user saves minimum KES 1,000 monthly through automation
- **Business Viability**: Clear path to monetization through premium features
- **Partnership Validation**: At least one mobile money integration working smoothly

## Post-MVP Vision

### Phase 2 Features (6-12 months)
- **Airtel Money and T-Kash Integration**: Full multi-wallet support across all major Kenyan mobile money platforms
- **Group Savings (Chama)**: Digital platform for creating and managing group savings with transparency and automated contributions
- **Advanced Savings Rules**: Customizable automation rules beyond simple round-ups (percentage-based, scheduled transfers, goal-based triggers)
- **Web Dashboard**: Full-featured web interface for account management and detailed analytics
- **Enhanced Security**: Biometric authentication, transaction limits, advanced fraud detection
- **Basic Investment Options**: Integration with regulated investment products for longer-term savings growth
- **Partner Integrations**: Bill payments, airtime purchases, and selected merchant partnerships

### Long-term Vision (1-2 years)
- **Physical Debit Cards**: Full card program with both virtual and physical cards
- **Advanced Analytics**: AI-powered insights, spending patterns, and personalized savings recommendations
- **Credit Building**: Tools to help users build credit history through consistent savings behavior
- **Insurance Integration**: Micro-insurance products for savings protection
- **Business Accounts**: Dedicated features for small business savings and cash management
- **API Platform**: Open API for third-party integrations and partnerships
- **Regional Expansion**: Adaptation for other East African markets (Tanzania, Uganda, Rwanda)

### Expansion Opportunities
- **Education Savings**: Specialized features for school fees and education planning
- **Healthcare Savings**: Medical expense funds and health insurance integration
- **Property Savings**: Down payment assistance and property investment guidance
- **Retirement Planning**: Long-term retirement savings vehicles
- **Cryptocurrency Integration**: Bitcoin and other crypto savings options (when regulated)
- **International Remittances**: Cross-border savings and transfer capabilities

## Technical Considerations

### Platform Requirements
- **Target Platforms**:
  - Mobile: Android (MVP), iOS (Phase 2)
  - Web: Progressive Web App and responsive dashboard
  - Backend: **Supabase (Backend-as-a-Service)**
- **Browser/OS Support**:
  - Android 8.0+ (covering 90%+ of Kenyan Android users)
  - iOS 12.0+ (when launched)
  - Modern browsers (Chrome, Safari, Firefox)
- **Performance Requirements**:
  - Mobile app load time < 3 seconds
  - API response time < 500ms for 95% of requests
  - Support for 100,000+ concurrent users
  - 99.9% uptime SLA for core services (managed by Supabase)

### Technology Preferences
- **Frontend**:
  - Mobile: React Native with TypeScript
  - Web: React/Next.js with TypeScript
  - State management: Redux/Context API
- **Backend**:
  - **Supabase (Backend-as-a-Service)**
  - Server-side logic for payment integrations will be handled by **Supabase Edge Functions** (Deno-based).
- **Database**:
  - **Supabase's managed PostgreSQL** for all data.
  - Supabase's built-in **Row Level Security (RLS)** will be used for data access control.
- **Hosting/Infrastructure**:
  - **Supabase Cloud** for initial MVP development.
  - Plan for **self-hosting Supabase on a Kenyan cloud provider** to ensure compliance with data localization laws.

### Architecture Considerations
- **Repository Structure**:
  - Monorepo with separate packages for mobile, web, and Supabase functions.
  - Shared TypeScript types and utilities across platforms.
- **Service Architecture**:
  - The backend will be centered around Supabase's integrated services:
    - **Supabase Auth** for user management.
    - **Supabase Database (PostgreSQL)** for data storage.
    - **Supabase Edge Functions** for custom business logic and third-party integrations (M-PESA).
    - **Supabase Storage** for user-uploaded documents (KYC).
- **Integration Requirements**:
  - M-PESA Daraja API (STK Push, C2B, B2C, B2B) via Supabase Edge Functions.
  - Airtel Money API (Phase 2)
  - Payment aggregator for T-Kash (Phase 2)
  - Card issuer API for virtual cards (Phase 2)
- **Security/Compliance**:
  - End-to-end encryption for all data (managed by Supabase).
  - PCI DSS compliance for card processing (handled by partners).
  - Central Bank of Kenya reporting.
  - Data Protection Act 2019 compliance (addressed by self-hosting strategy).
  - Regular security audits and penetration testing.

## Constraints & Assumptions

### Constraints
- **Budget**:
  - Initial seed funding of $500,000
  - Runway of 18 months before requiring Series A
  - Focus on cost-effective cloud infrastructure (Supabase helps here)
- **Timeline**:
  - MVP launch within 6 months
  - Phase 2 features within 12 months
  - Profitability target: 24 months
- **Resources**:
  - Core team: 8-10 people (3 developers, 2 mobile, 1 product, 1 design, 1 marketing)
  - Limited technical resources for complex integrations
  - Dependence on third-party API reliability
- **Technical**:
  - Must integrate with existing mobile money APIs
  - Compliance requirements limit some architectural choices
  - Limited offline functionality due to security requirements
  - Kenyan internet connectivity constraints

### Key Assumptions
- Users trust automated savings mechanisms with their money
- Mobile money providers will maintain stable, accessible APIs
- Regulatory environment remains favorable for fintech innovation
- Kenyan users are willing to pay for premium savings features
- Mobile internet access is sufficient for target user base
- Round-up savings psychology works in the Kenyan context
- Group savings (chama) can be successfully digitized
- Security concerns can be adequately addressed to build user trust

## Risks & Open Questions

### Key Risks
- **Regulatory Risk**: Central Bank of Kenya may impose new restrictions on fintech or savings products
- **Competition Risk**: Existing banks or mobile money operators may copy features
- **Technical Risk**: Mobile money API changes or outages affecting service reliability
- **Security Risk**: Data breach or fraud undermining user trust (mitigated by using Supabase)
- **Market Risk**: User adoption slower than expected due to trust or behavioral barriers
- **Partnership Risk**: Mobile money operators or banks may limit API access
- **Funding Risk**: May require additional funding before achieving profitability

### Open Questions
- What is the optimal pricing strategy for premium features?
- Which mobile money provider should be the primary integration partner?
- How to handle failed savings transfers or disputed transactions?
- What level of savings automation do users prefer?
- How to balance automation with user control and transparency?
- What are the most effective user acquisition channels?
- How to ensure user trust in automated money handling?
- What specific group savings features are most needed?

### Areas Needing Further Research
- Competitive analysis of existing savings apps in Kenya and Africa
- User research on savings behaviors and preferences
- Mobile money API reliability and fee structure analysis
- Card issuer partnership options and requirements
- Regulatory compliance requirements for savings products
- Security best practices for fintech applications in Kenya
- User acquisition costs and effective marketing channels
- Payment processing failure handling and dispute resolution

## Appendices

### A. Research Summary

**Key Technical Findings:**
- M-PESA Daraja API provides comprehensive integration capabilities through REST/OAuth2
- Airtel Money offers similar OAuth2-based API access
- T-Kash requires payment aggregator integration (e.g., Interswitch PayWay)
- Card issuance through fintech partners (Miden, Sudo) minimizes PCI compliance burden
- Using **Supabase (Backend-as-a-Service)** simplifies the architecture, accelerates development, and provides a clear path to data localization compliance through self-hosting.

**Implementation Complexity:**
- Mobile money integrations are well-documented but require careful testing
- Security and compliance requirements add significant development overhead (simplified by Supabase)
- Automated savings engine requires robust event-driven architecture (implemented with Supabase Edge Functions)
- User experience design critical for building trust in automated financial features

### B. Stakeholder Input

**Technical Validation:**
- Architecture aligns with modern fintech best practices
- Security approach addresses key regulatory requirements
- Integration strategy leverages existing ecosystem effectively
- Scalability considerations appropriate for target market size

**Market Validation:**
- Strong demand for automated savings solutions among target demographics
- Mobile money integration essential for market acceptance
- Group savings (chama) features address important cultural savings patterns
- Pricing model needs validation through user testing

### C. References

**Technical Documentation:**
- Safaricom Daraja API Documentation
- Airtel Money Developer Portal
- Central Bank of Kenya Payment Service Provider Guidelines
- Kenya Data Protection Act 2019
- PCI DSS Requirements for Payment Applications

**Market Research:**
- Kenya National Bureau of Statistics Financial Access Survey
- Communications Authority of Kenya Sector Statistics Report
- FSD Kenya Financial Sector Deepening Research
- Competitor analysis of existing Kenyan fintech applications

## Next Steps

### Immediate Actions
1. **Finalize technical architecture** and select cloud provider
2. **Establish partnerships** with M-PESA and selected card issuer
3. **Begin MVP development** with focus on core savings engine
4. **Set up compliance framework** for regulatory requirements
5. **Conduct user research** to validate feature prioritization

### PM Handoff
This Project Brief provides the full context for Zanari. Please start in 'PRD Generation Mode', review the brief thoroughly to work with the user to create the PRD section by section as the template indicates, asking for any necessary clarification or suggesting improvements.