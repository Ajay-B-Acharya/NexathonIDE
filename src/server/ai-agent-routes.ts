import { Router, type Request, type Response } from 'express';
import { AICredentialService } from './services/aiCredentialService.js';
import { AIAgentOrchestrator } from './services/aiAgentOrchestrator.js';
import { supabaseAdmin } from './supabase.js';

interface AuthenticatedRequest extends Request {
  userId?: string;
}

/**
 * Extracts and verifies the authenticated user's ID.
 * Works with Supabase Bearer JWTs, with fallback to X-User-ID for local development and guest users.
 */
async function authenticateUser(req: AuthenticatedRequest, res: Response, next: () => void) {
  try {
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
    const clientHeaderUserId = req.headers['x-user-id'] as string;

    if (bearerToken) {
      try {
        const { data: { user }, error } = await supabaseAdmin.auth.getUser(bearerToken);
        if (user && !error) {
          req.userId = user.id;
          return next();
        }
      } catch {}
    }

    // Fallback for guest demos or local runs where Supabase JWT is absent
    const fallbackId = clientHeaderUserId || (req.body?.userId as string) || (req.query?.userId as string);
    if (fallbackId && typeof fallbackId === 'string' && fallbackId.trim()) {
      req.userId = fallbackId.trim();
      return next();
    }

    return res.status(401).json({ error: 'Authentication required to access personal AI agent' });
  } catch (err: any) {
    return res.status(401).json({ error: err?.message || 'Authentication error' });
  }
}

export function createAIAgentRouter(): Router {
  const router = Router();
  router.use(authenticateUser as any);

  // 1. GET User Personal AI Settings
  router.get('/settings', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const cred = await AICredentialService.getCredential(req.userId!, false);
      const serverHasGroq = Boolean(
        process.env.GROQ_API_KEY &&
        !process.env.GROQ_API_KEY.includes('paste_your_real_groq_api_key_here')
      );

      res.json({
        userId: req.userId,
        provider: cred?.provider || (serverHasGroq ? 'groq' : 'none'),
        selectedModel: cred?.selectedModel || 'llama-3.3-70b-versatile',
        hasCustomKey: Boolean(cred?.hasKey),
        isServerKeyAvailable: serverHasGroq,
        updatedAt: cred?.updatedAt,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to retrieve AI settings' });
    }
  });

  // 2. POST Save User Personal AI Provider Credentials (Encrypted at rest)
  router.post('/settings', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { provider, apiKey, selectedModel } = req.body;
      if (!provider || !apiKey) {
        return res.status(400).json({ error: 'Provider and API key are required' });
      }

      await AICredentialService.saveCredential(
        req.userId!,
        provider,
        apiKey,
        selectedModel
      );

      res.json({
        success: true,
        message: 'Personal AI credentials encrypted and saved securely.',
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to save AI credentials' });
    }
  });

  // 3. DELETE User AI Credentials
  router.delete('/settings', async (req: AuthenticatedRequest, res: Response) => {
    try {
      await AICredentialService.deleteCredential(req.userId!);
      res.json({ success: true, message: 'Personal AI credentials removed' });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to delete credentials' });
    }
  });

  // 4. POST Test AI Connection
  router.post('/test-connection', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { provider, apiKey, model } = req.body;
      let keyToTest = apiKey;

      // If no key passed in body, try using user's stored key
      if (!keyToTest) {
        const stored = await AICredentialService.getCredential(req.userId!, true);
        keyToTest = stored?.rawApiKey || process.env.GROQ_API_KEY;
      }

      if (!keyToTest) {
        return res.status(400).json({ success: false, error: 'No API key provided to test' });
      }

      const result = await AICredentialService.testConnection(
        provider || 'groq',
        keyToTest,
        model
      );

      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 5. GET Conversations for user & room
  router.get('/conversations', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const roomId = (req.query.roomId as string) || 'default';
      const conversations = await AIAgentOrchestrator.listConversations(req.userId!, roomId);
      res.json(conversations);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch conversations' });
    }
  });

  // 6. POST Create new conversation
  router.post('/conversations', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { roomId, title } = req.body;
      const conversation = await AIAgentOrchestrator.createConversation(
        req.userId!,
        roomId || 'default',
        title || 'New Task'
      );
      res.status(201).json(conversation);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to create conversation' });
    }
  });

  // 7. GET Messages for a specific conversation (ownership verified)
  router.get('/conversations/:id/messages', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const conversationId = String(req.params.id);
      const messages = await AIAgentOrchestrator.getMessages(req.userId!, conversationId);
      res.json(messages);
    } catch (err: any) {
      res.status(403).json({ error: err.message || 'Unauthorized access to conversation' });
    }
  });

  // 8. DELETE Conversation
  router.delete('/conversations/:id', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const conversationId = String(req.params.id);
      await AIAgentOrchestrator.deleteConversation(req.userId!, conversationId);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to delete conversation' });
    }
  });

  // 9. POST Chat turn with the Autonomous AI Agent
  router.post('/chat', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { roomId, conversationId, prompt, context } = req.body;

      if (!prompt || !prompt.trim()) {
        return res.status(400).json({ error: 'Prompt is required' });
      }

      // If conversationId not provided or doesn't exist, create one
      let targetConvId = conversationId;
      if (!targetConvId) {
        const conv = await AIAgentOrchestrator.createConversation(
          req.userId!,
          roomId || 'default',
          prompt.trim().slice(0, 36)
        );
        targetConvId = conv.id;
      }

      const assistantMessage = await AIAgentOrchestrator.executeAgentTurn({
        userId: req.userId!,
        roomId: roomId || 'default',
        conversationId: targetConvId,
        userPrompt: prompt.trim(),
        context,
      });

      res.json({
        conversationId: targetConvId,
        message: assistantMessage,
      });
    } catch (err: any) {
      console.error('Agent chat error:', err);
      res.status(500).json({ error: err.message || 'AI agent execution failed' });
    }
  });

  // 10. POST Execute Approved Command (Sandboxed / Boundary-checked)
  router.post('/execute-command', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { command, workingDir } = req.body;
      if (!command || !command.trim()) {
        return res.status(400).json({ error: 'Command is required' });
      }

      const result = await AIAgentOrchestrator.executeApprovedCommand(
        command.trim(),
        workingDir || '.'
      );

      res.json(result);
    } catch (err: any) {
      res.status(400).json({
        error: err.message || 'Command execution failed security check or encountered error',
        exitCode: 1,
      });
    }
  });

  return router;
}
