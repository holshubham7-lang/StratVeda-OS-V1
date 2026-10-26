export type OnboardingDataIntake = {
  status?: string | null;
  evidencePackageText?: string | null;
  masterResponse?: string | null;
};

export type OnboardingContextData = {
  company: Record<string, unknown> | null;
  context: Record<string, unknown> | null;
  profile: Record<string, unknown> | null;
  evidence: Record<string, unknown>[];
  brief: Record<string, unknown> | null;
  dataIntake?: OnboardingDataIntake | null;
};

function stringifyValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'not provided';
  if (Array.isArray(value)) return value.map((item) => stringifyValue(item)).join(', ');
  return String(value);
}

function formatSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return 'unknown size';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function parseJson(text?: string | null) {
  if (!text) return null;
  const trimmed = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed);
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null;
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    try {
      const parsed = JSON.parse(trimmed.slice(start, end + 1));
      return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null;
    } catch {
      return null;
    }
  }
}

function firstText(payload: Record<string, unknown> | null, keys: string[]) {
  if (!payload) return '';
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function formatDataIntake(intake?: OnboardingDataIntake | null) {
  if (!intake) return 'No company-data stage has been completed yet.';
  if (intake.status === 'skipped') return 'The customer skipped the optional company-data stage.';
  if (intake.status === 'failed') return 'The customer\'s optional company-data stage did not finish, so its evidence package is unavailable.';
  if (intake.status !== 'ready') return 'The customer has an optional company-data stage in progress.';

  const evidence = parseJson(intake.evidencePackageText);
  const packageStatus = firstText(evidence, ['package_status', 'packageStatus', 'status', 'readiness']);
  const summary = firstText(evidence, ['summary', 'executive_summary', 'evidence_summary', 'overview']);
  const limitations = Array.isArray(evidence?.limitations)
    ? evidence.limitations.filter((item): item is string => typeof item === 'string').slice(0, 5)
    : [];
  return [
    `Data Agent package status: ${packageStatus || 'received'}`,
    summary ? `Data Agent summary: ${summary.slice(0, 1200)}` : '',
    limitations.length ? `Limitations: ${limitations.join('; ')}` : '',
    intake.masterResponse ? `Master Agent handover: ${intake.masterResponse.trim().slice(0, 1600)}` : '',
  ].filter(Boolean).join('\n');
}

/**
 * The single text block every agent sees about a customer: the brief agent for
 * its first summary and the workspace agent for each reply. Evidence arrives as
 * recorded metadata, because uploaded file contents are never stored.
 */
export function formatOnboardingContext(data: OnboardingContextData): string {
  const line = (label: string, value: unknown) => `${label}: ${stringifyValue(value)}`;
  const company = (data.company ?? {}) as Record<string, unknown>;
  const context = (data.context ?? {}) as Record<string, unknown>;
  const profile = (data.profile ?? {}) as Record<string, unknown>;
  const answers = ((data.brief?.answers ?? []) as { question?: string; answer?: string }[]);

  const sections = [
    '## Business overview',
    line('Company', company.companyName),
    line('Website', company.website || 'not provided'),
    line('Industry', company.industry),
    line('Business model', company.businessModel),
    line('Team size', company.teamSize),
    line('Annual revenue', company.revenueRange),
    line('Company stage', company.companyStage),
    line('Location', [company.city, company.state, company.country].filter(Boolean).join(', ') || 'not provided'),
    '',
    '## Strategic context',
    line('Primary objective', context.primaryObjective),
    line('Biggest constraint', context.biggestConstraint),
    line('Success definition', context.successDefinition),
    line('Why now', context.whyNow),
    '',
    '## Decision profile',
    line('Decision domains', profile.decisionDomains),
    line('Decision frequency', profile.decisionFrequency),
    line('Most important decision this quarter', profile.importantDecision),
    '',
    '## Evidence library',
    data.evidence.length
      ? data.evidence.map((item) => {
          const entry = item as Record<string, unknown>;
          return `- ${entry.name} (${entry.category}, ${entry.period}, ${formatSize(Number(entry.size))})`;
        }).join('\n')
      : 'No evidence files uploaded yet.',
    '',
    '## Company-data handover',
    formatDataIntake(data.dataIntake),
    '',
    '## Their own answers to the four brief questions',
    answers.length
      ? answers.map((entry) => `- Q: ${entry.question ?? ''}\n  A: ${entry.answer ?? ''}`).join('\n')
      : 'They have not answered the brief questions yet.',
  ];

  return `--- ONBOARDING DATA ---\n${sections.join('\n')}`;
}
