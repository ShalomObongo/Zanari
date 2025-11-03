# Copilot Instructions for Zanari

This document provides comprehensive guidelines for GitHub Copilot when working with the Zanari fintech application codebase.

## Project Overview

Zanari is an automated savings platform designed for the Kenyan market that integrates with M-PESA to help users save money effortlessly through transaction round-ups and goal-based savings. The application focuses on financial security, user trust, and an encouraging user experience.

### Technology Stack

- **Frontend**: React Native 0.81+ with Expo, TypeScript 5.9+
- **UI Library**: React Native Paper 5.14+
- **Backend**: Supabase (PostgreSQL, Edge Functions, Auth, Storage)
- **Monorepo**: Nx 21.5+ workspace
- **State Management**: Zustand (planned)
- **Testing**: Jest, React Native Testing Library, Detox (planned)
- **Code Quality**: Prettier (single quotes), TypeScript strict mode
- **Build System**: Metro Bundler, Nx task orchestration

### Repository Structure

```
/
├── apps/
│   └── mobile/              # React Native mobile app with Expo
├── packages/
│   ├── config/              # Shared configuration
│   ├── data/                # Data layer and types
│   ├── shared/              # Shared utilities
│   └── ui/                  # Shared UI components
├── supabase/
│   ├── functions/           # Edge Functions
│   └── config.toml          # Supabase configuration
├── docs/                    # Architecture and API documentation
└── .github/                 # GitHub workflows and configurations
```

## Development Guidelines

### Code Style and Conventions

1. **TypeScript**:
   - Use strict mode with all compiler options enabled
   - Prefer interfaces over types for object shapes
   - Use explicit return types for functions
   - Leverage type inference where appropriate
   - Use `nodenext` module resolution

2. **React Native**:
   - Use functional components with hooks
   - Follow React Native best practices for performance
   - Use React Native Paper components for consistency
   - Implement proper error boundaries

3. **Naming Conventions**:
   - Use PascalCase for components and types
   - Use camelCase for functions and variables
   - Use UPPER_SNAKE_CASE for constants
   - Prefix interfaces with `I` if needed for clarity
   - Suffix types with `Type` when necessary

4. **Code Formatting**:
   - Run Prettier before committing: `npx prettier --write .`
   - Single quotes for strings
   - No semicolons (Prettier default)
   - 2-space indentation

### Security Guidelines

**CRITICAL**: This is a fintech application handling sensitive financial data. Security is paramount.

1. **Secrets Management**:
   - NEVER hardcode API keys, credentials, or secrets
   - Use environment variables via `.env.local` (not committed)
   - Follow the `.env.template` structure
   - Supabase keys must be stored in environment variables only
   - Review `.gitignore` to ensure secrets are excluded

2. **Data Protection**:
   - Implement Row Level Security (RLS) in Supabase
   - Validate all inputs on both client and server
   - Use parameterized queries to prevent SQL injection
   - Sanitize user inputs before display
   - Encrypt sensitive data at rest and in transit

3. **Authentication**:
   - Use Supabase Auth for authentication
   - Implement proper session management
   - Handle token refresh appropriately
   - Validate permissions on all API calls

4. **M-PESA Integration**:
   - Treat M-PESA credentials as highly sensitive
   - Validate all transaction callbacks
   - Implement idempotency for financial transactions
   - Log all financial operations for audit trails

### Testing Guidelines

1. **Unit Tests**:
   - Place tests next to the code being tested
   - Use `.test.ts` or `.spec.ts` suffixes
   - Follow Arrange-Act-Assert pattern
   - Mock external dependencies
   - Target >80% code coverage for critical paths

2. **Integration Tests**:
   - Test Supabase Edge Functions with real database
   - Use test fixtures for consistent data
   - Clean up test data after runs

3. **Running Tests**:

   ```bash
   # Run all tests
   cd /path/to/zanari && npx nx run-many --target=test

   # Run specific package tests
   cd /path/to/zanari && npx nx test <package-name>
   ```

### Build and Development

1. **Install Dependencies**:

   ```bash
   cd /path/to/zanari && npm install
   ```

2. **Start Development Server**:

   ```bash
   cd /path/to/zanari/apps/mobile && npm start
   ```

3. **Build**:

   ```bash
   cd /path/to/zanari && npx nx run mobile:build
   ```

4. **Type Checking**:

   ```bash
   cd /path/to/zanari && npx nx run-many --target=typecheck
   ```

5. **Linting and Formatting**:
   ```bash
   cd /path/to/zanari && npx prettier --check .
   cd /path/to/zanari && npx prettier --write .
   ```

### Nx Workspace Guidelines

1. **Task Execution**:
   - Use `nx` commands for task orchestration
   - Leverage Nx cache for faster builds
   - Run affected commands when appropriate: `nx affected --target=test`

2. **Dependencies**:
   - Add dependencies to the appropriate workspace (root, app, or package)
   - Respect workspace boundaries
   - Use TypeScript path mappings in `tsconfig.base.json`

3. **Project Structure**:
   - Keep apps focused on presentation
   - Move business logic to packages
   - Share types and utilities via packages

### Git and Pull Request Guidelines

1. **Commit Messages**:
   - Use conventional commits format
   - Examples: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`
   - Be descriptive and concise

2. **Branch Naming**:
   - Use descriptive branch names
   - Examples: `feature/user-auth`, `fix/savings-calculation`, `docs/api-guide`

3. **Pull Requests**:
   - Keep PRs focused and small
   - Include tests for new features
   - Update documentation as needed
   - Address security concerns in review

### Common Tasks

#### Adding a New Screen

1. Create screen component in `apps/mobile/lib/screens/`
2. Add navigation setup in navigation configuration
3. Create required types in `packages/data/`
4. Add tests for screen logic
5. Update documentation if needed

#### Adding a New Edge Function

1. Create function in `supabase/functions/<name>/`
2. Add tests in `supabase/functions/__tests__/`
3. Configure function in `supabase/config.toml`
4. Update API documentation
5. Test locally with Supabase CLI

#### Adding a New Package

1. Create package directory in `packages/`
2. Add `package.json` and `tsconfig.json`
3. Update workspace configuration
4. Add exports in package.json
5. Update path mappings in root `tsconfig.base.json`

## Terminal Execution Instructions

These rules are mandatory and must be followed exactly when generating or running terminal commands.

- Always run commands from an explicit absolute directory. Every command must be prefixed with a directory change using the absolute path, and the command itself. Use `&&` so the command runs only if `cd` succeeds:
  - Example: `cd /full/path/to/directory && <command>`
- Never use relative paths, `~`, or shell variables in place of the absolute path when executing a command.
- For multiple commands in the same working directory, combine them after a single `cd`:
  - Example: `cd /full/path/to/directory && command1 && command2`
- Before proposing or running any command, detect active processes or jobs that could be affected:
  - Check for shell jobs: `jobs -p`
  - Check for matching processes: `pgrep -f "<pattern>"` or `ps aux | grep "<pattern>"`
- If other commands or processes are running that might be interrupted or affected, do NOT proceed. Instead:
  - Run the command in a separate session that does not interfere with the running process.
- Always include a one-line comment explaining the intent of the command before the command itself.
  - Example:
    - `# Intent: run migration in project directory`
    - `cd /full/path/to/directory && ./migrate.sh`
- Treat interruption of other commands as unacceptable unless the user explicitly instructs that interruption is intended.
- Be explicit and conservative: when in doubt, ask for clarification rather than taking action.

## Documentation

- Architecture docs are in `docs/architecture/`
- Product requirements in `docs/prd.md`
- User stories in `docs/stories/`
- Integration guides in `docs/integration/`
- Keep documentation up-to-date with code changes

## Additional Resources

- M-PESA Integration: See `docs/integration/mpesa-setup-guide.md`
- Supabase Config: `supabase/config.toml`
- Environment Template: `.env.template`
- GitHub Workflows: `.github/workflows/`

---

These instructions are strict. Follow them verbatim. When in doubt, prioritize security and user data protection.
