# Zanari Technical Feasibility and Architecture

## Executive Summary

Zanari's design leverages existing Kenyan mobile-money and card APIs to minimize licensing delays. Safaricom's M-PESA Daraja API (REST/OAuth2) provides endpoints for user payments (Lipa na M-PESA / STK Push), merchant pull (C2B), disbursements (B2C), and transfers (B2B). Likewise, Airtel Money offers OAuth2-based REST APIs via its developer portal. Telkom's T-Kash lacks public APIs, so integration would use a payment gateway or aggregator (e.g. Interswitch's PayWay supports T-Kash alongside M-PESA/Airtel). For debit cards, partnering with a card-issuing service (e.g. Miden, Sudo) is optimal, since these handle PCI-DSS and settlement. The recommended architecture is based on **Supabase**, a Backend-as-a-Service (BaaS) platform, which simplifies development by providing a suite of backend features out-of-the-box, including a PostgreSQL database, authentication, and serverless functions. This approach, combined with a React Native mobile app, allows for rapid development while ensuring security and scalability. Automated "save-as-you-spend" features can be built with event-driven triggers on each payment (e.g. "round-up" transfers). We propose an MVP in 0–6 months (basic wallet, card funding, one mobile-money integration), then roll out group savings and analytics (Phase 2), and finally scale-out and add innovations (Phase 3). Risk mitigation includes relying on established platforms (cloud services, card issuers) and designing for compliance from day one.

## 1. Integration Requirements Analysis

### M-PESA (Safaricom Daraja)

Safaricom's Daraja API is the standard way to integrate with M-PESA. Daraja is a RESTful API (replacing the legacy SOAP G2 API) that is publicly accessible on the internet. To use it, Zanari must register on the Safaricom developer portal and create an application, obtaining a ShortCode (till number or paybill) and OAuth credentials (Consumer Key/Secret). The app then calls the OAuth endpoint (e.g. `https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials`) to receive a time-limited access token. With this token, the app can call Daraja's endpoints:

*   **C2B (Customer-to-Business)** – For user payments into Zanari's merchant account (e.g. User pays Zanari's PayBill/Till). You must register confirmation/validation URLs to receive asynchronous callbacks.
*   **Lipa na M-PESA (STK Push)** – Zanari initiates an STK Push to the user's phone for checkout. The user enters their PIN, and upon success Zanari's server gets a payment confirmation webhook.
*   **B2C (Business-to-Customer)** – Disbursement API for pushing funds to users' M-PESA wallets (e.g. sending saved funds out to a user's phone).
*   **B2B (Business-to-Business)** – For transfers between Zanari's M-PESA accounts or between Zanari and partner businesses.
*   **Balance/Status Queries** – APIs to check account balances or transaction status.

Safaricom provides a sandbox environment for testing. Production use requires a live short code and may involve commercial contracts. Transaction fees are charged per the M-PESA tariff schedule (typically a small % of the amount, capped by law).

### Airtel Money Integration

Airtel Money (Airtel Kenya) provides a developer API via the Airtel Africa platform. The flow is similar to M-PESA: developers create an account on developers.airtel.africa and register an application, enabling "Collection" and "Remittance" APIs. Airtel's API uses OAuth 2.0 client credentials. After obtaining a `client_id` and `client_secret`, the app POSTs to the Airtel OAuth token endpoint (e.g. `https://openapi.airtel.africa/auth/oauth2/token`) to get a Bearer access token. With the token, the app can call endpoints like `POST /merchant/v1/payments/` to initiate a payment.

### Telkom T-Kash Integration

Telkom Kenya's T-Kash mobile money platform is newer and does not have an open public API like M-PESA or Airtel. In practice, fintechs integrate T-Kash by partnering or using a payment aggregator. For example, Interswitch's PayWay supports MPESA, Airtel Money, and T-Kash. This means if Zanari integrates with Interswitch's API, it can automatically handle all three networks.

### Debit Card Implementation Options

To offer debit card payments, Zanari needs to either partner with a bank/card issuer or use a card-issuing fintech platform. In Kenya, options include:

*   **Licensed Banks or Card Programs**: Collaborate with a bank that can issue Visa/Mastercard debit cards linked to Zanari's wallet.
*   **Fintech Card Issuers**: Several fintechs provide API-driven card issuance. For instance, Miden offers a card API enabling businesses to issue KES or USD debit cards to customers. Sudo (open platform) advertises the ability to "programmatically create, manage, and distribute both physical and virtual cards" with advanced controls.
*   **Global Fintech Platforms**: Companies like Rapyd or Stripe Issuing (if available in Kenya) offer global card APIs.
*   **Cryptocurrency-Linked Cards**: Some crypto wallets (e.g. Bitnob) offer USD virtual cards funded by crypto or mobile money.

## 2. Technology Stack Recommendations

To accelerate development and simplify the architecture, Zanari will be built on the **Supabase** Backend-as-a-Service (BaaS) platform. Supabase provides a robust, scalable, and secure backend infrastructure, allowing the development team to focus on front-end features and user experience.

### Backend: Supabase

Supabase is chosen over other BaaS solutions like Firebase primarily because it is open-source and uses a **PostgreSQL** database, which aligns with the project's need for structured, relational data for financial transactions.

The backend architecture will be composed of the following Supabase features:

*   **Database**: A managed PostgreSQL database will store all application data, including user information, wallets, transactions, and savings rules. Supabase's Row Level Security (RLS) will be heavily utilized to ensure that users can only access their own data, providing a critical layer of security for this fintech application.
*   **Authentication**: Supabase Auth will handle user onboarding, login, and management. It supports various authentication methods, including email/password and phone authentication, which is crucial for the Kenyan market.
*   **Edge Functions**: Server-side logic, such as integrating with the M-PESA Daraja API, will be implemented using Supabase Edge Functions (Deno-based). These functions will handle payment callbacks, process transactions, and execute the automated savings engine logic.
*   **Storage**: Supabase Storage will be used for securely storing user-uploaded documents, such as KYC (Know Your Customer) identification.

### Frontend: React Native

The mobile application for both Android and iOS will be developed using **React Native** with TypeScript. This allows for a single codebase for both platforms, speeding up development. The frontend will interact with Supabase using the `supabase-js` client library.

### Infrastructure and Data Localization

While Supabase does not currently have a server region in Kenya, its open-source nature allows for **self-hosting**. To comply with Kenya's Data Protection Act 2019, Zanari can be deployed on a Kenyan cloud provider (e.g., a local IaaS provider or a major cloud provider with a presence in the region). This provides a clear path to data residency and regulatory compliance.

## 4. Automated Savings Engine

We recommend an event-driven rule engine. The core idea is: every time the user spends money, a predefined rule triggers a transfer of a small amount into their savings. A common pattern is “round-up" savings.

## 5. Scalability & Performance

Scalability and performance will be managed by the chosen **Supabase** platform. Supabase is designed to scale automatically, and by using a managed service (or a properly configured self-hosted instance), Zanari can handle a large number of users and high transaction volumes without needing a dedicated infrastructure team to manage servers, databases, and containers.

## 6. Regulatory & Compliance Implications

*   **Financial Licenses**: Central Bank of Kenya (CBK) currently requires payment service providers to be licensed.
*   **Data Localization**: The Data Protection Act 2019 empowers authorities to mandate certain data be stored in Kenya.
*   **Data Protection & Privacy**: We must implement all Data Protection Act requirements.
*   **PCI-DSS & Card Data**: Since virtual card generation is involved, PCI-DSS compliance is implied.
*   **KYC/AML (POCAMLA)**: Payment laws require KYC for wallet users.

## 7. Automated Savings Engine (Detailed)

*   **Rule Configuration**: The user can set rules in the app.
*   **Event Trigger**: Whenever the user spends money, the backend payments service completes the transaction and emits an event.
*   **Savings Microservice**: A dedicated Savings microservice listens to the queue.
*   **Real-time Monitoring**: If the savings transfer fails, the service can retry or alert the user.
*   **Group Savings (Chama)**: Zanari plans a chama/group savings feature.

## 8. Implementation Roadmap

### Phase 1 - MVP (0-6 months):

*   **Core Features**: Launch the basic wallet, user onboarding, and savings. Implement M-PESA integration first.
*   **Savings Engine**: Build simple save rules.
*   **Platform**: Deploy the backend on **Supabase**. For the MVP, Supabase's managed cloud offering can be used for speed. A migration path to a self-hosted instance in Kenya should be planned to ensure data localization compliance post-MVP.
*   **Compliance**: Implement basic security (HTTPS, encryption), user KYC, and DPA consent flows.
*   **Testing**: Thoroughly test payment flows.

### Phase 2 - Advanced Features (6-12 months):

*   **Group Savings & Goals**: Add "chama" groups.
*   **Extended Integrations**: Activate T-Kash via aggregator.
*   **Enhanced Security/Compliance**: Move to a hardened containerized setup.

### Phase 3 - Scale & Innovation (12+ months):

*   **Full Card Program**: Offer physical debit cards.
*   **Regulatory Compliance**: If required, pursue appropriate licenses.
*   **Emerging Tech**: Explore blockchain for transparent group savings contracts.
*   **Optimizations**: Scale to multiple regions.

## 9. Innovation & Secondary Considerations

*   **Emerging Technologies**: AI/ML, Blockchain, Voice & USSD, Biometrics.
*   **Partnerships & Integration**: Banks, Fintech Ecosystem.
*   **Offline & Connectivity**: Rely on SMS/USSD.
*   **Cross-Platform Strategy**: Choosing React Native covers both iOS and Android natively.
*   **Data Analytics Infrastructure**: Build on a robust data warehouse.
*   **Security & Compliance Checklist**: Ensure code is tested against OWASP ASVS.
*   **Cost & Time-to-Market**: By avoiding building a bank or pursuing new licenses, and by using partner services, we accelerate deployment.
