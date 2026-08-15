# Evidence-Based Resume Tailoring Design

## Goal

Make the resume result materially more relevant to a target role without turning the product into a long wizard. The user should only need to upload a resume and choose a target role; a job description remains optional.

The product will move from conservative line-by-line polishing to evidence-based content selection, prioritization, and rewriting. It must never invent employment, projects, tools, metrics, or ownership.

## User Experience

1. User uploads a resume and chooses a target role. They may optionally paste a job description.
2. The system immediately produces a tailored resume. There is no mandatory questionnaire before the first result.
3. The result page shows the tailored resume first, followed by up to three concise "why this changed" highlights.
4. If an important fact is missing, the result page offers at most one optional, high-value follow-up question. Answering it creates a strengthened revision; skipping it never blocks download or editing.

The product automatically handles both profiles:

- Existing experience: prioritize the evidence most relevant to the role and reduce the visual weight of peripheral experience.
- Little or no formal experience: use verified courses, campus work, volunteering, part-time work, and personal projects as transferable evidence, without presenting them as formal employment.

## Optimization Pipeline

### 1. Evidence inventory

Parse the uploaded resume into a structured inventory of immutable facts:

- Roles, organizations, dates, education, and section types.
- Projects and responsibilities.
- Metrics, tools, channels, deliverables, and outcomes.
- Evidence source for every extracted claim.

The original resume remains the source of truth. A claim may be used only when it can be traced to the resume or a user-provided answer.

### 2. Role-fit plan

Derive a role profile from the target role and optional job description. Score each evidence item for relevance, strength, recency, and specificity.

The plan chooses which existing facts to:

- Lead with inside an experience.
- Expand into a stronger bullet where sufficient evidence exists.
- Condense when relevant but secondary.
- Keep concise when peripheral to the target role.
- Surface as an optional evidence question when the item is promising but lacks an outcome or scope.

The plan is internal. It is not a required screen for the user.

### 3. Tailored drafting

Generate a role-specific resume from the plan. The drafting rules are:

- Preserve factual truth and required identity/contact fields.
- Keep company, role, and date facts unchanged.
- Allow reordering of bullets within an experience and adjustment of section emphasis; do not require every original bullet to retain equal prominence.
- For profiles without formal experience, use accurate labels such as campus project, course project, or part-time experience.
- Prefer specific action, context, method, and result. If no result is evidenced, write the action and context clearly rather than fabricating an outcome.
- Avoid formulaic "strong verb + vague result" language.

### 4. Validation and explanation

Run claim-level checks on the draft. Reject or repair any unsupported metric, tool, skill, ownership claim, employer, project, or date.

Generate a short result explanation containing no more than three factual highlights, such as:

- "Prioritized Xiaohongshu account-operation evidence for a new-media role."
- "Moved campaign data and content-production evidence ahead of unrelated retail experience."
- "Kept paid-media experience as a skill gap instead of implying hands-on experience."

The validator must judge factual support separately from usefulness. A factually safe but near-identical draft is not a successful tailored result.

## Optional Follow-up Logic

Ask a question only when all conditions hold:

1. A target-role-critical evidence item exists in the resume.
2. One missing fact (for example reach, conversion, scope, cadence, or tool used) would materially strengthen it.
3. The answer is likely known by the user and can be asked in one sentence.

Examples: "这段小红书运营中，单篇最高曝光或互动量是多少？" or "这场活动实际覆盖多少人、完成了哪些环节？"

Never ask generic questions such as "请补充更多项目经历". Never ask more than one question in the first result.

## Required Changes to Current Behavior

- Replace the existing rule that preserves every experience bullet's count, order, and equal treatment.
- Keep immutable identity facts while allowing evidence-level prioritization and reordering.
- Replace generic rewrite quotas with role-fit coverage and substantive-difference checks.
- Stop automatically downgrading a well-supported strong claim merely because the exact wording did not occur in the source. A strong claim still requires evidence for the underlying action and scope.
- Preserve the current anti-fabrication, contact redaction, and unsupported-claim checks, but apply them at claim level rather than as blanket wording bans.
- Keep a separate fast-refine mode for users who do not select a target role; label it honestly as general polishing rather than deep tailoring.

## Success Criteria

- No extra mandatory step beyond resume upload and target-role selection.
- Every tailored result has at least two role-relevant evidence changes when the resume contains enough applicable material; otherwise it clearly identifies the limiting evidence gap.
- No unsupported factual claims pass validation.
- The result explains the value in three or fewer concise highlights.
- Users can download or edit the first result without answering follow-up questions.

## Non-goals

- Copying an entire third-party resume product or its user flow.
- Claiming guaranteed interview outcomes or ATS scores.
- Inventing metrics to make the result sound stronger.
- Requiring a long intake form before users see a result.
