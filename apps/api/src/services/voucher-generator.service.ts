import { Injectable } from "@nestjs/common";
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";

export interface VoucherPdfData {
  voucherNo: string;
  brnCode: string;
  typeLabel: string; // "HOTEL VOUCHER" | "TRANSPORT VOUCHER" | "CATERING ORDER"
  groupCode: string;
  groupName: string;
  agentName: string;
  supplierName: string;
  pax: number;
  issueDate: Date;
  validUntil?: Date | null;
  details: Array<{ label: string; value: string }>;
}

const NAVY = rgb(0.043, 0.118, 0.247); // #0B1E3F
const GOLD = rgb(0.788, 0.635, 0.294); // #C9A24B
const INK = rgb(0.15, 0.17, 0.2);
const MUTED = rgb(0.45, 0.47, 0.5);

const fmt = (d: Date) =>
  d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

/** Standard PDF fonts are WinAnsi-only — swap common symbols, drop the rest. */
function winAnsiSafe(text: string): string {
  return text
    .replace(/→/g, "->")
    .replace(/[—–]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/···?|…/g, "...")
    .replace(/[^\x20-\x7E -ÿ]/g, "?");
}

/** Renders the TUBA AL HIJAZ service voucher as a single-page A4 PDF. */
@Injectable()
export class VoucherGeneratorService {
  async generate(raw: VoucherPdfData): Promise<Uint8Array> {
    // sanitize every drawable string for WinAnsi standard-font encoding
    const data: VoucherPdfData = {
      ...raw,
      groupName: winAnsiSafe(raw.groupName),
      agentName: winAnsiSafe(raw.agentName),
      supplierName: winAnsiSafe(raw.supplierName),
      details: raw.details.map((d) => ({ label: winAnsiSafe(d.label), value: winAnsiSafe(d.value) })),
    };
    const doc = await PDFDocument.create();
    doc.setTitle(`${data.typeLabel} ${data.voucherNo}`);
    doc.setAuthor("TUBA AL HIJAZ Ground Handling");
    const page = doc.addPage([595.28, 841.89]); // A4
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const { width, height } = page.getSize();

    // ── Header band ────────────────────────────────────────────────────────────
    page.drawRectangle({ x: 0, y: height - 110, width, height: 110, color: NAVY });
    page.drawText("TUBA AL HIJAZ", { x: 48, y: height - 52, size: 22, font: bold, color: rgb(1, 1, 1) });
    page.drawText("GROUND HANDLING · UMRAH & HAJJ OPERATIONS", {
      x: 48, y: height - 70, size: 8, font, color: GOLD,
    });
    page.drawText(data.typeLabel.toUpperCase(), {
      x: width - 48 - bold.widthOfTextAtSize(data.typeLabel.toUpperCase(), 16),
      y: height - 52, size: 16, font: bold, color: GOLD,
    });
    page.drawText(data.voucherNo, {
      x: width - 48 - font.widthOfTextAtSize(data.voucherNo, 10),
      y: height - 70, size: 10, font, color: rgb(1, 1, 1),
    });
    page.drawRectangle({ x: 0, y: height - 114, width, height: 4, color: GOLD });

    // ── Reference strip ────────────────────────────────────────────────────────
    let y = height - 150;
    const strip: Array<[string, string]> = [
      ["BRN", data.brnCode],
      ["GROUP", data.groupCode],
      ["ISSUED", fmt(data.issueDate)],
      ["VALID UNTIL", data.validUntil ? fmt(data.validUntil) : "—"],
    ];
    const colW = (width - 96) / strip.length;
    strip.forEach(([label, value], i) => {
      const x = 48 + i * colW;
      page.drawText(label, { x, y, size: 7, font: bold, color: MUTED });
      page.drawText(value, { x, y: y - 14, size: 11, font: bold, color: NAVY });
    });
    y -= 44;
    page.drawLine({ start: { x: 48, y }, end: { x: width - 48, y }, thickness: 0.75, color: GOLD });

    // ── Parties ────────────────────────────────────────────────────────────────
    y -= 26;
    this.kv(page, font, bold, 48, y, "TRAVEL AGENT", data.agentName);
    this.kv(page, font, bold, width / 2, y, "SERVICE PROVIDER", data.supplierName);
    y -= 40;
    this.kv(page, font, bold, 48, y, "GROUP NAME", data.groupName);
    this.kv(page, font, bold, width / 2, y, "PILGRIMS", `${data.pax} persons`);

    // ── Detail table ───────────────────────────────────────────────────────────
    y -= 44;
    page.drawText("SERVICE DETAILS", { x: 48, y, size: 8, font: bold, color: GOLD });
    y -= 10;
    for (const row of data.details) {
      y -= 22;
      page.drawRectangle({ x: 48, y: y - 6, width: width - 96, height: 22, color: rgb(0.97, 0.965, 0.95) });
      page.drawText(row.label, { x: 56, y, size: 9, font: bold, color: MUTED });
      const v = row.value.length > 70 ? `${row.value.slice(0, 67)}…` : row.value;
      page.drawText(v, { x: 230, y, size: 9, font, color: INK });
    }

    // ── Terms ──────────────────────────────────────────────────────────────────
    y -= 46;
    page.drawText("TERMS & INSTRUCTIONS", { x: 48, y, size: 8, font: bold, color: GOLD });
    const terms =
      "Present this voucher at check-in / boarding. Valid only for the group and dates stated above. " +
      "Any amendment must be authorized by TUBA AL HIJAZ operations. This voucher is generated " +
      "electronically against the referenced BRN and is valid without a physical stamp.";
    y -= 16;
    for (const line of this.wrap(terms, font, 8.5, width - 96)) {
      page.drawText(line, { x: 48, y, size: 8.5, font, color: MUTED });
      y -= 12;
    }

    // ── Signatures ─────────────────────────────────────────────────────────────
    const sigY = 140;
    for (const [i, label] of ["Operations Manager", "Authorized Signatory"].entries()) {
      const x = i === 0 ? 48 : width / 2 + 24;
      page.drawLine({ start: { x, y: sigY }, end: { x: x + 180, y: sigY }, thickness: 0.75, color: MUTED });
      page.drawText(label, { x, y: sigY - 14, size: 8, font, color: MUTED });
    }

    // ── Footer ─────────────────────────────────────────────────────────────────
    page.drawRectangle({ x: 0, y: 0, width, height: 56, color: NAVY });
    page.drawText(`${data.voucherNo} · TUBA-1446H`, { x: 48, y: 24, size: 8, font, color: GOLD });
    const contact = "operations@tubalhijaz.com · +966 12 XXX XXXX · Makkah Al-Mukarramah, KSA";
    page.drawText(contact, {
      x: width - 48 - font.widthOfTextAtSize(contact, 8),
      y: 24, size: 8, font, color: rgb(1, 1, 1),
    });

    return doc.save();
  }

  private kv(page: PDFPage, font: PDFFont, bold: PDFFont, x: number, y: number, label: string, value: string) {
    page.drawText(label, { x, y, size: 7, font: bold, color: MUTED });
    const v = value.length > 45 ? `${value.slice(0, 42)}…` : value;
    page.drawText(v, { x, y: y - 14, size: 11, font: bold, color: INK });
  }

  private wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
    const words = text.split(" ");
    const lines: string[] = [];
    let line = "";
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(test, size) > maxWidth) {
        if (line) lines.push(line);
        line = w;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  }
}
