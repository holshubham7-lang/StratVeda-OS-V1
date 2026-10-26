export const dataIntakeExtensions = [
  '.pdf', '.docx', '.xlsx', '.csv', '.json', '.txt', '.png', '.jpg', '.jpeg',
] as const;

export type DataIntakeExtension = typeof dataIntakeExtensions[number];

export const maxDataIntakeFileSize = 25 * 1024 * 1024;
export const maxDataIntakeFiles = 5;
export const maxDataIntakeTextChars = 50000;
export const maxPromptShieldChars = 10000;
export const maxPromptShieldChunks = 5;

export const dataIntakeFileStatuses = [
  'quarantined', 'scanning', 'clean', 'extracting', 'ready', 'blocked', 'failed',
] as const;

export type DataIntakeFileStatus = typeof dataIntakeFileStatuses[number];

// 'collecting' holds uploaded files until the user asks for the handover, so
// files can be added one at a time or several at once.
export const dataIntakeSessionStatuses = ['collecting', 'processing', 'ready', 'failed', 'skipped'] as const;
export type DataIntakeSessionStatus = typeof dataIntakeSessionStatuses[number];

export const dataIntakeAgentStatuses = ['pending', 'running', 'completed', 'failed'] as const;
export type DataIntakeAgentStatus = typeof dataIntakeAgentStatuses[number];

export const dataIntakeExtensionMessage =
  'Only PDF, DOCX, XLSX, CSV, JSON, TXT, PNG, JPG or JPEG files can be added.';

export const dataIntakeExtensionOf = (name: string) =>
  `.${(name.split('.').pop() ?? '').toLowerCase()}`;

export const isTerminalDataIntakeFileStatus = (status: string) =>
  status === 'ready' || status === 'blocked' || status === 'failed';
