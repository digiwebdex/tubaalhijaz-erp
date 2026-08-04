import { Injectable } from "@nestjs/common";
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";

const NAVY = rgb(0.043, 0.118, 0.247);
const GREEN = rgb(0.086, 0.639, 0.29); // #16A34A
const GOLD = rgb(0.788, 0.635, 0.294);
const INK = rgb(0.15, 0.17, 0.2);
const MUTED = rgb(0.45, 0.47, 0.5);

const fmtDate = (d: Date) =>
  d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
const sar = (n: number) => `SAR ${n.toLocaleString("en-US")}`;

/** Standard PDF fonts are WinAnsi-only — swap symbols we use, strip the rest. */
function safe(t: string): string {
  return t
    .replace(/→/g, "->").replace(/[—–]/g, "-").replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'").replace(/…/g, "...").replace(/[^\x20-\x7E -ÿ]/g, "?");
}

export interface InvoiceDocData {
  docNo: string;
  issueDate: Date;
  dueDate?: Date | null;
  billTo: string;
  billToAddr?: string;
  groupCode?: string | null;
  items: Array<{ desc: string; qty: number; unit: number; total: number }>;
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  total: number;
}

@Injectable()
export class FinanceDocService {
  async invoicePdf(data: InvoiceDocData): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    doc.setTitle(`Invoice ${data.docNo}`);
    doc.setAuthor("TUBA AL HIJAZ Finance");
    const page = doc.addPage([595.28, 841.89]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const { width, height } = page.getSize();

    // header
    page.drawRectangle({ x: 0, y: height - 108, width, height: 108, color: NAVY });
    page.drawText("TUBA AL HIJAZ", { x: 48, y: height - 50, size: 22, font: bold, color: rgb(1, 1, 1) });
    page.drawText("ENTERPRISE GROUND HANDLING - FINANCIAL SERVICES", { x: 48, y: height - 68, size: 8, font, color: GOLD });
    // A ZATCA tax invoice must carry the issuer's real VAT registration number.
    // This was hardcoded to the placeholder "310-XXX-XXXX", which would have gone
    // out on every real invoice. Sourced from env so it is set once on the VPS;
    // when unset the line omits the VAT claim entirely rather than printing a
    // fake registration number.
    const issuerAddr = process.env.COMPANY_ADDRESS ?? "Makkah Al-Mukarramah, KSA";
    const vatReg = process.env.COMPANY_VAT_NUMBER?.trim();
    page.drawText(vatReg ? `${issuerAddr} - VAT Reg: ${vatReg}` : issuerAddr, { x: 48, y: height - 82, size: 7.5, font, color: rgb(0.8, 0.8, 0.85) });
    const label = "TAX INVOICE";
    page.drawText(label, { x: width - 48 - bold.widthOfTextAtSize(label, 14), y: height - 50, size: 14, font: bold, color: GOLD });
    page.drawText(data.docNo, { x: width - 48 - bold.widthOfTextAtSize(data.docNo, 12), y: height - 68, size: 12, font: bold, color: rgb(1, 1, 1) });
    page.drawText(`Date: ${fmtDate(data.issueDate)}`, { x: width - 48 - font.widthOfTextAtSize(`Date: ${fmtDate(data.issueDate)}`, 9), y: height - 84, size: 9, font, color: rgb(0.8, 0.8, 0.85) });
    page.drawRectangle({ x: 0, y: height - 112, width, height: 4, color: GOLD });

    // parties
    let y = height - 148;
    page.drawText("BILL TO", { x: 48, y, size: 8, font: bold, color: MUTED });
    page.drawText(safe(data.billTo), { x: 48, y: y - 15, size: 12, font: bold, color: INK });
    if (data.billToAddr) page.drawText(safe(data.billToAddr), { x: 48, y: y - 30, size: 9, font, color: MUTED });
    if (data.groupCode) page.drawText(`Group: ${data.groupCode}`, { x: 48, y: y - 43, size: 9, font, color: MUTED });
    page.drawText("PAYMENT TERMS", { x: width / 2 + 20, y, size: 8, font: bold, color: MUTED });
    page.drawText(data.dueDate ? `Net - due ${fmtDate(data.dueDate)}` : "Due on receipt", { x: width / 2 + 20, y: y - 15, size: 11, font: bold, color: INK });
    // Never print a fabricated IBAN. Set COMPANY_BANK_LINE in API env for the real
    // settlement line; when unset, omit the bank line entirely.
    const bankLine = process.env.COMPANY_BANK_LINE?.trim();
    if (bankLine) {
      page.drawText(bankLine, { x: width / 2 + 20, y: y - 30, size: 8, font, color: MUTED });
    }

    // items table
    y -= 74;
    page.drawRectangle({ x: 48, y: y - 4, width: width - 96, height: 20, color: rgb(0.95, 0.95, 0.93) });
    page.drawText("DESCRIPTION", { x: 54, y, size: 8, font: bold, color: MUTED });
    page.drawText("QTY", { x: 350, y, size: 8, font: bold, color: MUTED });
    page.drawText("UNIT", { x: 410, y, size: 8, font: bold, color: MUTED });
    page.drawText("TOTAL", { x: width - 54 - bold.widthOfTextAtSize("TOTAL", 8), y, size: 8, font: bold, color: MUTED });
    y -= 22;
    for (const it of data.items) {
      const desc = safe(it.desc);
      const clipped = desc.length > 52 ? `${desc.slice(0, 49)}...` : desc;
      page.drawText(clipped, { x: 54, y, size: 9, font, color: INK });
      page.drawText(String(it.qty), { x: 350, y, size: 9, font, color: INK });
      page.drawText(sar(it.unit), { x: 410, y, size: 9, font, color: INK });
      const t = sar(it.total);
      page.drawText(t, { x: width - 54 - font.widthOfTextAtSize(t, 9), y, size: 9, font, color: INK });
      y -= 20;
      page.drawLine({ start: { x: 48, y: y + 6 }, end: { x: width - 48, y: y + 6 }, thickness: 0.5, color: rgb(0.9, 0.9, 0.9) });
    }

    // totals
    y -= 8;
    const totalsX = width - 240;
    const drawTotal = (l: string, v: string, bg = false, big = false) => {
      if (bg) page.drawRectangle({ x: totalsX - 10, y: y - 6, width: 202, height: 22, color: GREEN });
      page.drawText(l, { x: totalsX, y, size: big ? 11 : 9, font: bold, color: bg ? rgb(1, 1, 1) : MUTED });
      page.drawText(v, { x: width - 54 - bold.widthOfTextAtSize(v, big ? 11 : 9), y, size: big ? 11 : 9, font: bold, color: bg ? rgb(1, 1, 1) : INK });
      y -= big ? 26 : 18;
    };
    drawTotal("Subtotal", sar(data.subtotal));
    drawTotal(`VAT ${data.vatRate}%`, sar(data.vatAmount));
    drawTotal("TOTAL DUE", sar(data.total), true, true);

    // footer
    page.drawRectangle({ x: 0, y: 0, width, height: 48, color: NAVY });
    page.drawText(`${data.docNo} - TUBA-FIN-1446H`, { x: 48, y: 20, size: 8, font, color: GOLD });
    // Same policy as VAT: real phone from env only — never "XXX" placeholders on live PDFs.
    const financeEmail = process.env.COMPANY_FINANCE_EMAIL?.trim() || "finance@tubalhijaz.com";
    const financePhone = process.env.COMPANY_PHONE?.trim();
    const contact = financePhone ? `${financeEmail} - ${financePhone}` : financeEmail;
    page.drawText(contact, { x: width - 48 - font.widthOfTextAtSize(contact, 8), y: 20, size: 8, font, color: rgb(1, 1, 1) });

    return doc.save();
  }
}
