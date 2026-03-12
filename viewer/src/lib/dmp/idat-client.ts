/**
 * IDAT Processing Pipeline — API Client
 */

const COMPUTE_API = '/api/v1/compute';

export interface PipelineStep {
  name: string;
  status: 'pending' | 'running' | 'complete' | 'error';
  message?: string;
}

export interface SessionStatus {
  sessionId: string;
  steps: PipelineStep[];
  currentStep: string;
  complete: boolean;
  error?: string;
  resultUrl?: string;
}

export async function uploadIdats(
  files: File[],
  sampleSheet: File | null,
): Promise<{ sessionId: string }> {
  const formData = new FormData();
  for (const file of files) {
    formData.append('idats', file);
  }
  if (sampleSheet) {
    formData.append('sample_sheet', sampleSheet);
  }
  const res = await fetch(`${COMPUTE_API}/load-idats`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as any)?.detail || `Upload failed: ${res.status}`);
  }
  return res.json();
}

export async function pollSessionStatus(sessionId: string): Promise<SessionStatus> {
  const res = await fetch(`${COMPUTE_API}/session/${sessionId}/status`);
  if (!res.ok) {
    throw new Error(`Status check failed: ${res.status}`);
  }
  return res.json();
}

export async function fetchSessionResults(sessionId: string): Promise<string> {
  const res = await fetch(`${COMPUTE_API}/session/${sessionId}/results`);
  if (!res.ok) {
    throw new Error(`Results fetch failed: ${res.status}`);
  }
  return res.text();
}
