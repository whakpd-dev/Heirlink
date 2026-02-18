import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosRequestConfig } from 'axios';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { Response } from 'express';

const XAI_BASE = 'https://api.x.ai/v1';
const XAI_API_URL = `${XAI_BASE}/chat/completions`;
const XAI_IMAGE_URL = `${XAI_BASE}/images/generations`;
const XAI_VIDEO_URL = `${XAI_BASE}/videos/generations`;
const XAI_VIDEO_EDIT_URL = `${XAI_BASE}/videos/edits`;
const XAI_VIDEO_RESULT_URL = `${XAI_BASE}/videos`; // + /{request_id}

const DEFAULT_MODEL = 'grok-4-latest';
const IMAGE_MODEL = 'grok-imagine-image';
const VIDEO_MODEL = 'grok-imagine-video';

type MessageContent =
  | string
  | Array<
      | { type: 'text'; text: string }
      | { type: 'image_url'; image_url: { url: string; detail?: string } }
    >;

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: MessageContent;
}

@Injectable()
export class AiService {
  constructor(private readonly config: ConfigService) {}

  private getApiKey(): string {
    const apiKey = this.config.get<string>('XAI_API_KEY');
    if (!apiKey?.trim()) {
      throw new BadRequestException('AI service is not configured (XAI_API_KEY)');
    }
    return apiKey.trim();
  }

  private getProxyConfig(): AxiosRequestConfig {
    const proxyUrl =
      this.config.get<string>('XAI_PROXY_URL') ||
      this.config.get<string>('HTTPS_PROXY') ||
      this.config.get<string>('HTTP_PROXY');
    if (!proxyUrl?.trim()) return {};
    const normalized = proxyUrl.trim();
    if (
      normalized.startsWith('socks5://') ||
      normalized.startsWith('socks5h://') ||
      normalized.startsWith('socks4://')
    ) {
      const agent = new SocksProxyAgent(normalized);
      return { proxy: false, httpAgent: agent, httpsAgent: agent };
    }
    const agent = new HttpsProxyAgent(normalized);
    return { proxy: false, httpAgent: agent, httpsAgent: agent };
  }

  /** Download an image and convert to base64 data URI.
   *  This ensures xAI can always read the image (even from private servers). */
  private async imageUrlToDataUri(imageUrl: string): Promise<string> {
    // Already a data URI — return as-is
    if (imageUrl.startsWith('data:')) return imageUrl;

    try {
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 30000,
      });
      const contentType = response.headers['content-type'] || 'image/jpeg';
      const base64 = Buffer.from(response.data).toString('base64');
      return `data:${contentType};base64,${base64}`;
    } catch (error: any) {
      console.error('[AiService] Failed to download image for base64:', imageUrl, error?.message);
      // Fallback: return original URL, xAI might be able to fetch it
      return imageUrl;
    }
  }

  /** Non-streaming completion — returns full response at once */
  async chatCompletion(
    messages: ChatMessage[],
    options?: { model?: string; temperature?: number },
  ) {
    const apiKey = this.getApiKey();
    if (!messages?.length) {
      throw new BadRequestException('messages array is required');
    }

    const model = options?.model ?? DEFAULT_MODEL;
    const temperature = options?.temperature ?? 0.7;
    const proxyConfig = this.getProxyConfig();

    try {
      const response = await axios.post(
        XAI_API_URL,
        { messages, model, stream: false, temperature },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          ...proxyConfig,
        },
      );
      return response.data as {
        choices?: Array<{ message?: { role: string; content: string } }>;
        usage?: unknown;
      };
    } catch (error: any) {
      const status = error?.response?.status;
      const statusText = error?.response?.statusText;
      const data = error?.response?.data;
      const text = typeof data === 'string' ? data : JSON.stringify(data ?? {});
      const errMsg = error?.message ?? 'unknown';
      console.error('[AiService] xAI request failed:', {
        status,
        statusText,
        text: text.slice(0, 300),
        errMsg,
      });
      throw new BadRequestException(
        `xAI API error: ${status ?? 'unknown'} ${statusText ?? ''} - ${text.slice(0, 200)}`,
      );
    }
  }

  /** Streaming completion — pipes SSE chunks to Express response */
  async chatCompletionStream(
    messages: ChatMessage[],
    res: Response,
    options?: { model?: string; temperature?: number },
  ) {
    const apiKey = this.getApiKey();
    if (!messages?.length) {
      throw new BadRequestException('messages array is required');
    }

    const model = options?.model ?? DEFAULT_MODEL;
    const temperature = options?.temperature ?? 0.7;
    const proxyConfig = this.getProxyConfig();

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // nginx
    res.flushHeaders();

    try {
      const response = await axios.post(
        XAI_API_URL,
        { messages, model, stream: true, temperature },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          responseType: 'stream',
          ...proxyConfig,
        },
      );

      const stream = response.data;
      let buffer = '';

      stream.on('data', (chunk: Buffer) => {
        buffer += chunk.toString();
        // Process complete SSE lines
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? ''; // keep incomplete line

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          const payload = trimmed.slice(6);
          if (payload === '[DONE]') {
            res.write('data: [DONE]\n\n');
            continue;
          }
          try {
            const parsed = JSON.parse(payload);
            const delta = parsed?.choices?.[0]?.delta;
            if (delta?.content) {
              res.write(`data: ${JSON.stringify({ content: delta.content })}\n\n`);
            }
          } catch {
            // skip malformed chunks
          }
        }
      });

      stream.on('end', () => {
        // Process any remaining buffer
        if (buffer.trim()) {
          const trimmed = buffer.trim();
          if (trimmed.startsWith('data: ')) {
            const payload = trimmed.slice(6);
            if (payload === '[DONE]') {
              res.write('data: [DONE]\n\n');
            } else {
              try {
                const parsed = JSON.parse(payload);
                const delta = parsed?.choices?.[0]?.delta;
                if (delta?.content) {
                  res.write(`data: ${JSON.stringify({ content: delta.content })}\n\n`);
                }
              } catch {
                // skip
              }
            }
          }
        }
        res.write('data: [DONE]\n\n');
        res.end();
      });

      stream.on('error', (err: Error) => {
        console.error('[AiService] Stream error:', err.message);
        res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
      });

      // Handle client disconnect
      res.on('close', () => {
        stream.destroy();
      });
    } catch (error: any) {
      const status = error?.response?.status;
      const data = error?.response?.data;
      const text = typeof data === 'string' ? data : JSON.stringify(data ?? {});
      console.error('[AiService] Stream request failed:', { status, text: text?.slice?.(0, 300) });
      res.write(`data: ${JSON.stringify({ error: `xAI error: ${status ?? 'unknown'} - ${(text ?? '').slice(0, 200)}` })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    }
  }

  /* ─── Image Generation ─── */

  private handleXaiError(error: any, context: string): never {
    const status = error?.response?.status;
    const data = error?.response?.data;
    const text = typeof data === 'string' ? data : JSON.stringify(data ?? {});
    console.error(`[AiService] ${context} failed:`, { status, text: text?.slice?.(0, 300) });
    throw new BadRequestException(
      `xAI ${context} error: ${status ?? 'unknown'} - ${(text ?? '').slice(0, 200)}`,
    );
  }

  /** Generate an image from text prompt */
  async generateImage(
    prompt: string,
    options?: { model?: string; n?: number; aspect_ratio?: string; response_format?: string },
  ): Promise<{ url: string }[]> {
    const apiKey = this.getApiKey();
    const proxyConfig = this.getProxyConfig();

    try {
      const response = await axios.post(
        XAI_IMAGE_URL,
        {
          prompt,
          model: options?.model ?? IMAGE_MODEL,
          n: options?.n ?? 1,
          ...(options?.aspect_ratio && { aspect_ratio: options.aspect_ratio }),
          response_format: options?.response_format ?? 'url',
        },
        {
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          ...proxyConfig,
        },
      );
      const data = response.data?.data ?? [];
      return data.map((d: any) => ({ url: d.url ?? d.b64_json }));
    } catch (error) {
      this.handleXaiError(error, 'Image generation');
    }
  }

  /** Edit / style-transfer an existing image.
   *  Uses the SAME /images/generations endpoint with image_url parameter (per xAI docs). */
  async editImage(
    prompt: string,
    imageUrl: string,
    options?: { model?: string; n?: number; aspect_ratio?: string },
  ): Promise<{ url: string }[]> {
    const apiKey = this.getApiKey();
    const proxyConfig = this.getProxyConfig();

    // Convert image to base64 data URI so xAI can always access it
    const dataUri = await this.imageUrlToDataUri(imageUrl);

    console.log('[AiService] Image edit — prompt:', prompt.slice(0, 100), 'image_url length:', dataUri.length);

    try {
      const response = await axios.post(
        XAI_IMAGE_URL, // Same endpoint as generation, with image_url for editing
        {
          prompt,
          model: options?.model ?? IMAGE_MODEL,
          image_url: dataUri,
          n: options?.n ?? 1,
          ...(options?.aspect_ratio && { aspect_ratio: options.aspect_ratio }),
        },
        {
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          ...proxyConfig,
          timeout: 120000,
        },
      );
      const data = response.data?.data ?? [];
      return data.map((d: any) => ({ url: d.url ?? d.b64_json }));
    } catch (error) {
      this.handleXaiError(error, 'Image edit');
    }
  }

  /* ─── Video Generation ─── */

  /** Start video generation (deferred — returns request_id) */
  async generateVideo(
    prompt: string,
    options?: {
      model?: string;
      image_url?: string;
      video_url?: string;
      duration?: number;
      aspect_ratio?: string;
      resolution?: string;
    },
  ): Promise<{ request_id: string }> {
    const apiKey = this.getApiKey();
    const proxyConfig = this.getProxyConfig();

    const isEdit = !!options?.video_url;
    const url = isEdit ? XAI_VIDEO_EDIT_URL : XAI_VIDEO_URL;

    // Convert image to base64 data URI so xAI can always access it
    let imageDataUri: string | undefined;
    if (options?.image_url) {
      imageDataUri = await this.imageUrlToDataUri(options.image_url);
      console.log('[AiService] Video gen with image — data URI length:', imageDataUri.length);
    }

    console.log('[AiService] Video gen — prompt:', prompt.slice(0, 100), 'hasImage:', !!imageDataUri);

    try {
      const response = await axios.post(
        url,
        {
          prompt,
          model: options?.model ?? VIDEO_MODEL,
          ...(imageDataUri && { image_url: imageDataUri }),
          ...(options?.video_url && { video_url: options.video_url }),
          ...(options?.duration && { duration: options.duration }),
          ...(options?.aspect_ratio && { aspect_ratio: options.aspect_ratio }),
          ...(options?.resolution && { resolution: options.resolution }),
        },
        {
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          ...proxyConfig,
          timeout: 60000,
        },
      );
      return { request_id: response.data?.request_id };
    } catch (error) {
      this.handleXaiError(error, 'Video generation');
    }
  }

  /** Poll video generation result.
   *  xAI returns: { video: { url, duration, respect_moderation }, model } when ready,
   *  or { status: "pending"|"in_progress" } / error when not ready. */
  async getVideoResult(
    requestId: string,
  ): Promise<{ status: string; url?: string; duration?: number; error?: string }> {
    const apiKey = this.getApiKey();
    const proxyConfig = this.getProxyConfig();

    try {
      const response = await axios.get(`${XAI_VIDEO_RESULT_URL}/${requestId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        ...proxyConfig,
      });
      const d = response.data;
      console.log('[AiService] Video poll response:', JSON.stringify(d).slice(0, 500));

      // xAI returns { video: { url, duration } } when complete
      if (d?.video?.url) {
        return {
          status: 'completed',
          url: d.video.url,
          duration: d.video.duration,
        };
      }
      // Or it may return a top-level status
      if (d?.status === 'completed' && d?.url) {
        return { status: 'completed', url: d.url, duration: d.duration };
      }
      // Otherwise still pending/processing
      return {
        status: d?.status ?? 'pending',
        error: d?.error,
      };
    } catch (error) {
      this.handleXaiError(error, 'Video result');
    }
  }
}
