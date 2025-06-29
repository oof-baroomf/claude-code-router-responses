import { Response } from "express";
import { OpenAI } from "openai";
import { log } from "./log";

interface ContentBlock {
  type: string;
  id?: string;
  name?: string;
  input?: any;
  text?: string;
}

interface MessageEvent {
  type: string;
  message?: {
    id: string;
    type: string;
    role: string;
    content: any[];
    model: string;
    stop_reason: string | null;
    stop_sequence: string | null;
    usage: {
      input_tokens: number;
      output_tokens: number;
    };
  };
  delta?: {
    stop_reason?: string;
    stop_sequence?: string | null;
    content?: ContentBlock[];
    type?: string;
    text?: string;
    partial_json?: string;
  };
  index?: number;
  content_block?: ContentBlock;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
}

export async function streamOpenAIResponse(
  res: Response,
  stream: any, // The stream from openai.responses.create
  model: string,
  body: any
) {
  const write = (data: string) => {
    log("response: ", data);
    res.write(data);
  };

  const messageId = `msg_${Date.now()}`;
  const contentBlockId = `content-block-${Date.now()}`;
  let hasTextBlockStarted = false;
  let stopReason = "end_turn"; // Default stop reason

  try {
    // 1. Send message_start event
    const messageStart: MessageEvent = {
      type: "message_start",
      message: {
        id: messageId,
        type: "message",
        role: "assistant",
        content: [],
        model,
        stop_reason: null,
        stop_sequence: null,
        usage: { input_tokens: 1, output_tokens: 1 }, // Dummy usage
      },
    };
    write(`event: message_start\ndata: ${JSON.stringify(messageStart)}\n\n`);

    for await (const event of stream) {
      switch (event.type) {
        case 'response.output_text.delta':
          if (!hasTextBlockStarted) {
            // 2. Send content_block_start for the first text delta
            const textBlockStart = {
              type: 'content_block_start',
              index: 0,
              content_block: { type: 'text', id: contentBlockId, text: '' },
            };
            write(`event: content_block_start\ndata: ${JSON.stringify(textBlockStart)}\n\n`);
            hasTextBlockStarted = true;
          }
          // 3. Send content_block_delta for each text chunk
          const contentDelta = {
            type: 'content_block_delta',
            index: 0,
            delta: { type: 'text_delta', text: event.delta },
          };
          write(`event: content_block_delta\ndata: ${JSON.stringify(contentDelta)}\n\n`);
          break;

        case 'response.tool_call.done':
          // If we ever support tool calls, this is where we'd update the stop_reason
          stopReason = "tool_use";
          break;

        case 'response.done':
          if (hasTextBlockStarted) {
            // 4. Send content_block_stop if a text block was started
            const contentBlockStop = {
              type: 'content_block_stop',
              index: 0,
            };
            write(`event: content_block_stop\ndata: ${JSON.stringify(contentBlockStop)}\n\n`);
          }
          // 5. Send message_delta with the final stop_reason
          const messageDelta = {
            type: 'message_delta',
            delta: {
              stop_reason: stopReason,
              stop_sequence: null,
            },
            usage: { output_tokens: 1 }, // Dummy usage
          };
          write(`event: message_delta\ndata: ${JSON.stringify(messageDelta)}\n\n`);
          break;

        case 'response.error':
          log('Stream error:', event.error);
          const errorJson = JSON.stringify({ type: 'error', error: { type: 'api_error', message: event.error.message } });
          write(`event: error\ndata: ${errorJson}\n\n`);
          break;
      }
    }
  } catch (e: any) {
    log("Error in stream processing:", e);
    const errorJson = JSON.stringify({ type: 'error', error: { type: 'internal_server_error', message: e.message } });
    write(`event: error\ndata: ${errorJson}\n\n`);
  } finally {
    // 6. Send message_stop event
    const messageStop: MessageEvent = {
      type: "message_stop",
    };
    write(`event: message_stop\ndata: ${JSON.stringify(messageStop)}\n\n`);
    res.end();
  }
}
