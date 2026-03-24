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
  throw new Error("IDAT analysis is available via MCP tools. Web upload coming in a future release.");
}

export async function pollSessionStatus(sessionId: string): Promise<SessionStatus> {
  throw new Error("IDAT analysis is available via MCP tools. Web upload coming in a future release.");
}

export async function fetchSessionResults(sessionId: string): Promise<string> {
  throw new Error("IDAT analysis is available via MCP tools. Web upload coming in a future release.");
}
