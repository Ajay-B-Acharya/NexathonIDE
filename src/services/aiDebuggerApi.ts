import { AIDebugRequest, AIDebugResponse } from '../types';

const API_BASE_URL = (import.meta.env.VITE_API_URL as string) || 'http://localhost:3001/api';

export const aiDebuggerApi = {
  async analyzeAndDebug(payload: AIDebugRequest): Promise<AIDebugResponse> {
    const response = await fetch(`${API_BASE_URL}/ai/debug`, {
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

