/**
 * Builds the CV generation prompt.
 * Adapted from legacy/index.html buildPrompt() (lines 939-1119).
 *
 * Key changes from legacy:
 * - CV data comes from profile parameter, not hardcoded CV_BASE
 * - Bullet budget is dynamic based on number of experiences
 * - Skills pool comes from user's declared skills
 * - Tenure calculations are dynamic per experience
 */
export function buildGenerationPrompt(profile, jobDescription, language) {
  const isIt = language === 'it';
  const langLabel = isIt ? 'Italian' : 'English';
  const langInstruction = isIt
    ? 'Write in professional Italian business language. Keep English terms where standard in Italian corporate contexts (e.g., "Project Management", "Stakeholder Management", "Due Diligence").'
    : 'Write in professional English.';

  const totalBudget = 12;
  const budgetNote = buildBulletBudget(profile.experiences, totalBudget);

  const now = new Date();
  const currentDate = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const cvData = {
    name: profile.personal.name,
    experiences: profile.experiences.map(exp => ({
      role: exp.role,
      company: exp.company,
      period: exp.period,
      bullets: exp.bullets,
    })),
    education: profile.education,
    languages: profile.languages,
    skillsPool: profile.skills,
  };

  return `You are a professional CV writer. Your ONLY job is to adapt an existing CV to a job description by rephrasing and selecting — NEVER by inventing.

TODAY'S DATE: ${currentDate}.

OUTPUT LANGUAGE: ${langLabel}. ${langInstruction}

=== STRICT RULES (VIOLATION = FAILURE) ===

RULE 1 — ZERO INVENTION POLICY:
- You may ONLY use skills, competencies, and tools that appear in the "skillsPool" array below.
- You may ONLY rephrase the experience bullets provided — you CANNOT add new achievements, projects, clients, or metrics that are not in the original bullets.
- If the job description requires a skill NOT in the skillsPool, DO NOT include it. Skip it silently.
- If you are unsure whether something is in the pool, DO NOT include it.

RULE 2 — COMPETENCY SELECTION:
- Select 8-10 competencies EXCLUSIVELY from the skillsPool array.
- Use the EXACT wording from the skillsPool${isIt ? ' (translate to Italian where natural, keep English where standard in Italian corporate contexts)' : ''}.
- Do NOT paraphrase, merge, or create new competency labels.

RULE 3 — BULLET ADAPTATION:
- Each output bullet MUST map to a specific input bullet. You are rephrasing, not creating.
- You may reorder words, change emphasis, use synonyms for verbs, and highlight different aspects of the SAME fact.
- You CANNOT add quantitative metrics (numbers, percentages, monetary amounts) that are not in the original bullet.
- You CANNOT name clients, tools, or frameworks not already mentioned in that bullet.
${budgetNote}
- Each bullet MUST be max 230 characters (including spaces). If a rephrased bullet exceeds this, shorten it.

RULE 4 — SUMMARY:
- The professional summary must be EXACTLY 4 sentences, max 500 characters total (including spaces).
- It must describe the candidate using ONLY facts present in their experience and skills.
- Include keywords from the job description ONLY IF they match skills in the skillsPool.
- Never claim expertise in areas not covered by the candidate's experience.
- NEVER mention the degree grade, university name, or degree title in the summary.

RULE 5 — SKILLS LINE:
- The "skills" field must list tools and methodologies ONLY from the skillsPool.
- Do NOT add tools or methodologies from the job description that are not in the skillsPool.

RULE 6 — FORMAT (CRITICAL — ONE A4 PAGE):
- The CV MUST fit on a single A4 page. Exceeding one page is a FAILURE.
- The headline must be max 8 words.
- If in doubt, make it SHORTER.

RULE 7 — TONE OF VOICE:
- Factual and direct. Lead with what the candidate does and their domain.
- NEVER use: "proven track record", "accomplished", "passionate", "driven", "visionary", "exceptional", "leading expert", "outstanding".
- NEVER use: "driving innovation", "driving transformation", "thought leader", "change agent".
- AVOID inflated qualifiers: "leading institutions", "major international banks", "world-class".
- Use concrete facts: years of experience, domains, specific methodologies.
- Preferred verbs: analyzed, evaluated, optimized, designed, structured, coordinated, mapped, automated, streamlined, assessed, delivered, implemented.
- AVOID: spearheaded, championed, pioneered, orchestrated.

RULE 8 — KEYWORD MIRRORING (CRITICAL FOR ATS):
- When the JD uses a specific term and the CV data covers the same concept with different words, ALWAYS prefer the JD's exact wording in your output.
- Apply mirroring to ALL sections: summary, competency badges, bullets, skills line, headline.
- Do NOT mirror terms that would require inventing skills not in the skillsPool.
- SELF-CHECK: Before responding, scan the JD for its 10-15 most distinctive terms. For each, verify it appears VERBATIM at least once in your output.

=== CANDIDATE DATA ===

${JSON.stringify(cvData, null, 2)}

=== JOB DESCRIPTION ===

${jobDescription}

=== SELF-CHECK BEFORE RESPONDING ===

Before outputting your JSON, verify:
1. Every competency in "competencies" exists VERBATIM in skillsPool.
2. Every skill in "skills" exists in skillsPool.
3. Every experience bullet is a rephrase of an existing bullet — no new facts added.
4. The summary contains no claims about skills/experience not in the provided data.
5. KEYWORD MIRRORING CHECK: scan the JD for its 10-15 most important terms. For each, confirm it appears at least once in your output.
If any check fails, fix it before responding.

=== OUTPUT FORMAT ===

Respond with ONLY a valid JSON object (no markdown, no backticks, no explanation):
{
  "companyName": "Company Name",
  "roleTitle": "Role Title in ${langLabel}",
  "headline": "Professional headline (max 8 words)",
  "summary": "Professional summary (4 sentences, max 500 chars)",
  "competencies": ["from skillsPool only", "max 10"],
  "experience": [
    { "bullets": ["rephrased bullet 1", "rephrased bullet 2"], "omitted": false }
  ],
  "omittedExperiences": [
    { "index": 5, "reason": "Not relevant to target role and over budget" }
  ],
  "skills": "Comma-separated tools/methodologies from skillsPool only"
}

The "experience" array must have one item per included role, same order as input. If a role is omitted for space, include it in "omittedExperiences".`;
}

function buildBulletBudget(experiences, totalBudget) {
  if (experiences.length <= 2) {
    return `- BULLET BUDGET: You have ${totalBudget} bullet points total. Distribute based on relevance to the JD.`;
  }

  return `- BULLET BUDGET: The CV must fit on ONE A4 page. You have max ${totalBudget} bullet points total across all experiences.
- Most recent/relevant experiences: up to 4 bullets each.
- Supporting experiences: 1-2 bullets each.
- Old or less relevant experiences: 0-1 bullet, or omit entirely.
- If you omit an experience, list it in "omittedExperiences" with the reason.
- Prioritize experiences that match the JD's requirements.`;
}
