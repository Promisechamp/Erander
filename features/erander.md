# ERANDER — Product Concept and Building Plan

**Status:** Product-discovery summary and working blueprint  
**Last updated:** 2026-10-23  
**Proposed tagline:** *Get things done.*  
**Initial market:** Nigeria, with nationwide launch intent  
**Long-term vision:** International people-powered errand marketplace  
**Launch approach:** Responsive website first; Android and iOS apps later using the same backend

> This document records the concept and decisions discussed so far. It is a planning blueprint, not a substitute for legal, payment-provider, security, tax, or trademark review. Items described as proposed or undecided must be validated before launch.

---

## 1. Executive summary

ERANDER is a people-powered marketplace connecting individuals and businesses that need errands completed with independent people—called **eranders**—who are willing and eligible to do the work.

It is broader than a delivery app. Potential errands include shopping and groceries, pickups and parcel delivery, documents and office tasks, gift purchasing, home and everyday tasks, business errands, and other permitted requests.

Customers can browse erander profiles or post an errand and receive offers. Matching recommendations help customers discover suitable people without removing customer choice. The platform formalizes the agreed scope, price, budget, deadlines, communications, evidence, payment records, completion, and dispute process.

ERANDER intends to launch across Nigeria, while acknowledging that actual service availability will vary by area. The architecture should be international-ready from the beginning, but new countries and cross-border services should only be activated when payment, legal, verification, delivery, and operational requirements are ready.

The product's core priorities are trust, financial integrity, clear agreements, safety, privacy, fair dispute handling, and a practical phased release.

## 2. Vision, positioning, and value

### Vision
Make it easier for people and businesses to get everyday tasks done by connecting them with capable people through one trusted platform.

### Positioning
A unified marketplace for everyday and business errands—not just a courier service.

### Proposed brand line
**ERANDER — Get things done.**

This is a recommendation, not a finalized or legally cleared brand asset.

### Value by user type
- **Customers:** Find help, post errands, compare offers, approve scope and pricing, follow progress, and access support.
- **Eranders:** Choose categories and service areas, discover eligible work, make offers, complete jobs, and track earnings and security funds.
- **Businesses:** Arrange recurring errands, manage staff and spending controls, approve requests, and review transaction records.
- **Platform operations:** Build trust through verification, transparent agreements, evidence, accountable financial records, and fair enforcement.

## 3. Accounts and roles

Support individual customers, eranders, businesses, and platform administrators.

### Unified accounts
- Use one personal account with multiple authorized roles rather than separate logins for each role.
- A person may act as both a customer and an erander.
- A personal account may be associated with a business profile.
- Business owners can invite staff and assign permissions.
- Verification and eligibility are assessed separately for relevant roles.
- After sign-in, take users to their dashboard, adapting the experience to their authorized roles.

### Age eligibility
For the initial launch, eranders must be adults and meet the applicable legal minimum age and verification requirements. Supervised minors will not be permitted to perform paid errands at launch. Requirements must be reviewed for each future market.

## 4. Errand categories and discovery

### Proposed initial categories
- Shopping and Groceries
- Pickup and Delivery
- Documents and Office
- Gifts and Special Requests
- Home and Everyday Tasks
- Business Services
- Other Errands

Use predefined categories for easy discovery while allowing customers to describe unusual errands in free text. The system can suggest a category and allow the customer to correct it. Safety checks or administrator review may apply to unusual or higher-risk requests.

Authorized administrators should be able to add, edit, disable, or reorganize categories without rebuilding the application.

### Two discovery paths
1. **Browse eranders:** Review profiles, categories, service areas, availability, verification indicators, and other relevant information.
2. **Post an errand:** Describe the work and receive offers from eligible eranders.

Use smart matching recommendations while preserving customer choice. Potential matching factors include category, location, availability, reliability, relevant experience, proposed fee, verification eligibility, preferences, and previous successful working relationships. The system should not permanently disadvantage new eranders.

Customers may view both available and unavailable registered eranders, with availability clearly indicated.

### Offer limits and request expiry
- Customers can set a maximum number of offers for a request.
- Once the limit is reached, stop accepting offers unless the customer increases the limit.
- Customers can close or expire requests that are no longer needed.
- Do not allow active transactions to be deleted to evade cancellation, dispute, or financial rules.
- Keep completed and cancelled records according to the retention policy; they may be archived.
- Requests with no responses remain open for a defined period, with expiry information and suitable notifications.
- Before closing an unresponsive request, offer options such as extending the deadline, inviting eranders, broadening the service area, or adjusting the budget.
- Expiry stops new offers but preserves the record.

## 5. Location and service coverage

Use a hybrid location model:
- Users can enter locations manually or allow location detection.
- Customers can search nearby or specify another errand location.
- Eranders choose service areas, travel limits, and preferred categories.
- Matching considers location alongside category, availability, price, verification, and eligibility.
- Continuous GPS tracking is not required to use ERANDER.
- Location sharing during an active job is limited to the relevant transaction, clearly disclosed, and stopped when no longer needed.

### Geography
- Nationwide Nigeria launch is the intended goal.
- Registration may be nationwide, but the product must not imply every area has active service supply.
- Show service coverage and category availability honestly.
- Launch domestically first; enable international services only when legal, payment, delivery, verification, and operational arrangements are ready.

## 6. Languages and internationalization

- Initial interface language: **English**.
- Plan for additional international languages—potentially French, Spanish, Portuguese, Arabic, German, and Chinese—based on demand and translation capacity.
- **Igbo, Hausa, and Yoruba are not priorities in the language plan discussed.**
- Store user-facing text in translation resources rather than scattering text through application code.
- Support localized dates, times, number formats, and currency display.
- Language and country are separate settings. Changing language must not silently change country, transaction currency, or payment eligibility.
- Review translations for accuracy, especially safety, financial, and policy terminology.

## 7. Currency and international operations

### User-selected default currency
Users must be able to choose a preferred default currency during onboarding or in settings and change it later.

The default currency controls how supported amounts are displayed. It does **not** silently change an existing agreement, the transaction currency, or payout currency.

### Transaction rules
- Every errand and financial record must identify its currency explicitly.
- Initial Nigerian transactions are expected to use Nigerian naira (NGN/₦), subject to payment-provider and operational readiness.
- Design the financial system to support multiple currencies.
- Never silently convert an agreed amount or change its currency.
- If conversion is supported, show the exchange rate, fees, and final amount before confirmation.
- Actual payment and payout currencies depend on supported provider rails and applicable rules.
- Business accounts may set a reporting currency, while individual transactions retain their original currencies.

### International expansion
Adopt a Nigeria-first, international-ready strategy. Cross-border purchases and delivery should not be activated until the platform can handle relevant payment, customs, shipping, prohibited-item, verification, consumer-protection, and local legal requirements.

## 8. Pricing and revenue

Use a flexible, configurable fee system rather than a single hardcoded pricing model.

### Potential fee components
- Customer-approved shopping/item budget
- Erander service fee
- Delivery or travel fee
- ERANDER platform fee
- Payment-provider charges, where applicable and disclosed
- Applicable taxes or statutory charges
- Optional tip
- Refunds and unspent-budget reconciliation

Keep each component separate in transaction records and financial ledgers.

### Shopping and groceries
- Customers provide a list, quantities, budget, and relevant preferences.
- Show the full expected cost before the customer funds or confirms.
- Eranders may propose substitutions, revised prices, changed quantities, or removal of unavailable items.
- Material changes require customer approval before additional spending or a change to scope.
- Eranders must not silently exceed the approved budget.
- If a customer does not respond to a proposed change, do not spend beyond authorization; pause the affected work and notify the customer.

### Other errands
Customers and eranders may negotiate the erander's service fee where appropriate. ERANDER's platform charges remain separate and transparent and cannot be silently changed by negotiation.

### Configurable fees
Authorized administrators can configure fees by country, category, transaction type, and business plan. Fees must be disclosed before commitment. Historical transactions retain the agreed amounts and applicable rules.

Previously discussed example rates—20% platform charge and 5% delivery charge—were illustrative only. **No fee percentages or amounts have been finalized.**

### Revenue streams
Transaction fees are the proposed initial revenue focus. Potential later streams include optional subscriptions, business plans, partnerships, and clearly disclosed promotional placements. Subscription tiers and discounts remain future possibilities.

### Tips and referrals
- Tips are optional, separate from the service fee, and must not affect the security deposit.
- Tip processing and payout rules remain undecided.
- Growth channels may include customer and erander referrals, promotional codes, business partnerships, and targeted campaigns.
- Tie rewards to qualifying genuine activity or completed transactions, not registration alone.
- Prevent self-referrals and duplicate-account abuse; configure reward budgets, eligibility, and expiry.

## 9. Security deposits and financial safeguards

Security deposits are a major requirement because errands may involve customer funds, purchases, and property.

### Tier-based security requirement
- Eranders have a percentage-based security requirement determined by an approved tier/risk policy.
- The discussed range is **100% down to 25%** of the applicable errand value.
- The default policy must never reduce the requirement to 0%.
- Only explicitly authorized administrators may waive a requirement. Record the authorizing administrator, reason, date, duration, and applicable jobs or limits.
- Example tiers of 100%, 75%, 50%, and 25% are illustrative and remain provisional.
- Tier advancement criteria, automatic versus administrator-reviewed promotion, and additional risk factors remain undecided.

### Reusable balance and reservations
- Security is a reusable balance, not a new deposit for every job.
- Reserve the required amount for each applicable active job.
- The same funds cannot be counted toward multiple concurrent jobs.
- Check available security funds at appropriate offer, acceptance, and activation stages.
- If funds are insufficient, require a top-up or a valid authorized exemption.
- Requirements may depend on errand value and risk as well as tier.

### Separate financial records
Maintain distinct, auditable records for:
1. Refundable security balance and reservations
2. Customer errand funding and approved spending
3. Erander earnings and payouts

Do not rely on editable balance fields alone. Use a ledger with references, timestamps, statuses, actors, and authorization details. Displayed balances must reconcile with actual provider funds and settlement records.

### Release and disputes
- Release security reservations promptly after successful finalization when no legitimate claim or other active reservation requires them.
- In disputes, restrict only relevant funds to the extent permitted by law, policy, and provider capability.
- Do not forfeit security based only on an unsubstantiated complaint.
- Provide evidence review, reasons for decisions, and an appeal path.
- A deposit is a safeguard, not a guarantee that every loss will be covered.

### Legal and provider validation
Do not promise escrow or custody of customer funds unless the payment structure and applicable legal/provider arrangements have been validated. Distinguish internal accounting records from money actually held, transferred, or controlled by a provider.

## 10. Funding, payments, earnings, and settlement

Use a hybrid approach: eligible reusable balances for security and earnings, alongside an approved payment provider for errand funding and payouts.

### Funding by errand type
- **Shopping, groceries, and gift purchases:** Normally fund the full approved item budget upfront.
- **Prepaid item collection/delivery:** Funding may vary based on expenses and risk.
- **Documents and delivery:** Upfront or milestone-based funding where appropriate.
- **General errands:** Upfront, milestone, or post-completion arrangements where appropriate and permitted.
- **Large or high-risk errands:** Additional safeguards.

### Payment release
- Automate approval for normal, low-risk requests when objective checks pass.
- Send suspicious or high-risk requests for administrator review.
- Checks may include authorized budget, account verification, available security balance, transaction history, and suspicious indicators.
- Distinguish platform approval from actual payment-provider release.
- The customer's unilateral cancellation right ends when funds have actually been released, subject to exceptional dispute or legal processes.

### Settlement and reconciliation
- Same-day payout after success is a target where provider rails allow it, not a guarantee.
- Earnings become withdrawable only when settlement rules permit.
- Disclose withdrawal fees, status, and expected timing.
- Reconcile actual spending against the approved budget and evidence.
- Example: if a ₦50,000 budget results in ₦47,000 of evidenced spending, the remaining ₦3,000 must be refunded or otherwise handled under a clearly disclosed policy.
- Define refund and unspent-balance states and timelines.

## 11. Formal errand lifecycle

Core lifecycle:

`Request → Offers → Agreement → Funding/Payment Authorization → In Progress → Completion Review → Completed`

Additional states are needed for cancellation, expiry, failed execution, refund, incident, and dispute.

After offer acceptance, create a formal job record containing the approved task/scope, shopping list and quantities where relevant, budget, service fee, delivery charges, currency, authorized total, handover details, deadline, milestones, cancellation/refund terms, evidence requirements, and relevant safety/eligibility requirements.

Both parties review and accept the agreement before the job becomes active.

Chat helps with coordination and evidence but does not itself authorize material changes to price, scope, budget, or deadline. Material changes require explicit approval and a versioned agreement.

## 12. Completion, evidence, and ratings

### Completion workflow
1. Erander submits evidence such as receipts, photos, delivery confirmation, or recipient confirmation where appropriate.
2. Customer confirms receipt or reports missing, incorrect, damaged items, or another issue.
3. If the customer does not respond within a configurable period, automatic finalization may begin only when required evidence exists and no dispute or other blocking condition exists.
4. Reconcile authorized spending, evidenced expenses, service fee, platform/delivery charges, and refunds.
5. Release eligible security reservations and settle funds under the applicable rules.

The automatic completion deadline remains undecided.

### Ratings
- Support two-way ratings: customers rate eranders and eranders rate customers.
- Only genuine qualifying transactions can generate reviews.
- Provide reporting and moderation for fake, retaliatory, abusive, or otherwise inappropriate reviews.
- Avoid permanently disadvantaging new eranders.
- Use ratings as one factor among several in recommendations, not the sole ranking signal.

## 13. Messaging and communication

- Allow users to message through ERANDER before accepting a job.
- Keep personal phone numbers, email addresses, and other sensitive contact details private by default.
- Provide transaction-specific conversations after job acceptance.
- Plan for text, photos, documents, and voice notes in the initial communication roadmap where practical.
- Add voice/video calling later when the core platform is stable.
- Provide block and report controls.
- Retain relevant transaction communications under a clear privacy and dispute-retention policy.
- Restrict access to private messages by role and legitimate need; not every administrator should access every conversation.
- Notify users about important messages and transaction events.

## 14. Cancellation policy

### Customer cancellations
The user's proposed rule is:
- Customers may cancel after funding and erander approval while funds have **not yet actually been released**.
- If the erander has not requested release, or release was requested but has not been approved/processed, the customer can cancel under the normal policy.
- Once funds have actually been released, unilateral cancellation is no longer available. Exceptional circumstances, suspected fraud, or erander failure go through dispute resolution.
- Allow **three penalty-free cancellations within a rolling 90-day window**.
- The fourth and subsequent cancellations within that window incur a proposed **2% deduction from the applicable customer deposit**, with no additional punishment under the stated proposal.
- The exact base for the 2% deduction remains undecided. A recommended interpretation is the designated customer deposit for that errand, not the entire customer wallet/account balance. Disclose the base before applying it.
- Each cancellation ages out of the rolling count 90 days after it occurred.
- Release the erander's reserved security after cancellation processing if no other active job or legitimate claim requires it.

### Erander cancellations
- Before starting, an erander may cancel, but repeated cancellations may affect reliability scores or access under a fair, disclosed policy.
- After starting, review work already performed, money spent, receipts, remaining customer funds, and the reason for cancellation.
- Security deductions and restrictions require evidence and appropriate review.
- Assess genuine external circumstances fairly rather than automatically punishing the erander.

## 15. Support, disputes, and appeals

### Support model
Use combined support:
- In-app help centre
- Support tickets with reference numbers, status, ownership, and communication history
- Live chat when agents are available
- Ticket creation/follow-up when live chat is unavailable
- Priority escalation for urgent safety, suspected fraud, unauthorized transactions, missing funds, security-deposit disputes, and account compromise

Priority handling does not automatically assume either party is guilty.

### Dispute handling
- Automated reminders and deadline alerts
- Overdue notifications and customer reports
- Evidence review: agreements, messages, receipts, photos, payment records, and explanations
- Appropriate restrictions on disputed funds where permitted
- Recorded decisions, reasons, proportionate outcomes, and appeals

A complaint alone is not proof. Refunds, security deductions, suspensions, and other serious consequences should be evidence-based and follow the applicable policy.

## 16. Safety and prohibited activities

Implement safety and incident management for both customers and eranders. Potential features:
- Emergency/urgent-help action with a clear explanation of what ERANDER can actually do
- Support escalation and trusted contacts
- Incident reporting
- Optional location sharing for applicable active jobs
- Delivery/handover verification
- Risk alerts and suspicious-activity review
- Reporting of fraud, harassment, threats, unsafe locations, and other incidents

Do not imply ERANDER can dispatch emergency services unless a real integration and operational capability exist. Direct users to appropriate local emergency services when necessary.

Policies should address illegal activities, fraud, theft, stolen property, prohibited or dangerous items, controlled/prohibited substances, impersonation, harassment, threats, exploitation, and tasks creating unacceptable danger. Apply category- and country-specific rules, verification, review, and appeal processes where appropriate.

## 17. Verification and account enforcement

### Progressive verification
- Users can register and explore permitted public areas.
- Email and phone verification are required before protected account features.
- Eranders complete identity verification before accepting paid errands.
- High-value or high-risk errands may require enhanced checks.
- Business profiles and authorized representatives may require verification.
- Suspicious activity may trigger additional checks or temporary restrictions.
- Public profiles can show verification status without exposing sensitive documents.

Identity verification, financial eligibility, and trustworthiness are separate assessments.

### Combined automated and human enforcement
- Automate objective restrictions such as insufficient security funds, missing verification, spending limits, and clear prohibited requests.
- Use authorized human review for serious or disputed matters involving fraud, theft, abandonment, harassment, safety, security deductions, and appeals.
- Apply proportionate warnings, restrictions, extra verification, suspension, or bans based on evidence and policy.
- Provide fair appeal processes for significant decisions.
- Do not permanently ban or financially penalize users solely because of unverified complaints.

## 18. Business accounts

Businesses are included from the beginning alongside individuals.

Planned capabilities:
- Business profiles and verification
- Owner and staff accounts with granular permissions
- Recurring errands and scheduled requests
- Spending limits and approval controls
- Transaction history and downloadable receipts
- Rehiring trusted eranders
- Expense reporting and exports
- Business-level reporting currency

Each recurring errand requires its own authorization, financial record, and completion confirmation. A schedule must not imply unlimited spending.

Business subscriptions, recurring schedules, multiple staff accounts, enhanced reporting, priority support, and integrations can be introduced progressively. Plan tiers and pricing remain undecided.

## 19. Notifications

Use smart, user-controlled notifications across:
- In-app notifications
- Email
- SMS
- Push notifications where supported

Notify users about offers, accepted jobs, progress, deadlines, completion, payments, refunds, earnings, withdrawals, security-balance changes, messages, support tickets, verification, account security, safety incidents, business approvals, spending limits, recurring errands, and optional promotions.

Provide a notification centre and preference controls. Separate marketing from essential transaction and security alerts and respect applicable law and channel rules. Use delivery tracking, retries, and duplicate prevention where possible.

## 20. Administrator and operations system

Use role-based administration and least-privilege access.

### Proposed roles
- **Super Admin:** Platform-wide configuration, administrator permissions, exceptional authorizations.
- **Finance Team:** Reconciliation, refunds, payouts, authorized financial adjustments.
- **Support Team:** Support tickets and routine account assistance.
- **Trust & Safety Team:** Fraud, harassment, suspicious activity, and safety incidents.
- **Verification Team:** Identity and business verification.
- **Operations Team:** Categories, service coverage, and marketplace operations.
- **Read-only Auditor:** Authorized review without modification rights.

### Safeguards
- Strong administrator authentication and multi-factor authentication where supported
- Granular permissions and audit trails
- Explicit authorization for security-deposit exemptions
- Additional approval for sensitive financial actions where appropriate
- Separation between viewing, recommending, approving, and executing financial actions
- Restricted access to identity documents, financial records, and private messages

## 21. Centralized business rules

Build a configurable rules system rather than hardcoding every policy.

Authorized administrators may manage:
- Platform and delivery fees
- Categories and availability
- Offer limits and request expiry
- Cancellation rules
- Verification thresholds
- Security tiers and eligibility
- Supported countries, currencies, and service areas
- Notification templates and rules
- Business-plan features and spending limits

Require validation, effective dates, audit records, and extra authorization for sensitive changes. Major changes may use controlled rollouts.

Configuration must not allow silent retroactive changes to existing agreements or bypass safeguards. Existing transactions retain agreed terms unless a properly authorized and lawful process permits a change.

## 22. Data protection, security, and recovery

- Encrypt data in transit and apply appropriate encryption at rest.
- Use managed secrets and secure deployment practices.
- Restrict access to personal, financial, identity, and communication data.
- Automate backups and test restoration.
- Establish recovery plans for outages, corruption, and accidental deletion.
- Maintain audit logs for sensitive administrative and financial actions.
- Monitor suspicious access and unusual activity.
- Define retention and deletion policies for personal data, messages, documents, and transaction evidence.
- Minimize data collection.
- Separate development, testing, and production environments.
- Define recovery objectives and periodically test disaster recovery.

Design for applicable Nigerian data-protection requirements and assess obligations before entering each market. Financial and dispute records may need to be retained for legitimate accounting or legal reasons even when other data can be deleted.

## 23. Technology and infrastructure principles

### Website first, shared backend
- Launch a responsive, mobile-first website.
- Build a central backend and API for the website and future Android/iOS apps.
- Share authentication, accounts, errands, messages, payments, ledgers, notifications, and administration.
- Keep business logic centralized rather than duplicating it in each client.
- Design APIs with versioning, validation, authorization, rate limiting, and clear error handling.

### Scalable, cost-conscious infrastructure
- Start with reliable, production-ready infrastructure.
- Use modular architecture and managed services where appropriate.
- Keep development, testing, and production separate.
- Monitor errors, performance, availability, and costs.
- Set spending alerts and scale capacity as demand grows.
- Avoid unnecessary enterprise complexity before it is justified.
- Do not sacrifice financial integrity, security, or recovery for short-term savings.

## 24. Brand and visual identity

This is the current recommendation, not a finalized identity.

### Brand attributes
Trustworthy, modern, efficient, human-centered, internationally scalable, professional without being cold, and friendly without being childish.

### Recommended palette

| Role | Colour | HEX |
|---|---|---|
| Primary | Midnight Navy | `#14213D` |
| Accent | Electric Mint | `#35D07F` |
| Main background | Warm White | `#F8FAFC` |
| Surface | White | `#FFFFFF` |
| Secondary text | Slate Grey | `#64748B` |
| Primary body text | Deep Charcoal | `#17202E` |
| Soft highlight | Soft Mint | `#E8FBF0` |

Use navy for strong brand anchors, mint for actions and highlights, and light backgrounds for readability. Test colour contrast and focus states. Error, warning, and success colours should remain accessible and consistent.

### Logo direction
Recommended concept: a distinctive **Forward E**—a custom letter E with subtle forward motion. Avoid a generic delivery or fintech appearance.

The identity should include:
- Primary wordmark: **ERANDER**
- Compact symbol for favicon and app icon
- Light and dark variations
- Sizing, spacing, and background rules

Check originality, domain availability, and trademark conflicts before adoption.

### Typography
Recommended primary typeface: **Manrope**, with Inter as an alternative. Start with one primary typeface and a consistent type scale.

### Interface principles
- Clean, premium, mobile-first responsive interface
- Readable headings and body text
- Consistent buttons, forms, cards, dialogs, and status indicators
- Accessible focus, loading, success, warning, and error states
- Consistent components across customer, erander, business, and administrator experiences
- Clear, prominent financial amounts and transaction breakdowns

### Landing page direction
Possible headline: **Get more done. Leave the errands to us.**

Possible supporting copy: “Find people to help with shopping, pickups, deliveries, everyday tasks, and business errands—all through one platform.”

Suggested actions:
- Find an Erander
- Post an Errand
- Earn with ERANDER

A separate business entry point can be provided without overcrowding the homepage.

## 25. Phased release roadmap

The first release should be a complete end-to-end marketplace, not just a collection of screens. The data model, API, permissions, and financial architecture should anticipate the long-term vision even where later features are not exposed yet.

### Phase 1 — Core Marketplace
- Unified authentication and multi-role accounts
- Customer, erander, and business profiles
- Email/phone verification and erander identity verification
- Categories, service areas, and availability
- Errand creation, browsing, offers, and matching
- Formal agreement and approved spending scope
- Payment-provider integration and transaction records
- Security-balance/reservation accounting
- Messaging and essential notifications
- Completion evidence, ratings, and basic dispute handling
- Role-based administrator dashboard
- Essential safety, privacy, audit, and recovery controls

### Phase 2 — Trust, Safety, and Operations
- More advanced fraud detection
- Automated deadline monitoring
- Expanded incident and dispute workflows
- Enhanced verification
- Improved financial reconciliation and reporting
- More sophisticated administrator controls

### Phase 3 — Business and Growth
- Recurring errands and business approval workflows
- Business plans and subscriptions
- Referral campaigns and promotional codes
- Advanced matching and marketplace analytics
- Additional communication features, including voice/video if justified

### Phase 4 — Expansion
- Additional international markets and currencies
- More languages
- Android and iOS apps using the shared backend
- Country-specific payment, verification, compliance, and operational integrations

The order may evolve based on user feedback, risk, resources, and readiness. Safety and financial integrity are required from the first public release.

## 26. Open decisions and validation required

### Commercial and policy questions
- Actual platform, delivery, payment, and business-plan fees
- Exact base for the proposed 2% cancellation deduction
- Cancellation processing, refund timelines, and exceptional cases
- Security tier criteria, promotion process, risk factors, and reservation timing
- Auto-completion deadline and evidence requirements by category
- Tip processing and payout rules
- Offer/request expiry defaults
- Business subscription tiers and discounts
- Retention periods for chats, evidence, identity documents, and financial records

### Legal, financial, and operational validation
- Nigerian legal structure and consumer obligations
- Payment-provider eligibility, supported currencies, settlement, and payout rules
- Whether the intended money flow is lawful and operationally supported; do not describe it as escrow without validation
- Data protection and cross-border data obligations
- Identity-verification provider and cost
- Higher-risk errand and prohibited-item rules
- Tax, invoicing, dispute, and refund obligations
- ERANDER domain and trademark clearance
- Realistic nationwide coverage and support staffing

### Product and technical decisions
- Exact technology stack and hosting provider
- Database schema, ledger design, payment integration, and authorization boundaries
- Notification providers and delivery policy
- Location provider and mapping costs
- Administrator approval thresholds
- Final brand assets and visual design
- Launch success metrics, budget, and timeline

## 27. Recommended build principles

1. **Build the complete transaction flow first.** Users must be able to request, agree, fund, perform, verify, reconcile, and close an errand reliably.
2. **Treat money as a ledger, not a mutable number.** Customer funds, erander earnings, and refundable security funds must remain separate and reconcilable.
3. **Require explicit approval for material changes.** Especially price, scope, budget, and spending authorization.
4. **Design for evidence and fair disputes.** Preserve relevant records under a transparent retention policy.
5. **Keep permissions granular.** Users and administrators may only perform authorized actions.
6. **Do not equate verification with trustworthiness.** Identity, financial eligibility, and performance history are different signals.
7. **Automate clear rules; review serious disputes fairly.** Complaints alone are not proof.
8. **Disclose terms before commitment.** Fees, cancellations, funding, evidence, and release conditions must be clear.
9. **Be global-ready but operationally responsible.** Do not activate a market before payment, legal, verification, and service arrangements are ready.
10. **Build iteratively.** Keep the first public release focused while preserving the architecture needed for future growth.

## 28. Short product definition

**ERANDER is a people-powered marketplace where individuals and businesses can browse eranders or post errands, agree on scope and pricing, fund work through supported payment processes, communicate securely, track completion, and resolve issues through a transparent support system. It will launch with a nationwide Nigeria focus, use one account with multiple roles, require adults to perform paid errands, and be architected for international expansion and future mobile applications.**

The current brand recommendation is **ERANDER — Get things done**, using Midnight Navy and Electric Mint with a modern, human-centered interface. The launch strategy is phased, with financial integrity, safety, privacy, and a reliable end-to-end transaction workflow essential from the beginning.
