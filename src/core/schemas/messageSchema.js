import { z } from 'zod';

/**
 * @description The single source of truth for all communication within Paser Mini.
 * This schema defines the structure for every interaction: user input, agent responses, 
 * system notifications, internal thoughts, and technical tool executions.
 */
export const MessageSchema = z.object({
  /** Unique identifier for the message */
  id: z.string(),
  /** ISO 8601 timestamp */
  timestamp: z.string(),
  /** 
   * The role of the sender. 
   * 'user': Human input.
   * 'agent': AI response.
   * 'system': System notifications or instructions.
   * 'thought': Internal reasoning (to be filtered in UI, but logged).
   * 'tool': Technical tool execution details (to be filtered in UI, but logged).
   */
  role: z.enum(['user', 'agent', 'system', 'thought', 'tool']),
  /** The nickname used at the time of the message (supports dynamic identity) */
  nickname: z.string(),
  /** The primary text content of the message */
  content: z.string(),
  /** 
   * Metadata for technical payloads. 
   * Used by the engine and parser to avoid string-parsing overhead.
   */
  metadata: z.object({
    /** If role is 'tool', contains the tool call details */
    tool_call: z.object({
      id: z.string(),
      name: z.string(),
      args: z.record(z.any()),
    }).optional(),
    /** If role is 'tool', contains the execution result */
    tool_response: z.object({
      id: z.string(),
      status: z.enum(['OK', 'ERR']),
      result: z.any().optional(),
    }).optional(),
    /** Flag to explicitly mark content as 'noise' for the renderer */
    is_noise: z.boolean().optional(),
  }).optional(),
});

export type Message = z.infer<typeof MessageSchema>;
