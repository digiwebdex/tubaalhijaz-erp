import { Injectable, Logger } from "@nestjs/common";
import type { ImageAnnotatorClient, protos } from "@google-cloud/vision";

type AnnotateResponse = protos.google.cloud.vision.v1.IAnnotateImageResponse;

export interface OcrWord {
  text: string;
  confidence: number;
}
export interface OcrResult {
  fullText: string;
  words: OcrWord[];
  meanConfidence: number;
  provider: string;
  /**
   * Optional structured fields read directly from the document's printed visual
   * zone by a provider that supports it (the Gemini passport path). Keys mirror
   * the canonical extraction keys (name, passportNo, nationality, dob, sex,
   * passportExpiry, issuingCountry, personalNumber). Used as a fallback source
   * of passenger data when the MRZ cannot be parsed (e.g. some e-passports),
   * so the reviewer still gets pre-filled fields instead of bare raw text.
   * Providers that only transcribe (Vision) leave this undefined.
   */
  structured?: Record<string, string | null>;
}

/** Options common to every OCR provider (Vision ignores the extra fields). */
export interface AnnotateOpts {
  dense?: boolean;
  mimeType?: string;
  documentType?: string;
}

/** Contract both VisionClient and GeminiClient satisfy. */
export interface OcrProvider {
  readonly configured: boolean;
  annotate(image: Buffer, opts?: AnnotateOpts): Promise<OcrResult>;
}

/**
 * Thin wrapper over Google Cloud Vision. The client is constructed lazily so the
 * API still boots when the key or billing isn't wired yet — OCR calls then fail
 * with a clear error instead of crashing startup. Credentials resolve from
 * GOOGLE_APPLICATION_CREDENTIALS (the mounted service-account key).
 */
@Injectable()
export class VisionClient implements OcrProvider {
  private readonly log = new Logger("VisionClient");
  private client?: ImageAnnotatorClient;

  /** True when a credentials path is configured. */
  get configured(): boolean {
    return Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS);
  }

  private async getClient(): Promise<ImageAnnotatorClient> {
    if (this.client) return this.client;
    const mod = await import("@google-cloud/vision");
    this.client = new mod.ImageAnnotatorClient();
    this.log.log("Google Vision client initialised");
    return this.client;
  }

  /**
   * Detect text. `dense` uses documentTextDetection (better for passports/MRZ
   * and dense scans); otherwise textDetection. Returns normalised full text plus
   * per-word confidence.
   */
  async annotate(image: Buffer, opts: AnnotateOpts = {}): Promise<OcrResult> {
    const client = await this.getClient();
    const request = { image: { content: image } };
    const result = opts.dense
      ? await client.documentTextDetection(request)
      : await client.textDetection(request);
    const res: AnnotateResponse = result[0];
    if (res.error?.message) throw new Error(`Vision API error: ${res.error.message}`);
    const fullText =
      res.fullTextAnnotation?.text ?? res.textAnnotations?.[0]?.description ?? "";
    const words = collectWords(res);
    const meanConfidence = words.length
      ? words.reduce((sum, w) => sum + w.confidence, 0) / words.length
      : 0;
    return { fullText, words, meanConfidence, provider: "google-vision" };
  }
}

function collectWords(res: AnnotateResponse): OcrWord[] {
  const out: OcrWord[] = [];
  for (const page of res.fullTextAnnotation?.pages ?? [])
    for (const block of page.blocks ?? [])
      for (const para of block.paragraphs ?? [])
        for (const word of para.words ?? []) {
          const text = (word.symbols ?? []).map((s) => s.text ?? "").join("");
          out.push({ text, confidence: word.confidence ?? 0 });
        }
  return out;
}
