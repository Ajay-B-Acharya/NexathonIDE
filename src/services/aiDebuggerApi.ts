import { AIDebugRequest, AIDebugResponse } from '../types';
import { getApiBaseUrl } from '../config/endpoints';

export const aiDebuggerApi = {
  async analyzeAndDebug(payload: AIDebugRequest): Promise<AIDebugResponse> {
    const baseUrl = getApiBaseUrl();
    const response = await fetch(`${baseUrl}/ai/debug`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      let errorDetail = `AI Debugger request failed (${response.status})`;
      try {
        const errData = (await response.json()) as { message?: string; error?: string };
        errorDetail = errData.message || errData.error || errorDetail;
      } catch {
        // Fallback to statusText
      }
      throw new Error(errorDetail);
    }

    return (await response.json()) as AIDebugResponse;
  },
};

