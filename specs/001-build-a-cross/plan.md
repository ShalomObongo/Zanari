
# Implementation Plan: Cross-Platform Savings & Payments Application

**Branch**: `001-build-a-cross` | **Date**: 2025-09-23 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-build-a-cross/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → If not found: ERROR "No feature spec at {path}"
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → Detect Project Type from context (web=frontend+backend, mobile=app+api)
   → Set Structure Decision based on project type
3. Fill the Constitution Check section based on the content of the constitution document.
4. Evaluate Constitution Check section below
   → If violations exist: Document in Complexity Tracking
   → If no justification possible: ERROR "Simplify approach first"
   → Update Progress Tracking: Initial Constitution Check
5. Execute Phase 0 → research.md
   → If NEEDS CLARIFICATION remain: ERROR "Resolve unknowns"
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, agent-specific template file (e.g., `CLAUDE.md` for Claude Code, `.github/copilot-instructions.md` for GitHub Copilot, `GEMINI.md` for Gemini CLI, `QWEN.md` for Qwen Code or `AGENTS.md` for opencode).
7. Re-evaluate Constitution Check section
   → If new violations: Refactor design, return to Phase 1
   → Update Progress Tracking: Post-Design Constitution Check
8. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
9. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 7. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary
Cross-platform mobile application (Android/iOS) built with React Native and Expo that automatically rounds up user transactions and saves the difference in a dedicated wallet. The app integrates with Paystack Mobile Money API for M-Pesa transactions, provides P2P transfers, bill payment capabilities, and helps users build savings habits through automated micro-savings. Primary target users are students and young professionals in Kenya.

## Technical Context
**Language/Version**: React Native with Expo SDK (latest stable), TypeScript  
**Primary Dependencies**: Expo SDK, Supabase (auth/storage), Paystack Mobile Money API, React Navigation  
**Storage**: Supabase (PostgreSQL) for user data and transactions, Supabase Storage for KYC documents  
**Testing**: Jest, React Native Testing Library, Detox for E2E testing  
**Target Platform**: iOS 15+, Android API 24+ (cross-platform mobile)  
**Project Type**: Mobile + API (React Native app with backend services)  
**Performance Goals**: <200ms perceived latency for mobile interactions, <300ms backend p95 response time  
**Constraints**: <200ms p95 response, offline capability for viewing data, KYC document security, PIN-based security  
**Scale/Scope**: 10K initial users scaling to 100K, transaction processing, real-time balance updates

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Code Quality**: ✅ Design will follow React Native best practices, TypeScript for type safety, modular component structure following SOLID principles
**Testing Standards**: ✅ TDD approach planned with Jest for unit tests, contract tests for API endpoints, E2E tests with Detox for user flows
**Security**: ✅ PIN-based authentication, encrypted KYC storage in Supabase, secure Paystack API integration, data encryption at rest/transit
**User Experience**: ✅ Target <200ms perceived latency, consistent navigation patterns, accessible design following mobile UX principles
**Performance**: ✅ Performance requirements documented (<200ms mobile, <300ms backend p95), monitoring planned for transaction flows
**Scalability**: ✅ Architecture designed for horizontal scaling with Supabase backend, stateless API design, async payment processing
**Library-First**: ✅ Core functionality (round-up logic, payment processing, transaction management) designed as reusable services/hooks

## Project Structure

### Documentation (this feature)
```
specs/[###-feature]/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
# Option 1: Single project (DEFAULT)
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/

# Option 2: Web application (when "frontend" + "backend" detected)
backend/
├── src/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/

# Option 3: Mobile + API (when "iOS/Android" detected)
api/
└── [same as backend above]

ios/ or android/
└── [platform-specific structure]
```

**Structure Decision**: Option 3 - Mobile + API (React Native app with backend services via Supabase and Paystack integration)

## Phase 0: Outline & Research
1. **Extract unknowns from Technical Context** above:
   - For each NEEDS CLARIFICATION → research task
   - For each dependency → best practices task
   - For each integration → patterns task

2. **Generate and dispatch research agents**:
   ```
   For each unknown in Technical Context:
     Task: "Research {unknown} for {feature context}"
   For each technology choice:
     Task: "Find best practices for {tech} in {domain}"
   ```

3. **Consolidate findings** in `research.md` using format:
   - Decision: [what was chosen]
   - Rationale: [why chosen]
   - Alternatives considered: [what else evaluated]

**Output**: research.md with all NEEDS CLARIFICATION resolved

## Phase 1: Design & Contracts
*Prerequisites: research.md complete*

1. **Extract entities from feature spec** → `data-model.md`:
   - Entity name, fields, relationships
   - Validation rules from requirements
   - State transitions if applicable

2. **Generate API contracts** from functional requirements:
   - For each user action → endpoint
   - Use standard REST/GraphQL patterns
   - Output OpenAPI/GraphQL schema to `/contracts/`

3. **Generate contract tests** from contracts:
   - One test file per endpoint
   - Assert request/response schemas
   - Tests must fail (no implementation yet)

4. **Extract test scenarios** from user stories:
   - Each story → integration test scenario
   - Quickstart test = story validation steps

5. **Update agent file incrementally** (O(1) operation):
   - Run `.specify/scripts/bash/update-agent-context.sh copilot`
     **IMPORTANT**: Execute it exactly as specified above. Do not add or remove any arguments.
   - If exists: Add only NEW tech from current plan
   - Preserve manual additions between markers
   - Update recent changes (keep last 3)
   - Keep under 150 lines for token efficiency
   - Output to repository root

**Output**: data-model.md, /contracts/*, failing tests, quickstart.md, agent-specific file

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Load `.specify/templates/tasks-template.md` as base template
- Generate tasks from Phase 1 design artifacts:
  - API contracts from `contracts/api-spec.yaml` → Contract test tasks
  - Data model from `data-model.md` → Database schema and model tasks
  - User scenarios from `quickstart.md` → Integration test tasks
- Each API endpoint → contract test task [P] (22 endpoints = 22 contract tests)
- Each data entity → model creation task [P] (8 entities = 8 model tasks)
- Each user story → integration test task (10 scenarios = 10 integration tests)
- Service layer tasks → AuthService, WalletService, TransactionService, PaymentService
- React Native component tasks → Screen components, shared UI components
- State management tasks → Zustand stores for user, wallet, transaction state

**Ordering Strategy**:
- **Phase 1 - Foundation**: Database schema, Supabase setup, environment configuration
- **Phase 2 - Backend Services**: API models, service layer, authentication setup
- **Phase 3 - Contract Tests**: API endpoint tests (before implementation)
- **Phase 4 - Core Services**: Business logic implementation (round-up, payments)  
- **Phase 5 - UI Components**: React Native screens and components
- **Phase 6 - Integration**: Payment integration (Paystack), E2E user flows
- **Phase 7 - Testing & Validation**: Integration tests, quickstart execution

**Task Categories and Estimates**:
- **Environment & Setup**: 5 tasks (Supabase config, Paystack setup, dev environment)
- **Database & Models**: 8 tasks (schema creation, entity models, migrations)
- **API Contract Tests**: 22 tasks [P] (one per endpoint, can run in parallel)
- **Service Layer**: 6 tasks (core services: Auth, Wallet, Transaction, Payment, KYC, Notification)
- **Authentication & Security**: 4 tasks (PIN management, JWT handling, encryption)
- **Payment Processing**: 6 tasks (Paystack integration, round-up logic, transaction processing)
- **React Native UI**: 12 tasks (screens: auth, dashboard, payment, goals, settings)
- **State Management**: 4 tasks (Zustand stores for different domains)
- **Integration Tests**: 10 tasks (quickstart scenarios)
- **Performance & Error Handling**: 5 tasks (offline support, error boundaries, monitoring)

**Total Estimated Tasks**: 82 tasks across 7 phases

**Parallel Execution Opportunities** [P]:
- All contract test tasks can run independently
- Model creation tasks can run in parallel after schema setup
- UI component tasks can run in parallel after design system setup
- Integration test tasks can run in parallel after core implementation

**Dependencies and Critical Path**:
1. **Critical Path**: Environment → Database → Services → Payment Integration → UI → Testing
2. **Blockers**: Supabase setup blocks all backend tasks, Payment service blocks transaction UI
3. **External Dependencies**: Paystack sandbox access, KYC document testing, M-Pesa simulator

**Quality Gates Between Phases**:
- Phase 1→2: Database schema validates, Supabase connection established
- Phase 2→3: All models pass unit tests, API structure defined  
- Phase 3→4: Contract tests written and failing (TDD requirement)
- Phase 4→5: Core business logic tests passing, payment integration working
- Phase 5→6: UI components render correctly, navigation flows complete
- Phase 6→7: Integration tests passing, quickstart scenarios executable

**Task Template Structure**:
```
Task #XX: [Component] - [Action]
- Type: [setup|model|test|service|ui|integration]
- Priority: [critical|high|medium|low]
- Dependencies: [List of prerequisite task numbers]
- Parallel: [Y/N] - Can run with other tasks
- Estimate: [S|M|L|XL] (Small=1h, Medium=4h, Large=8h, XL=16h)
- Acceptance: [Specific completion criteria]
```

**IMPORTANT**: This planning phase describes the approach only. The /tasks command will execute this strategy to generate the complete `tasks.md` file with all 82+ numbered, ordered tasks following TDD principles and constitutional requirements.

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)  
**Phase 4**: Implementation (execute tasks.md following constitutional principles)  
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking
*Fill ONLY if Constitution Check has violations that must be justified*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |


## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [ ] Complexity deviations documented

---
*Based on Constitution v1.0.0 - See `/memory/constitution.md`*
