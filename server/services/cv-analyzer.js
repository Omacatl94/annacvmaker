/**
 * Builds the strategic onboarding analysis prompt.
 * Analyzes CV vs JD and produces actionable observations.
 */
export function buildAnalyzerPrompt(profile, jobDescription, language) {
  const isIt = language === 'it';
  const langLabel = isIt ? 'Italian' : 'English';

  return `You are a senior career advisor and CV strategist. Analyze the candidate's CV against the target job description and produce specific, actionable observations.

OUTPUT LANGUAGE: ${langLabel}.

=== CANDIDATE CV DATA ===
${JSON.stringify(profile, null, 2)}

=== TARGET JOB DESCRIPTION ===
${jobDescription}

=== YOUR TASK ===

Analyze EVERY element of the CV against the job description. For each finding, produce an observation.

OBSERVATION TYPES:

1. **incongruence** — A CV element that hurts the candidacy:
   - Roles in unrelated fields (e.g., dentist applying for oculist — the dentist role adds no value)
   - Skills listed that are irrelevant and waste space
   - Experiences that contradict the target career path
   → severity: "high" if actively harmful, "medium" if just wasted space

2. **improve** — A CV element that exists but needs improvement:
   - Bullets that are vague or generic (no data, no specifics)
   - Skills the JD requires that the candidate MIGHT have but didn't list
   - Experiences that need better framing for the target role
   → severity: "medium" if important for the JD, "low" if nice-to-have

3. **valorize** — A CV element that supports the candidacy but isn't leveraged:
   - Roles that are complementary or propedeutic to the target
   - Skills or experiences that should be highlighted more prominently
   - Career progression that tells a coherent story toward the target role
   → severity: "low" (positive feedback)

CRITICAL RULES:
- Be SPECIFIC. Reference exact roles, bullets, skills by name.
- For "incongruence": explain WHY it hurts and give a concrete action (remove, reduce, reframe).
- For "improve": explain what's wrong and suggest a specific rewrite or question.
- For "valorize": explain the connection to the target role and how to leverage it.
- If you suggest adding a skill, ASK if the candidate has it. NEVER assume.
- Complementary/propedeutic roles should be VALORIZED, not flagged as incongruent.
  Example: M&A Analyst → Consulting is propedeutic, not incongruent.
- Judge incongruence by DISTANCE from target role. Adjacent fields = not incongruent.

ACTIONS PER TYPE:
- incongruence: ["remove", "reduce", "keep"]
- improve: ["edit"] (user will rewrite the element)
- valorize: ["apply", "ignore"]

=== OUTPUT FORMAT ===

Respond with ONLY valid JSON:
{
  "observations": [
    {
      "type": "incongruence",
      "severity": "high",
      "target": "experience",
      "target_index": 0,
      "target_field": "role",
      "title": "Short title",
      "detail": "Detailed explanation of the issue",
      "advice": "Specific, actionable advice",
      "actions": ["remove", "reduce", "keep"]
    }
  ],
  "overall_fit": {
    "score": 72,
    "summary": "2-3 sentence overall assessment of CV-to-role fit"
  }
}

Rules for overall_fit.score:
- 80-100: Strong fit, minor optimizations needed
- 60-79: Good base, some adjustments needed
- 40-59: Moderate fit, significant gaps
- 0-39: Poor fit, major restructuring needed`;
}
