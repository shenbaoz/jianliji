# Resume Website Product Design

Date: 2026-07-21
Working name: 一岗一简历

## Product Positioning

一岗一简历 is a resume optimization website focused on job-specific resume generation.

The product should not compete as another generic resume scoring tool. Its main value is:

> Input a target job description, then generate a resume version tailored to that specific role.

The website helps users move from a general resume to a job-ready package:

- Job match report
- Resume issue diagnosis
- AI-guided experience mining
- Job-specific optimized resume
- Before/after comparison
- Resume template preview and export
- Interview talking points

## Target Users

The first release should primarily support:

- Fresh graduates with weak or scattered experience
- Career changers who need to reposition existing experience
- Internet job seekers, including operations, product, marketing, design, development, and data roles
- General white-collar users who need to tailor one resume for multiple job postings

The first release does not need deep coverage for every industry. The recommended early focus is fresh graduates, career changers, and common internet roles.

## Core Differentiation

The core differentiated flow is:

1. User imports an existing resume.
2. User pastes a target job description.
3. The system extracts the role's key requirements.
4. The system compares the resume against the target role.
5. The system asks targeted follow-up questions to uncover missing evidence.
6. The system generates a resume tailored to that job.

This is different from generic resume scoring because the output is not only a score or advice. The output is a usable job-specific resume version.

## User-Facing Features

### Account

Users can register and log in so their resumes, versions, exports, and orders are saved.

Initial login methods:

- Email/password or phone/password
- WeChat login can be added after the core website flow is stable

### Resume Import

Users can start from:

- PDF upload
- Word upload
- Plain text paste
- Manual entry

The first implementation can prioritize text paste and basic document upload extraction.

### Target Job Input

Users paste a job description. The system extracts:

- Job title
- Responsibilities
- Required skills
- Preferred skills
- High-frequency keywords
- Hidden hiring priorities

This input is required for the main optimization flow.

### Job Match Report

The report shows:

- Overall job match score
- Matched capabilities
- Missing or weak capabilities
- Missing keywords
- Resume sections that need rewriting
- Suggested content order for this job
- Content that should be removed or weakened

The free experience can show a partial report to demonstrate value.

### Resume Diagnosis

The diagnosis identifies concrete problems such as:

- Vague responsibility descriptions
- Missing measurable results
- Weak alignment with the target job
- Poor keyword coverage
- Redundant or low-value content
- Weak project summaries
- Confusing structure

Each problem should include a short explanation and a suggested direction.

### AI Follow-Up Questions

The system asks targeted questions when the resume lacks evidence.

Example:

Original resume line:

> Responsible for community operations.

Possible follow-up questions:

- How many users were in the community?
- How many campaigns did you run?
- What changed after your work?
- Did you improve conversion, retention, attendance, or revenue?
- Which parts did you personally handle?

The system must not fabricate achievements. It can only rewrite based on user-provided facts.

### Job-Specific Resume Generation

The system generates an optimized resume version for the target job.

The optimized content can include:

- Profile summary
- Work experience
- Project experience
- Campus experience
- Skills
- Education
- Job intention

The generated version should prioritize content that best supports the target role.

### Before/After Comparison

The result page shows original content beside optimized content.

Example:

Original:

> Responsible for public account operations.

Optimized:

> Independently handled topic planning, editing, publishing, and data review for a public account, publishing 36 articles and producing 5 articles with more than 3,000 reads.

This feature is important because it helps users immediately understand the value of the product.

### Online Resume Editor

Users can edit the generated resume directly on the website.

Required editing features:

- Edit text
- Reorder sections
- Delete sections
- Add experience items
- Switch templates
- Preview the final resume

### Template Center

Templates are useful, but they are not the core moat.

Initial template categories:

- Fresh graduate
- Career change
- Internet operations
- Product manager
- Software engineer
- Marketing/new media
- Finance/consulting
- State-owned enterprise/public sector
- Simple one-page
- Business professional

Templates can be previewed for free. High-quality export can be paid.

### Export

Users can export the final resume as:

- PDF
- Word document

PDF export should be included in the first paid release. Word export can follow if it adds complexity.

### Interview Preparation

Based on the final resume, the system generates:

- 1-minute self-introduction
- Project explanation script
- Possible HR follow-up questions
- STAR answer suggestions
- Role-specific interview questions

This can be included as a paid feature or part of a higher plan.

### Resume Version Management

Users can save multiple job-specific resume versions.

Examples:

- ByteDance operations version
- Tencent product intern version
- Bank management trainee version
- State-owned enterprise admin version

Each version should store:

- Source resume
- Target job description
- Match report
- Follow-up answers
- Optimized resume
- Template choice
- Export records

### Payment And Membership

The product can support:

- Single resume optimization
- Single PDF/Word export
- Monthly membership
- Manual expert polishing

Free features:

- Resume import
- Job description input
- Basic match report
- A few diagnosis items
- One short optimization sample

Paid features:

- Full job-specific resume generation
- Full before/after comparison
- PDF/Word export
- Premium templates
- Interview scripts
- More saved versions
- Manual expert polishing

## WeChat Pay

WeChat Pay can be integrated into the website later, but it is deferred from the first implementation pass.

The first implementation should not call WeChat Pay APIs. It should keep a clean payment/order boundary so WeChat Pay can be added later without rewriting the resume workflow.

Important requirements:

- The site operator usually needs a verified WeChat Pay merchant account.
- In practice, this often requires a company or individual business license, depending on the merchant setup.
- The website must have a backend server to create payment orders and verify payment callbacks.
- The frontend should never hold merchant secrets.
- Orders must only be marked as paid after the backend verifies the WeChat Pay callback.

Future recommended payment structure:

- Create unpaid order in the website backend.
- Backend requests WeChat Pay payment parameters.
- Frontend displays the payment QR code or invokes a supported payment flow.
- WeChat Pay sends payment notification to backend.
- Backend verifies signature and payment status.
- Backend unlocks the paid resume/export feature.

The first release should show pricing and export-gating UI only if useful, but real paid unlocks can stay disabled until the merchant account and payment method are ready.

## Admin Features

The admin panel should support:

- User management
- Resume record management
- Order management
- Template management
- Case management
- AI prompt configuration
- Pricing configuration
- Coupon management
- User feedback
- Data statistics

The first admin release can be simple and internal-only.

## Pages

### Public Pages

- Home page
- Template center
- Pricing page
- Login/register page

### User Workflow Pages

- Resume import page
- Target job input page
- Analysis report page
- AI follow-up page
- Optimization result page
- Online editor page
- Export/payment page
- Interview preparation page
- User center

### Admin Pages

- Admin dashboard
- Users
- Orders
- Resume records
- Templates
- Cases
- Prompt settings
- Pricing/coupons
- Feedback

## MVP Release Scope

The first publishable release should include a complete user and payment loop:

1. Register/login
2. Import or paste resume
3. Paste target job description
4. Generate job match report
5. Ask AI follow-up questions
6. Generate job-specific resume
7. Show before/after comparison
8. Edit resume online
9. Choose a template
10. Pay for full output or export
11. Export PDF
12. Save resume version
13. Admin can view users, orders, and resume records

Word export, advanced membership, manual expert polishing, SEO content, and deep analytics can be added after the first complete release.

## Suggested Development Phases

## Development Workflow

The project should be built as a normal website codebase that can be opened directly in VS Code.

Expected local workflow:

- Open the project folder in VS Code.
- See frontend pages, backend/API code, database schema, and configuration files in the workspace.
- Run the website locally with a documented command.
- Preview the website in a browser during development.
- Keep feature code readable and organized by product area.

The implementation should avoid hidden generated code or opaque no-code tooling. The user should be able to inspect and gradually understand the project files.

### Phase 1: Product Foundation

- App shell
- Account system
- Basic database structure
- Home page
- Resume import
- Target job input

### Phase 2: AI Resume Core

- Job description parser
- Resume diagnosis
- Job match report
- AI follow-up question generation
- Job-specific resume generation
- Before/after comparison

### Phase 3: Editor And Export

- Online editor
- Template preview
- PDF export
- Version management

### Phase 4: Commercialization

- Order system
- Payment adapter prepared for future WeChat Pay integration
- Feature unlock rules
- Pricing page
- Payment success/failure handling

### Phase 5: Admin

- Admin login
- User management
- Order management
- Resume record management
- Template management
- Prompt and pricing settings

### Phase 6: Growth

- Resume cases
- SEO articles
- Shareable result pages
- Referral or coupon campaigns

## Safety And Quality Rules

- The system must not invent user achievements.
- AI output should clearly separate rewritten content from suggestions.
- Payment status must be verified by backend callbacks.
- Uploaded resumes may contain personal information and must be handled carefully.
- Users should be able to delete their resume data.
- Paid export should be reproducible from saved resume versions.

## Open Implementation Decisions

These should be resolved before coding:

- Tech stack
- Hosting platform
- Database provider
- AI provider and model choice
- File storage provider
- Exact WeChat Pay merchant account status
- Whether the first release supports Word export or PDF only

Recommended default for the first implementation plan:

- Build a web app with a modern React-based stack.
- Use a backend with database support.
- Start with PDF export before Word export.
- Defer real WeChat Pay integration for now, but design the payment adapter so WeChat Pay or other payment methods can be added later.
