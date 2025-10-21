<!--
Sync Impact Report:
- Version change: Initial → 1.0.0
- New principles added:
  * I. Code Quality Standards
  * II. Testing Standards (NON-NEGOTIABLE)
  * III. Security Best Practices
  * IV. User Experience Consistency
  * V. Performance Requirements
  * VI. Scalability Considerations
- Added sections:
  * Development Quality Gates
  * Architecture Standards
- Templates requiring updates:
  ✅ Constitution created
  ✅ Template validation completed
- Follow-up TODOs: None
-->

# Zanari Constitution

## Core Principles

### I. Code Quality Standards
Code MUST be maintainable, readable, and follow established patterns. Every module requires clear interfaces, comprehensive documentation, and adherence to language-specific style guides. Code reviews MUST verify architectural consistency, naming clarity, and absence of technical debt. No code merges without demonstrated adherence to SOLID principles and project conventions.

**Rationale**: High-quality code reduces maintenance costs, accelerates feature development, and ensures long-term project sustainability.

### II. Testing Standards (NON-NEGOTIABLE)
Test-Driven Development is mandatory: Write tests first, ensure they fail, then implement to make them pass. Every feature requires unit tests (>90% coverage), integration tests for external dependencies, and contract tests for APIs. Tests MUST be deterministic, fast (<1s per test), and independently executable.

**Rationale**: TDD prevents regression bugs, validates requirements understanding, and creates living documentation of system behavior.

### III. Security Best Practices
All data inputs MUST be validated and sanitized. Authentication and authorization MUST be implemented using industry-standard protocols. Sensitive data MUST be encrypted at rest and in transit. Security vulnerabilities MUST be addressed within 48 hours of discovery. Regular security audits and dependency scanning are mandatory.

**Rationale**: Security breaches cause irreparable damage to user trust and business reputation; proactive security measures are non-negotiable.

### IV. User Experience Consistency
User interfaces MUST follow established design patterns and accessibility standards (WCAG 2.1 AA minimum). Response times MUST not exceed 200ms for interactive elements. Error messages MUST be clear, actionable, and user-friendly. Consistent styling, terminology, and interaction patterns across all interfaces are mandatory.

**Rationale**: Consistent UX reduces user cognitive load, improves adoption rates, and creates a professional product experience.

### V. Performance Requirements
Applications MUST handle expected load with <200ms p95 response times and <100MB memory footprint per process. Database queries MUST be optimized with proper indexing. Resource usage MUST be monitored and optimized continuously. Performance regression testing is mandatory for all releases.

**Rationale**: Poor performance directly impacts user satisfaction and system scalability; performance must be designed in, not bolted on.

### VI. Scalability Considerations  
Architecture MUST support horizontal scaling from day one. Services MUST be stateless where possible. Database schemas MUST support sharding strategies. Inter-service communication MUST use async patterns where appropriate. System design MUST accommodate 10x growth in users and data.

**Rationale**: Retroactive scalability fixes are expensive and risky; scalable architecture patterns prevent future technical debt.

## Development Quality Gates

### Pre-Implementation Gates
- Feature specification approved and unambiguous
- Architecture review completed for new components
- Security impact assessment for data/auth changes
- Performance impact analysis for high-traffic features

### Pre-Merge Gates
- All automated tests passing (unit, integration, contract)
- Code coverage >90% for new code
- Security scan passing with no high/critical vulnerabilities
- Performance benchmarks within acceptable thresholds
- Code review approved by senior developer

### Post-Release Gates
- Monitoring alerts configured for new functionality
- Performance metrics tracked and within SLAs
- Error rates <0.1% for critical paths
- User feedback collection mechanisms active

## Architecture Standards

### Library-First Development
Every feature begins as a standalone, testable library with clear interfaces. Libraries MUST be self-contained, independently deployable, and follow single responsibility principle. No organizational-only libraries without clear functional purpose.

### API Design Standards
RESTful APIs MUST follow OpenAPI 3.0 specification. GraphQL schemas MUST be strongly typed. All endpoints MUST support JSON responses. Versioning strategy MUST be implemented for breaking changes. Rate limiting and authentication required for all public endpoints.

### Data Management Standards
Database migrations MUST be reversible and tested. Data retention policies MUST be clearly defined and implemented. Personal data handling MUST comply with privacy regulations. Backup and recovery procedures MUST be tested monthly.

## Governance

This constitution supersedes all other development practices and guidelines. All code reviews, feature planning, and technical decisions MUST verify constitutional compliance. Any proposed deviation MUST be documented with clear justification and alternative analysis.

Amendments require approval from project maintainers, impact analysis on existing features, and migration plan for affected components. Emergency security patches may bypass normal amendment process but require retrospective documentation.

Technical complexity that violates simplicity principles MUST be justified in project planning documents. Use `.specify/templates/agent-file-template.md` for runtime development guidance and technology-specific practices.

**Version**: 1.0.0 | **Ratified**: 2025-09-23 | **Last Amended**: 2025-09-23