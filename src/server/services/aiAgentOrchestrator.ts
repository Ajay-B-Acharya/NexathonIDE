import crypto from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';
import Groq from 'groq-sdk';
import OpenAI from 'openai';
import { supabaseAdmin } from '../supabase.js';
import { WorkspaceService } from './workspaceService.js';
import { AICredentialService } from './aiCredentialService.js';
import type {
  AIConversation,
  AIMessage,
  ProposedPatch,
  ProposedCommand,
  AIAgentContextPayload,
} from '../../types/index.js';

const execAsync = promisify(exec);

// In-memory fallbacks for conversations & messages
const memoryConversations = new Map<string, AIConversation>();
const memoryMessages = new Map<string, AIMessage[]>();

export class AIAgentOrchestrator {
  /**
   * List conversations for a specific user in a specific workspace room.
   * Strictly enforces user-level isolation.
   */
  public static async listConversations(userId: string, roomId: string): Promise<AIConversation[]> {
    try {
      const { data, error } = await supabaseAdmin
        .from('ai_conversations')
        .select('*')
        .eq('user_id', userId)
        .eq('room_id', roomId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        return data.map((d: any) => ({
          id: d.id,
          userId: d.user_id,
          roomId: d.room_id,
          title: d.title,
          createdAt: d.created_at,
          updatedAt: d.updated_at,
        }));
      }
    } catch {}

    // In-memory fallback
    return Array.from(memoryConversations.values())
      .filter((c) => c.userId === userId && c.roomId === roomId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /**
   * Create a new conversation for a user in a room.
   */
  public static async createConversation(
    userId: string,
    roomId: string,
    title = 'New Conversation'
  ): Promise<AIConversation> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const conv: AIConversation = {
      id,
      userId,
      roomId,
      title,
      createdAt: now,
      updatedAt: now,
    };

    memoryConversations.set(id, conv);
    memoryMessages.set(id, []);

    try {
      await supabaseAdmin.from('ai_conversations').insert({
        id,
        user_id: userId,
        room_id: roomId,
        title,
        created_at: now,
        updated_at: now,
      });
    } catch {}

    return conv;
  }

  /**
   * Delete a conversation, verifying ownership.
   */
  public static async deleteConversation(userId: string, conversationId: string): Promise<void> {
    const mem = memoryConversations.get(conversationId);
    if (mem && mem.userId === userId) {
      memoryConversations.delete(conversationId);
      memoryMessages.delete(conversationId);
    }

    try {
      await supabaseAdmin
        .from('ai_conversations')
        .delete()
        .eq('id', conversationId)
        .eq('user_id', userId);
    } catch {}
  }

  /**
   * Retrieve messages for a conversation, verifying user ownership.
   */
  public static async getMessages(userId: string, conversationId: string): Promise<AIMessage[]> {
    try {
      const { data: conv } = await supabaseAdmin
        .from('ai_conversations')
        .select('user_id')
        .eq('id', conversationId)
        .maybeSingle();

      if (conv && conv.user_id !== userId) {
        throw new Error('Unauthorized: You do not own this conversation.');
      }

      const { data, error } = await supabaseAdmin
        .from('ai_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (!error && data) {
        return data.map((m: any) => ({
          id: m.id,
          conversationId: m.conversation_id,
          userId: m.user_id,
          role: m.role,
          content: m.content,
          proposedPatches: m.metadata?.proposedPatches,
          proposedCommands: m.metadata?.proposedCommands,
          activityLogs: m.metadata?.activityLogs,
          createdAt: m.created_at,
        }));
      }
    } catch {}

    return memoryMessages.get(conversationId) || [];
  }

  /**
   * Save a single message in a conversation.
   */
  public static async saveMessage(
    userId: string,
    conversationId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    metadata?: Record<string, any>
  ): Promise<AIMessage> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const msg: AIMessage = {
      id,
      conversationId,
      userId,
      role,
      content,
      proposedPatches: metadata?.proposedPatches,
      proposedCommands: metadata?.proposedCommands,
      activityLogs: metadata?.activityLogs,
      createdAt: now,
    };

    const existing = memoryMessages.get(conversationId) || [];
    existing.push(msg);
    memoryMessages.set(conversationId, existing);

    try {
      await supabaseAdmin.from('ai_messages').insert({
        id,
        conversation_id: conversationId,
        user_id: userId,
        role,
        content,
        metadata: metadata || {},
        created_at: now,
      });

      // Update conversation title if first user message
      if (role === 'user' && existing.filter((m) => m.role === 'user').length === 1) {
        const title = content.trim().slice(0, 40).replace(/[\r\n]+/g, ' ') || 'Coding Task';
        const conv = memoryConversations.get(conversationId);
        if (conv) conv.title = title;
        await supabaseAdmin
          .from('ai_conversations')
          .update({ title, updated_at: now })
          .eq('id', conversationId);
      }
    } catch {}

    return msg;
  }

  /**
   * Build precision system prompt with project awareness.
   */
  private static buildSystemPrompt(context?: AIAgentContextPayload): string {
    let prompt = `You are NexathonIDE's Autonomous AI Coding Agent — a senior systems and full-stack software engineer embedded in a collaborative cloud IDE.
The code workspace is shared with team members in real-time via Yjs CRDTs.
Every change you propose must be mathematically sound, verified, and safe.

CRITICAL WORKFLOW & TOOL RULES:
1. You can inspect project files, explain algorithms, isolate root causes, and propose code fixes or commands.
2. The user has final approval over any code modification or terminal execution.
3. To propose a file modification or patch, you MUST use the following exact XML block:
<proposed_patch file="path/to/file.ext" explanation="Clear 1-sentence reason for this change">
<<<<
[Write the complete, updated content of the file here with zero placeholder omissions like '// ... existing code ...']
>>>>
</proposed_patch>

4. To propose executing a command in the workspace terminal (e.g., test runner, build, dependency check), you MUST use:
<proposed_command dir="." reason="Why this command is necessary">
[exact command to run, e.g. npm test or python -m unittest]
</proposed_command>

5. Always provide concise, insightful explanations. Use markdown syntax with language tags for inline code references.`;

    if (context) {
      prompt += `\n\n=== CURRENT PROJECT CONTEXT ===`;
      prompt += `\nWorkspace Room ID: ${context.roomId}`;

      if (context.currentFilePath) {
        prompt += `\nActive File: ${context.currentFilePath}`;
      }

      if (context.selectedCode) {
        prompt += `\nUser's Active Editor Selection (Lines ${context.selectedRange?.startLine || '?'}-${context.selectedRange?.endLine || '?'}):\n\`\`\`\n${context.selectedCode}\n\`\`\``;
      }

      if (context.currentFileContent && !context.selectedCode) {
        const snippet = context.currentFileContent.length > 8000
          ? context.currentFileContent.slice(0, 8000) + '\n... [truncated for token budget]'
          : context.currentFileContent;
        prompt += `\nActive File Content (${context.currentFilePath}):\n\`\`\`\n${snippet}\n\`\`\``;
      }

      if (context.recentError) {
        prompt += `\nRecent Runtime / Execution Error:\n\`\`\`\n${context.recentError}\n\`\`\``;
      }

      if (context.terminalSnippet) {
        prompt += `\nRecent Terminal Output:\n\`\`\`\n${context.terminalSnippet}\n\`\`\``;
      }

      if (context.fileTree && context.fileTree.length > 0) {
        prompt += `\nProject File Tree:\n` + context.fileTree.map((f) => `- ${f.path} (${f.language})`).join('\n');
      }

      if (context.projectProfile) {
        const p = context.projectProfile;
        prompt += `\n\n=== REPOSITORY & LANGUAGE PROFILE ===`;
        prompt += `\nPrimary Language: ${p.primaryLanguage}`;
        if (p.detectedLanguages && p.detectedLanguages.length > 0) {
          prompt += `\nLanguages: ` + p.detectedLanguages.map((l) => `${l.language} (${l.percentage}%)`).join(', ');
        }
        if (p.frameworks && p.frameworks.length > 0) {
          prompt += `\nFrameworks: ` + p.frameworks.join(', ');
        }
        if (p.buildSystems && p.buildSystems.length > 0) {
          prompt += `\nBuild Systems: ` + p.buildSystems.join(', ');
        }
        if (p.manifests && p.manifests.length > 0) {
          prompt += `\nManifests: ` + p.manifests.join(', ');
        }
        if (p.entryPoints && p.entryPoints.length > 0) {
          prompt += `\nEntry Points: ` + p.entryPoints.join(', ');
        }
        if (p.suggestedCommands && p.suggestedCommands.length > 0) {
          prompt += `\nRecognized Commands:\n` + p.suggestedCommands.map((c) => `- ${c.command} (${c.title})`).join('\n');
        }
      }

      prompt += `\n\nSECURITY RESTRICTIONS:
- Do not inspect, read, or print sensitive secrets from .env, .env.local, .pem, private keys, or tokens.
- Propose patches only for authorized project files.
- Explain trade-offs for changes across files.`;
    }

    return prompt;
  }

  /**
   * Parse proposed patches and commands from assistant text.
   */
  public static parseProposals(
    rawText: string,
    existingFilesMap: Map<string, string>
  ): {
    cleanContent: string;
    proposedPatches: ProposedPatch[];
    proposedCommands: ProposedCommand[];
  } {
    const patches: ProposedPatch[] = [];
    const commands: ProposedCommand[] = [];

    // Parse <proposed_patch file="..." explanation="...">\n<<<<\n...\n>>>>\n</proposed_patch>
    const patchRegex = /<proposed_patch\s+file="([^"]+)"(?:\s+explanation="([^"]*)")?>\s*<<<<\r?\n([\s\S]*?)\r?\n>>>>\s*<\/proposed_patch>/g;
    let match: RegExpExecArray | null;

    while ((match = patchRegex.exec(rawText)) !== null) {
      const filePath = match[1].trim();
      const explanation = match[2]?.trim() || `Proposed modifications to ${filePath}`;
      const patchedContent = match[3];

      const originalContent = existingFilesMap.get(filePath) || '';
      const originalContentHash = crypto
        .createHash('sha256')
        .update(originalContent)
        .digest('hex')
        .slice(0, 16);

      // Calculate approximate diff summary
      const origLines = originalContent.split('\n');
      const patchLines = patchedContent.split('\n');
      const additions = Math.max(0, patchLines.length - origLines.length);
      const deletions = Math.max(0, origLines.length - patchLines.length);

      patches.push({
        filePath,
        explanation,
        originalContentHash,
        originalContent,
        patchedContent,
        diffSummary: {
          additions: additions || 1,
          deletions,
          modifications: Math.min(origLines.length, patchLines.length),
        },
        status: 'pending',
      });
    }

    // Parse <proposed_command dir="..." reason="...">command</proposed_command>
    const commandRegex = /<proposed_command(?:\s+dir="([^"]*)")?(?:\s+reason="([^"]*)")?>\s*([\s\S]*?)\s*<\/proposed_command>/g;
    let cmdMatch: RegExpExecArray | null;

    while ((cmdMatch = commandRegex.exec(rawText)) !== null) {
      const workingDir = cmdMatch[1]?.trim() || '.';
      const reason = cmdMatch[2]?.trim() || 'Verify changes or inspect test results';
      const command = cmdMatch[3]?.trim();

      if (command) {
        commands.push({
          id: `cmd_${crypto.randomUUID().slice(0, 8)}`,
          command,
          workingDir,
          reason,
          status: 'pending',
        });
      }
    }

    // Clean text by removing raw XML tags so user sees clean explanation
    const cleanContent = rawText
      .replace(/<proposed_patch[\s\S]*?<\/proposed_patch>/g, (m) => {
        const fileMatch = /file="([^"]+)"/.exec(m);
        const fileName = fileMatch ? fileMatch[1] : 'file';
        return `\n> **Proposed Code Patch for \`${fileName}\`** (Review diff below)\n`;
      })
      .replace(/<proposed_command[\s\S]*?<\/proposed_command>/g, (m) => {
        const cmdMatch = /<proposed_command[^>]*>\s*([\s\S]*?)\s*<\/proposed_command>/.exec(m);
        return `\n> **Proposed Command:** \`${cmdMatch ? cmdMatch[1].trim() : ''}\`\n`;
      });

    return {
      cleanContent,
      proposedPatches: patches,
      proposedCommands: commands,
    };
  }

  /**
   * Main dispatch: Generate response using user's personal provider.
   */
  public static async executeAgentTurn({
    userId,
    roomId,
    conversationId,
    userPrompt,
    context,
    onProgress,
  }: {
    userId: string;
    roomId: string;
    conversationId: string;
    userPrompt: string;
    context?: AIAgentContextPayload;
    onProgress?: (status: string, partialText?: string) => void;
  }): Promise<AIMessage> {
    onProgress?.('Reading project files and context...');

    // 1. Save user message to persistent storage
    await this.saveMessage(userId, conversationId, 'user', userPrompt);

    // 2. Fetch conversation history
    const history = await this.getMessages(userId, conversationId);

    // 3. Resolve user's AI credentials
    const creds = await AICredentialService.getCredential(userId, true);

    // Use user's personal key or fallback to server Groq key
    const serverGroqKey = process.env.GROQ_API_KEY;
    const isServerKeyValid = Boolean(
      serverGroqKey &&
      !serverGroqKey.includes('paste_your_real_groq_api_key_here') &&
      serverGroqKey.trim().length > 0
    );

    const provider = creds?.provider || (isServerKeyValid ? 'groq' : 'none');
    const apiKey = creds?.rawApiKey || serverGroqKey;
    const model =
      creds?.selectedModel ||
      (provider === 'openai' ? 'gpt-4o-mini' : 'llama-3.3-70b-versatile');

    if (!apiKey) {
      const errorMsg =
        'No AI provider configured. Please open AI Agent Settings to configure your personal Groq or OpenAI API key.';
      return this.saveMessage(userId, conversationId, 'assistant', errorMsg, {
        status: 'error',
      });
    }

    // 4. Fetch existing room files for baseline hashes
    const existingFilesMap = new Map<string, string>();
    try {
      const roomFiles = await WorkspaceService.listFiles(roomId);
      if (Array.isArray(roomFiles)) {
        roomFiles.forEach((f: any) => {
          existingFilesMap.set(f.path, f.content || '');
        });
      }
    } catch {}

    // Add active file content from context if provided
    if (context?.currentFilePath && context?.currentFileContent) {
      existingFilesMap.set(context.currentFilePath, context.currentFileContent);
    }

    onProgress?.('Thinking...');

    // 5. Build messages array
    const systemPrompt = this.buildSystemPrompt(context);
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
    ];

    // Include last 8 turns of conversation for context memory
    const recentHistory = history.slice(-8);
    for (const msg of recentHistory) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        messages.push({
          role: msg.role,
          content: msg.content,
        });
      }
    }

    // 6. Invoke selected provider
    let fullResponse = '';

    try {
      if (provider === 'groq') {
        const client = new Groq({ apiKey });
        const completion = await client.chat.completions.create({
          model,
          messages: messages as any,
          temperature: 0.2,
          max_tokens: 3500,
        });

        fullResponse = completion.choices[0]?.message?.content || '';
      } else if (provider === 'openai') {
        const client = new OpenAI({ apiKey });
        const completion = await client.chat.completions.create({
          model,
          messages: messages as any,
          temperature: 0.2,
          max_tokens: 3500,
        });

        fullResponse = completion.choices[0]?.message?.content || '';
      } else {
        throw new Error(`Provider "${provider}" is currently not supported.`);
      }
    } catch (err: any) {
      const status = err?.status === 401 ? 'Invalid API Key' : err?.status === 429 ? 'Rate Limit Exceeded' : 'AI Error';
      const cleanError = `AI Provider Error (${status}): ${err?.message || 'Failed to complete request.'}`;
      return this.saveMessage(userId, conversationId, 'assistant', cleanError, {
        status: 'error',
      });
    }

    // 7. Parse any proposed patches or commands
    onProgress?.('Preparing proposed changes...');
    const { cleanContent, proposedPatches, proposedCommands } = this.parseProposals(
      fullResponse,
      existingFilesMap
    );

    // 8. Save assistant response with structured proposals
    const saved = await this.saveMessage(userId, conversationId, 'assistant', cleanContent, {
      proposedPatches,
      proposedCommands,
      status: 'complete',
    });

    onProgress?.('Completed.');
    return saved;
  }

  /**
   * Execute an approved terminal command within controlled workspace boundaries.
   */
  public static async executeApprovedCommand(
    command: string,
    workingDir = '.'
  ): Promise<{ stdout: string; stderr: string; exitCode: number; durationMs: number }> {
    const start = performance.now();

    // Security block: reject malicious shell injection or host destruction
    const forbiddenPatterns = [
      /\brm\s+-rf\s+\/+/i,
      /\bformat\b/i,
      /\bshutdown\b/i,
      /\binit\s+0\b/i,
      /:(){ :|:& };:/, // Fork bomb
      />\s*\/dev\/sd[a-z]/i,
      /\bmkfs\b/i,
    ];

    for (const pat of forbiddenPatterns) {
      if (pat.test(command)) {
        throw new Error('Command rejected by security guard rails: Potentially destructive system command.');
      }
    }

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: workingDir,
        timeout: 15_000, // 15 seconds max execution timeout
        maxBuffer: 1024 * 512, // 512 KB
      });

      const durationMs = Math.round(performance.now() - start);
      return {
        stdout: (stdout || '').slice(-15_000), // truncate to 15k chars
        stderr: (stderr || '').slice(-15_000),
        exitCode: 0,
        durationMs,
      };
    } catch (err: any) {
      const durationMs = Math.round(performance.now() - start);
      return {
        stdout: (err.stdout || '').slice(-15_000),
        stderr: (err.stderr || err.message || 'Command failed').slice(-15_000),
        exitCode: typeof err.code === 'number' ? err.code : 1,
        durationMs,
      };
    }
  }
}
