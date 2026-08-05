// @ts-ignore - pdfkit types
import PDFDocument from "pdfkit";

export interface LetterData {
  letterNumber: string;
  borrowerName: string;
  loanAmount: string;
  productType: string;
  occupancy: string;
  loanPurpose?: string;
  companyLegalName: string;
  companyNmlsId: string;
  companyContactInfo?: string;
  loanOfficerName?: string;
  loanOfficerNmlsId?: string;
  expirationDate: Date;
  generatedAt: Date;
  conditions: string[];
  disclaimers: string[];
  watermarkApplied: boolean;
  purchasePrice?: string;
  downPayment?: string;
  downPaymentPercent?: string;
  annualIncome?: string;
  monthlyPaymentEstimate?: string;
  estimatedDti?: string;
  creditScoreRange?: string;
  employmentType?: string;
  propertyType?: string;
  propertyState?: string;
  incomeSources?: Array<{ type: string; annualAmount: string; rentalProperties?: Array<{ address: string; monthlyRentalIncome: string; monthlyDebtPayment?: string }> }>;
}

// The standing conditions block on every pre-approval letter. Shared by issuance
// and regeneration so the two renders cannot diverge.
export const STANDARD_PRE_APPROVAL_CONDITIONS = [
  "Satisfactory property appraisal",
  "Verification of employment and income",
  "Clear title search and title insurance",
  "Property insurance in effect prior to closing",
  "No material change in financial condition",
] as const;

/** The pre_approval_letters columns a regeneration render is allowed to read. */
export interface StoredPreApprovalLetter {
  letterNumber: string;
  borrowerName: string;
  loanAmount: string;
  productType: string;
  occupancy: string;
  loanPurpose: string | null;
  companyLegalName: string;
  companyNmlsId: string;
  companyContactInfo: string | null;
  expirationDate: Date | string;
  generatedAt: Date | string | null;
  createdAt: Date | string | null;
  watermarkApplied: boolean | null;
}

// Regeneration input built strictly from the stored letter row. A pre-approval
// letter is an issued record: when its stored PDF is unavailable it must be
// re-rendered from what was issued — never recomputed from the application's
// current figures or today's advertised rate, which would put different terms
// under the original letter number and issuance date. Fields the row does not
// carry (income/DTI/credit detail) are omitted: an honest gap, not a live
// recomputation. Empty disclaimers fall back to the standard five inside
// generatePreApprovalPDF.
export function letterDataFromStoredRow(letter: StoredPreApprovalLetter): LetterData {
  return {
    letterNumber: letter.letterNumber,
    borrowerName: letter.borrowerName,
    loanAmount: letter.loanAmount,
    productType: letter.productType,
    occupancy: letter.occupancy,
    loanPurpose: letter.loanPurpose || undefined,
    companyLegalName: letter.companyLegalName,
    companyNmlsId: letter.companyNmlsId,
    companyContactInfo: letter.companyContactInfo || undefined,
    expirationDate: new Date(letter.expirationDate),
    generatedAt: new Date((letter.generatedAt ?? letter.createdAt)!),
    conditions: [...STANDARD_PRE_APPROVAL_CONDITIONS],
    disclaimers: [],
    watermarkApplied: letter.watermarkApplied ?? true,
  };
}

const DEEP_NAVY = "#0f1729";
const EMERALD = "#15803d";
const GRAY_600 = "#475569";
const GRAY_400 = "#94a3b8";
const BORDER_COLOR = "#e2e8f0";

export function generatePreApprovalPDF(data: LetterData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "LETTER",
      margins: { top: 60, bottom: 60, left: 60, right: 60 },
      info: {
        Title: `Pre-Approval Letter ${data.letterNumber}`,
        Author: data.companyLegalName,
        Subject: "Mortgage Pre-Approval",
      },
    });

    const chunks: Uint8Array[] = [];
    doc.on("data", (chunk: Uint8Array) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    if (data.watermarkApplied) {
      doc.save();
      doc.rotate(-45, { origin: [306, 396] });
      doc.fontSize(54).fillColor("#e2e8f0").opacity(0.3);
      doc.text("PRE-APPROVAL", 60, 360, { align: "center", width: pageWidth });
      doc.restore();
      doc.opacity(1);
    }

    doc.rect(doc.page.margins.left, doc.page.margins.top, pageWidth, 80).fill(DEEP_NAVY);
    doc.fontSize(22).fillColor("#ffffff");
    doc.text("HOMIQUITY", doc.page.margins.left + 20, doc.page.margins.top + 18, { width: pageWidth - 40 });
    doc.fontSize(10).fillColor("#94a3b8");
    doc.text("Clarity for Every Stage of Homeownership", doc.page.margins.left + 20, doc.page.margins.top + 48, { width: pageWidth - 40 });
    doc.fontSize(9).fillColor("#94a3b8");
    doc.text(`NMLS #${data.companyNmlsId}`, doc.page.margins.left + 20, doc.page.margins.top + 62, {
      width: pageWidth - 40,
      align: "right",
    });

    let y = doc.page.margins.top + 100;

    doc.fontSize(16).fillColor(DEEP_NAVY);
    doc.text("PRE-APPROVAL LETTER", doc.page.margins.left, y, { align: "center", width: pageWidth });
    y += 30;

    doc.moveTo(doc.page.margins.left, y).lineTo(doc.page.margins.left + pageWidth, y).stroke(BORDER_COLOR);
    y += 16;

    const leftCol = doc.page.margins.left;
    const rightCol = doc.page.margins.left + pageWidth / 2;

    doc.fontSize(8).fillColor(GRAY_400);
    doc.text("LETTER NUMBER", leftCol, y);
    doc.text("DATE ISSUED", rightCol, y);
    y += 12;
    doc.fontSize(11).fillColor(DEEP_NAVY);
    doc.text(data.letterNumber, leftCol, y);
    doc.text(formatDate(data.generatedAt), rightCol, y);
    y += 20;

    doc.fontSize(8).fillColor(GRAY_400);
    doc.text("VALID THROUGH", leftCol, y);
    doc.text("LOAN PURPOSE", rightCol, y);
    y += 12;
    doc.fontSize(11).fillColor(DEEP_NAVY);
    doc.text(formatDate(data.expirationDate), leftCol, y);
    doc.text(capitalize(data.loanPurpose || "Purchase"), rightCol, y);
    y += 24;

    doc.moveTo(doc.page.margins.left, y).lineTo(doc.page.margins.left + pageWidth, y).stroke(BORDER_COLOR);
    y += 20;

    doc.fontSize(11).fillColor(GRAY_600);
    doc.text("To Whom It May Concern,", leftCol, y);
    y += 24;

    doc.fontSize(11).fillColor(GRAY_600);
    const introText = `Based on our review of the financial information provided, ${data.companyLegalName} is pleased to confirm that the following borrower has been pre-approved for mortgage financing:`;
    doc.text(introText, leftCol, y, { width: pageWidth, lineGap: 4 });
    y = doc.y + 20;

    const boxX = leftCol;
    const boxW = pageWidth;
    const boxH = 100;
    doc.roundedRect(boxX, y, boxW, boxH, 4).fill("#f0fdf4");
    doc.roundedRect(boxX, y, boxW, boxH, 4).stroke("#bbf7d0");

    doc.fontSize(9).fillColor(GRAY_400);
    doc.text("BORROWER", boxX + 16, y + 12, { width: boxW / 2 - 24 });
    doc.fontSize(14).fillColor(DEEP_NAVY);
    doc.text(data.borrowerName, boxX + 16, y + 26, { width: boxW / 2 - 24 });

    doc.fontSize(9).fillColor(GRAY_400);
    doc.text("PRE-APPROVED AMOUNT", boxX + boxW / 2, y + 12, { width: boxW / 2 - 16 });
    doc.fontSize(22).fillColor(EMERALD);
    doc.text(`$${formatCurrency(data.loanAmount)}`, boxX + boxW / 2, y + 28, { width: boxW / 2 - 16 });

    doc.fontSize(9).fillColor(GRAY_400);
    doc.text("PRODUCT TYPE", boxX + 16, y + 60, { width: boxW / 3 - 16 });
    doc.fontSize(11).fillColor(DEEP_NAVY);
    doc.text(formatProductType(data.productType), boxX + 16, y + 74);

    doc.fontSize(9).fillColor(GRAY_400);
    doc.text("OCCUPANCY", boxX + boxW / 3, y + 60, { width: boxW / 3 - 16 });
    doc.fontSize(11).fillColor(DEEP_NAVY);
    doc.text(capitalize(data.occupancy), boxX + boxW / 3, y + 74);

    y += boxH + 20;

    const hasFinancialData = data.purchasePrice || data.annualIncome || data.estimatedDti || data.creditScoreRange;
    if (hasFinancialData) {
      doc.fontSize(12).fillColor(DEEP_NAVY);
      doc.text("Financial Summary", leftCol, y, { underline: true });
      y += 20;

      const summaryItems: Array<{ label: string; value: string }> = [];
      if (data.purchasePrice) summaryItems.push({ label: "Purchase Price", value: `$${formatCurrency(data.purchasePrice)}` });
      if (data.downPayment) {
        const dpLabel = data.downPaymentPercent ? `Down Payment (${data.downPaymentPercent}%)` : "Down Payment";
        summaryItems.push({ label: dpLabel, value: `$${formatCurrency(data.downPayment)}` });
      }
      if (data.annualIncome) summaryItems.push({ label: "Annual Income", value: `$${formatCurrency(data.annualIncome)}` });
      if (data.employmentType) summaryItems.push({ label: "Employment", value: capitalize(data.employmentType.replace("_", " ")) });
      if (data.creditScoreRange) summaryItems.push({ label: "Credit Score Range", value: data.creditScoreRange });
      if (data.estimatedDti) summaryItems.push({ label: "Debt-to-Income Ratio", value: `${data.estimatedDti}%` });
      if (data.monthlyPaymentEstimate) summaryItems.push({ label: "Est. Monthly Payment", value: `$${formatCurrency(data.monthlyPaymentEstimate)}` });
      if (data.propertyType) summaryItems.push({ label: "Property Type", value: capitalize(data.propertyType.replace("_", " ")) });
      if (data.propertyState) summaryItems.push({ label: "Property State", value: data.propertyState.toUpperCase() });

      doc.fontSize(10).fillColor(GRAY_600);
      for (const item of summaryItems) {
        doc.text(`${item.label}: ${item.value}`, leftCol + 8, y);
        y = doc.y + 6;
      }

      if (data.incomeSources && data.incomeSources.length > 0) {
        y += 6;
        doc.fontSize(10).fillColor(DEEP_NAVY);
        doc.text("Income Breakdown:", leftCol + 8, y);
        y = doc.y + 6;
        doc.fontSize(9).fillColor(GRAY_600);
        for (const src of data.incomeSources) {
          const typeLabel = capitalize(src.type.replace("_", " "));
          doc.text(`  ${typeLabel}: $${formatCurrency(src.annualAmount)}/yr`, leftCol + 16, y);
          y = doc.y + 4;
          if (src.rentalProperties && src.rentalProperties.length > 0) {
            doc.fontSize(8).fillColor(GRAY_400);
            for (const prop of src.rentalProperties) {
              const debtStr = prop.monthlyDebtPayment && parseFloat(prop.monthlyDebtPayment) > 0
                ? ` (debt: $${formatCurrency(prop.monthlyDebtPayment)}/mo)`
                : "";
              doc.text(`    ${prop.address} - $${formatCurrency(prop.monthlyRentalIncome)}/mo income${debtStr}`, leftCol + 24, y, { width: pageWidth - 48 });
              y = doc.y + 3;
            }
            doc.fontSize(9).fillColor(GRAY_600);
          }
        }
      }

      y += 10;
    }

    if (data.conditions.length > 0) {
      doc.fontSize(12).fillColor(DEEP_NAVY);
      doc.text("Conditions", leftCol, y, { underline: true });
      y += 20;

      doc.fontSize(10).fillColor(GRAY_600);
      for (const condition of data.conditions) {
        doc.text(`  \u2022  ${condition}`, leftCol + 8, y, { width: pageWidth - 16, lineGap: 2 });
        y = doc.y + 6;
      }
      y += 10;
    }

    doc.moveTo(leftCol, y).lineTo(leftCol + pageWidth, y).stroke(BORDER_COLOR);
    y += 16;

    doc.fontSize(8).fillColor(GRAY_400);
    doc.text("IMPORTANT DISCLAIMERS", leftCol, y);
    y += 14;

    doc.fontSize(7.5).fillColor(GRAY_400);
    const defaultDisclaimers = [
      "This pre-approval is not a commitment to lend. Final approval is subject to a satisfactory appraisal, title search, and verification of all information provided.",
      "This letter is valid only for the borrower named above and is non-transferable. Terms are subject to change based on market conditions.",
      "The pre-approved amount is based on information provided and preliminary underwriting review. The actual loan amount may differ upon full underwriting.",
      "This pre-approval does not guarantee any specific interest rate. Rate lock is available separately.",
      "Equal Housing Lender. All loans are subject to credit approval.",
    ];

    const allDisclaimers = data.disclaimers.length > 0 ? data.disclaimers : defaultDisclaimers;
    for (const disc of allDisclaimers) {
      doc.text(disc, leftCol, y, { width: pageWidth, lineGap: 1.5 });
      y = doc.y + 6;
    }

    y += 10;

    if (data.loanOfficerName) {
      doc.fontSize(10).fillColor(DEEP_NAVY);
      doc.text("Sincerely,", leftCol, y);
      y += 24;
      doc.fontSize(12).fillColor(DEEP_NAVY);
      doc.text(data.loanOfficerName, leftCol, y);
      y += 16;
      doc.fontSize(9).fillColor(GRAY_600);
      doc.text(`Loan Officer | NMLS #${data.loanOfficerNmlsId || "N/A"}`, leftCol, y);
      y += 14;
    }

    doc.fontSize(9).fillColor(GRAY_600);
    doc.text(data.companyLegalName, leftCol, y);
    y += 14;
    if (data.companyContactInfo) {
      doc.fontSize(8).fillColor(GRAY_400);
      doc.text(data.companyContactInfo, leftCol, y, { width: pageWidth });
    }

    doc.end();
  });
}

interface PreQualLetterData {
  letterNumber: string;
  borrowerName: string;
  estimatedAmount: string;
  productType: string;
  occupancy: string;
  loanPurpose?: string;
  annualIncome?: string;
  creditScoreRange?: string;
  employmentType?: string;
  estimatedDti?: string;
  downPaymentPercent?: string;
  companyLegalName: string;
  companyNmlsId: string;
  companyContactInfo?: string;
  loanOfficerName?: string;
  loanOfficerNmlsId?: string;
  expirationDate: Date;
  generatedAt: Date;
}

export function generatePreQualificationPDF(data: PreQualLetterData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "LETTER",
      margins: { top: 60, bottom: 60, left: 60, right: 60 },
      info: {
        Title: `Pre-Qualification Letter ${data.letterNumber}`,
        Author: data.companyLegalName,
        Subject: "Mortgage Pre-Qualification",
      },
    });

    const chunks: Uint8Array[] = [];
    doc.on("data", (chunk: Uint8Array) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    doc.save();
    doc.rotate(-45, { origin: [306, 396] });
    doc.fontSize(48).fillColor("#e2e8f0").opacity(0.25);
    doc.text("PRE-QUALIFICATION", 20, 360, { align: "center", width: pageWidth });
    doc.restore();
    doc.opacity(1);

    const AMBER = "#d97706";

    doc.rect(doc.page.margins.left, doc.page.margins.top, pageWidth, 80).fill(DEEP_NAVY);
    doc.fontSize(22).fillColor("#ffffff");
    doc.text("HOMIQUITY", doc.page.margins.left + 20, doc.page.margins.top + 18, { width: pageWidth - 40 });
    doc.fontSize(10).fillColor("#94a3b8");
    doc.text("Clarity for Every Stage of Homeownership", doc.page.margins.left + 20, doc.page.margins.top + 48, { width: pageWidth - 40 });
    doc.fontSize(9).fillColor("#94a3b8");
    doc.text(`NMLS #${data.companyNmlsId}`, doc.page.margins.left + 20, doc.page.margins.top + 62, {
      width: pageWidth - 40,
      align: "right",
    });

    let y = doc.page.margins.top + 100;

    doc.fontSize(16).fillColor(DEEP_NAVY);
    doc.text("PRE-QUALIFICATION LETTER", doc.page.margins.left, y, { align: "center", width: pageWidth });
    y += 30;

    doc.moveTo(doc.page.margins.left, y).lineTo(doc.page.margins.left + pageWidth, y).stroke(BORDER_COLOR);
    y += 16;

    const leftCol = doc.page.margins.left;
    const rightCol = doc.page.margins.left + pageWidth / 2;

    doc.fontSize(8).fillColor(GRAY_400);
    doc.text("LETTER NUMBER", leftCol, y);
    doc.text("DATE ISSUED", rightCol, y);
    y += 12;
    doc.fontSize(11).fillColor(DEEP_NAVY);
    doc.text(data.letterNumber, leftCol, y);
    doc.text(formatDate(data.generatedAt), rightCol, y);
    y += 20;

    doc.fontSize(8).fillColor(GRAY_400);
    doc.text("VALID THROUGH", leftCol, y);
    doc.text("LOAN PURPOSE", rightCol, y);
    y += 12;
    doc.fontSize(11).fillColor(DEEP_NAVY);
    doc.text(formatDate(data.expirationDate), leftCol, y);
    doc.text(capitalize(data.loanPurpose || "Purchase"), rightCol, y);
    y += 24;

    doc.moveTo(doc.page.margins.left, y).lineTo(doc.page.margins.left + pageWidth, y).stroke(BORDER_COLOR);
    y += 20;

    doc.fontSize(11).fillColor(GRAY_600);
    doc.text("To Whom It May Concern,", leftCol, y);
    y += 24;

    doc.fontSize(11).fillColor(GRAY_600);
    const introText = `Based on a preliminary review of self-reported financial information, ${data.companyLegalName} has determined that the following individual may qualify for mortgage financing up to the estimated amount below. This pre-qualification is not a commitment to lend and is subject to full verification.`;
    doc.text(introText, leftCol, y, { width: pageWidth, lineGap: 4 });
    y = doc.y + 20;

    const boxX = leftCol;
    const boxW = pageWidth;
    const boxH = 100;
    doc.roundedRect(boxX, y, boxW, boxH, 4).fill("#fffbeb");
    doc.roundedRect(boxX, y, boxW, boxH, 4).stroke("#fde68a");

    doc.fontSize(9).fillColor(GRAY_400);
    doc.text("BORROWER", boxX + 16, y + 12, { width: boxW / 2 - 24 });
    doc.fontSize(14).fillColor(DEEP_NAVY);
    doc.text(data.borrowerName, boxX + 16, y + 26, { width: boxW / 2 - 24 });

    doc.fontSize(9).fillColor(GRAY_400);
    doc.text("ESTIMATED QUALIFYING AMOUNT", boxX + boxW / 2, y + 12, { width: boxW / 2 - 16 });
    doc.fontSize(22).fillColor(AMBER);
    doc.text(`$${formatCurrency(data.estimatedAmount)}`, boxX + boxW / 2, y + 28, { width: boxW / 2 - 16 });

    doc.fontSize(9).fillColor(GRAY_400);
    doc.text("PRODUCT TYPE", boxX + 16, y + 60, { width: boxW / 3 - 16 });
    doc.fontSize(11).fillColor(DEEP_NAVY);
    doc.text(formatProductType(data.productType), boxX + 16, y + 74);

    doc.fontSize(9).fillColor(GRAY_400);
    doc.text("OCCUPANCY", boxX + boxW / 3, y + 60, { width: boxW / 3 - 16 });
    doc.fontSize(11).fillColor(DEEP_NAVY);
    doc.text(capitalize(data.occupancy), boxX + boxW / 3, y + 74);

    y += boxH + 20;

    if (data.annualIncome || data.creditScoreRange || data.employmentType) {
      doc.fontSize(12).fillColor(DEEP_NAVY);
      doc.text("Financial Summary (Self-Reported)", leftCol, y, { underline: true });
      y += 20;

      doc.fontSize(10).fillColor(GRAY_600);
      if (data.annualIncome) {
        doc.text(`Annual Income: $${formatCurrency(data.annualIncome)}`, leftCol + 8, y);
        y = doc.y + 6;
      }
      if (data.employmentType) {
        doc.text(`Employment: ${capitalize(data.employmentType.replace("_", " "))}`, leftCol + 8, y);
        y = doc.y + 6;
      }
      if (data.creditScoreRange) {
        doc.text(`Credit Score Range: ${data.creditScoreRange}`, leftCol + 8, y);
        y = doc.y + 6;
      }
      if (data.estimatedDti) {
        doc.text(`Estimated DTI: ${data.estimatedDti}%`, leftCol + 8, y);
        y = doc.y + 6;
      }
      if (data.downPaymentPercent) {
        doc.text(`Down Payment: ${data.downPaymentPercent}%`, leftCol + 8, y);
        y = doc.y + 6;
      }
      y += 10;
    }

    doc.moveTo(leftCol, y).lineTo(leftCol + pageWidth, y).stroke(BORDER_COLOR);
    y += 16;

    doc.fontSize(8).fillColor(GRAY_400);
    doc.text("IMPORTANT DISCLAIMERS", leftCol, y);
    y += 14;

    doc.fontSize(7.5).fillColor(GRAY_400);
    const disclaimers = [
      "This pre-qualification is NOT a pre-approval or commitment to lend. It is a preliminary assessment based on self-reported financial information that has not been independently verified.",
      "A formal pre-approval requires submission of supporting documentation, credit verification, employment verification, and full underwriting review.",
      "The estimated qualifying amount is subject to change based on verification of income, assets, credit history, and property appraisal.",
      "This letter is valid only for the individual named above and is non-transferable. Market conditions, interest rates, and lending guidelines may change.",
      "This pre-qualification does not guarantee any specific interest rate, loan terms, or final approval.",
      "Equal Housing Lender. All loans are subject to credit approval and property eligibility.",
    ];

    for (const disc of disclaimers) {
      doc.text(disc, leftCol, y, { width: pageWidth, lineGap: 1.5 });
      y = doc.y + 6;
    }

    y += 10;

    if (data.loanOfficerName) {
      doc.fontSize(10).fillColor(DEEP_NAVY);
      doc.text("Sincerely,", leftCol, y);
      y += 24;
      doc.fontSize(12).fillColor(DEEP_NAVY);
      doc.text(data.loanOfficerName, leftCol, y);
      y += 16;
      doc.fontSize(9).fillColor(GRAY_600);
      doc.text(`Loan Officer | NMLS #${data.loanOfficerNmlsId || "N/A"}`, leftCol, y);
      y += 14;
    }

    doc.fontSize(9).fillColor(GRAY_600);
    doc.text(data.companyLegalName, leftCol, y);
    y += 14;
    if (data.companyContactInfo) {
      doc.fontSize(8).fillColor(GRAY_400);
      doc.text(data.companyContactInfo, leftCol, y, { width: pageWidth });
    }

    doc.end();
  });
}

interface AdverseActionLetterData {
  noticeId: string;
  actionType: string;
  noticeDate: Date;
  /**
   * The stored adverse_actions.notice_text — the authoritative ECOA/Reg B +
   * FCRA §615(a) wording generated by creditService.generateAdverseActionNotice.
   * Rendered verbatim: this generator adds letterhead and a mailing block only,
   * never legal content.
   */
  noticeText: string;
  borrowerName: string;
  /** Mailing address block for the postal-delivery channel, when known. */
  borrowerAddressLines?: string[];
  companyLegalName: string;
  companyNmlsId: string;
  companyContactInfo?: string;
}

export function generateAdverseActionPDF(data: AdverseActionLetterData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "LETTER",
      margins: { top: 60, bottom: 60, left: 60, right: 60 },
      info: {
        Title: `Adverse Action Notice ${data.noticeId}`,
        Author: data.companyLegalName,
        Subject: "Adverse Action Notice (ECOA / FCRA)",
      },
    });

    const chunks: Uint8Array[] = [];
    doc.on("data", (chunk: Uint8Array) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    doc.rect(doc.page.margins.left, doc.page.margins.top, pageWidth, 80).fill(DEEP_NAVY);
    doc.fontSize(22).fillColor("#ffffff");
    doc.text("HOMIQUITY", doc.page.margins.left + 20, doc.page.margins.top + 18, { width: pageWidth - 40 });
    doc.fontSize(10).fillColor("#94a3b8");
    doc.text("Clarity for Every Stage of Homeownership", doc.page.margins.left + 20, doc.page.margins.top + 48, { width: pageWidth - 40 });
    doc.fontSize(9).fillColor("#94a3b8");
    doc.text(`NMLS #${data.companyNmlsId}`, doc.page.margins.left + 20, doc.page.margins.top + 62, {
      width: pageWidth - 40,
      align: "right",
    });

    let y = doc.page.margins.top + 100;

    doc.fontSize(16).fillColor(DEEP_NAVY);
    doc.text("ADVERSE ACTION NOTICE", doc.page.margins.left, y, { align: "center", width: pageWidth });
    y += 30;

    doc.moveTo(doc.page.margins.left, y).lineTo(doc.page.margins.left + pageWidth, y).stroke(BORDER_COLOR);
    y += 16;

    const leftCol = doc.page.margins.left;
    const rightCol = doc.page.margins.left + pageWidth / 2;

    doc.fontSize(8).fillColor(GRAY_400);
    doc.text("NOTICE DATE", leftCol, y);
    doc.text("ACTION TAKEN", rightCol, y);
    y += 12;
    doc.fontSize(11).fillColor(DEEP_NAVY);
    doc.text(formatDate(data.noticeDate), leftCol, y);
    doc.text(capitalize(data.actionType.replace(/_/g, " ")), rightCol, y);
    y += 20;

    doc.fontSize(8).fillColor(GRAY_400);
    doc.text("NOTICE ID", leftCol, y);
    y += 12;
    doc.fontSize(11).fillColor(DEEP_NAVY);
    doc.text(data.noticeId, leftCol, y);
    y += 24;

    doc.moveTo(doc.page.margins.left, y).lineTo(doc.page.margins.left + pageWidth, y).stroke(BORDER_COLOR);
    y += 16;

    doc.fontSize(8).fillColor(GRAY_400);
    doc.text("TO", leftCol, y);
    y += 12;
    doc.fontSize(11).fillColor(DEEP_NAVY);
    doc.text(data.borrowerName, leftCol, y);
    y = doc.y + 2;
    if (data.borrowerAddressLines && data.borrowerAddressLines.length > 0) {
      doc.fontSize(10).fillColor(GRAY_600);
      for (const line of data.borrowerAddressLines) {
        doc.text(line, leftCol, y, { width: pageWidth });
        y = doc.y + 2;
      }
    }
    y += 14;

    doc.moveTo(doc.page.margins.left, y).lineTo(doc.page.margins.left + pageWidth, y).stroke(BORDER_COLOR);
    y += 16;

    // The notice body is the stored legal text, verbatim. Flowing text so
    // PDFKit paginates automatically — the full FCRA + ECOA content routinely
    // exceeds one page.
    doc.fontSize(9.5).fillColor(GRAY_600);
    doc.text(data.noticeText.trim(), leftCol, y, { width: pageWidth, lineGap: 2.5 });

    doc.end();
  });
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

function formatCurrency(amount: string): string {
  const num = parseFloat(amount);
  if (isNaN(num)) return amount;
  return num.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatProductType(type: string): string {
  const map: Record<string, string> = {
    CONV: "Conventional",
    FHA: "FHA",
    VA: "VA",
    HELOC: "HELOC",
    DSCR: "DSCR",
    conventional: "Conventional",
  };
  return map[type] || capitalize(type);
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

// ---------------------------------------------------------------------------
// Loan Estimate
// ---------------------------------------------------------------------------

export interface LoanEstimatePdfData {
  applicationId: string;
  dateIssued: Date;
  expirationDate: Date;
  loanTerms: {
    loanAmount: number;
    interestRate: number;
    monthlyPrincipalAndInterest: number;
    prepaymentPenalty: boolean;
    balloonPayment: boolean;
  };
  projectedPayments: {
    years1Through5: { principalAndInterest: number; mortgageInsurance: number; estimatedEscrow: number; estimatedTotal: number };
    years6Through30?: { principalAndInterest: number; mortgageInsurance: number; estimatedEscrow: number; estimatedTotal: number };
  };
  costsAtClosing: { estimatedClosingCosts: number; estimatedCashToClose: number };
  closingCostDetails: {
    loanCosts: {
      originationCharges: { originationFee: number; points: number; applicationFee: number; underwritingFee: number; total: number };
      servicesYouCannotShopFor: { appraisal: number; creditReport: number; floodDetermination: number; taxService: number; total: number };
      servicesYouCanShopFor: { titleInsurance: number; titleSearch: number; surveyFee: number; pestInspection: number; total: number };
      totalLoanCosts: number;
    };
    otherCosts: {
      taxesAndGovernmentFees: { recordingFees: number; transferTaxes: number; total: number };
      prepaids: { homeownersInsurance: number; mortgageInsurance: number; prepaidInterest: number; propertyTaxes: number; total: number };
      initialEscrowPaymentAtClosing: { homeownersInsurance: number; mortgageInsurance: number; propertyTaxes: number; total: number };
      totalOtherCosts: number;
    };
    totalClosingCosts: number;
  };
  comparisons: {
    inFiveYears: { totalYouWillHavePaid: number; principalPaidOff: number };
    apr: number;
    totalInterestPercentage: number;
  };
  lenderCredits: number;
  borrowerName: string;
  companyLegalName: string;
  companyNmlsId: string;
}

function money(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

/**
 * Render a Loan Estimate as a PDF the borrower can save alongside their
 * Closing Disclosure.
 *
 * The figures are passed in, never recomputed here: the caller supplies the
 * disclosure that is actually in force (the issued baseline, when one exists),
 * so this cannot emit numbers the borrower was never shown. Section lettering
 * follows the Loan Estimate form's own A/B structure.
 *
 * This renders the disclosure's content for the borrower's records. It is not
 * the official CFPB-formatted H-24 form, and the footer says so.
 */
export function generateLoanEstimatePDF(data: LoanEstimatePdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "LETTER",
      margins: { top: 54, bottom: 54, left: 54, right: 54 },
      info: {
        Title: `Loan Estimate ${data.applicationId}`,
        Author: data.companyLegalName,
        Subject: "Loan Estimate (TRID / Reg Z §1026.37)",
      },
    });

    const chunks: Uint8Array[] = [];
    doc.on("data", (chunk: Uint8Array) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const left = doc.page.margins.left;
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const right = left + pageWidth;

    // Keeps the flow honest across pages: every writer advances `y`, and any
    // block that would run off the page starts a new one first.
    let y = doc.page.margins.top;
    const bottomLimit = doc.page.height - doc.page.margins.bottom;
    const ensure = (needed: number) => {
      if (y + needed > bottomLimit) {
        doc.addPage();
        y = doc.page.margins.top;
      }
    };

    const rule = () => {
      doc.moveTo(left, y).lineTo(right, y).stroke(BORDER_COLOR);
      y += 10;
    };

    const heading = (text: string) => {
      ensure(34);
      doc.fontSize(12).fillColor(DEEP_NAVY).text(text, left, y, { width: pageWidth });
      y = doc.y + 4;
      rule();
    };

    const row = (label: string, value: string, bold = false) => {
      ensure(16);
      doc.fontSize(bold ? 10 : 9.5).fillColor(bold ? DEEP_NAVY : GRAY_600);
      doc.text(label, left, y, { width: pageWidth * 0.68 });
      doc.text(value, left, y, { width: pageWidth, align: "right" });
      y += bold ? 15 : 13;
    };

    // Masthead
    doc.rect(left, y, pageWidth, 70).fill(DEEP_NAVY);
    doc.fontSize(20).fillColor("#ffffff").text("HOMIQUITY", left + 18, y + 16, { width: pageWidth - 36 });
    doc.fontSize(9).fillColor(GRAY_400).text("Loan Estimate", left + 18, y + 42, { width: pageWidth - 36 });
    doc.fontSize(9).fillColor(GRAY_400).text(`NMLS #${data.companyNmlsId}`, left + 18, y + 42, {
      width: pageWidth - 36,
      align: "right",
    });
    y += 88;

    doc.fontSize(9).fillColor(GRAY_400).text("PREPARED FOR", left, y);
    doc.text("DATE ISSUED", left, y, { width: pageWidth, align: "right" });
    y += 12;
    doc.fontSize(11).fillColor(DEEP_NAVY).text(data.borrowerName, left, y);
    doc.text(formatDate(data.dateIssued), left, y, { width: pageWidth, align: "right" });
    y += 18;
    doc.fontSize(9).fillColor(GRAY_600).text(
      `Save this Loan Estimate to compare with your Closing Disclosure. Estimate expires ${formatDate(data.expirationDate)}.`,
      left,
      y,
      { width: pageWidth },
    );
    y = doc.y + 12;
    rule();

    heading("Loan Terms");
    row("Loan Amount", money(data.loanTerms.loanAmount));
    row("Interest Rate", `${data.loanTerms.interestRate}%`);
    row("Monthly Principal & Interest", money(data.loanTerms.monthlyPrincipalAndInterest));
    row("Prepayment Penalty", data.loanTerms.prepaymentPenalty ? "Yes - see loan documents" : "No prepayment penalty");
    row("Balloon Payment", data.loanTerms.balloonPayment ? "Yes - see loan documents" : "No balloon payment");
    y += 8;

    heading("Projected Payments");
    const p1 = data.projectedPayments.years1Through5;
    row("Years 1-5 — Principal & Interest", money(p1.principalAndInterest));
    row("Years 1-5 — Mortgage Insurance", money(p1.mortgageInsurance));
    row("Years 1-5 — Estimated Escrow", money(p1.estimatedEscrow));
    row("Years 1-5 — Estimated Total", money(p1.estimatedTotal), true);
    const p2 = data.projectedPayments.years6Through30;
    if (p2) {
      y += 4;
      row("Years 6-30 — Principal & Interest", money(p2.principalAndInterest));
      row("Years 6-30 — Mortgage Insurance", money(p2.mortgageInsurance));
      row("Years 6-30 — Estimated Escrow", money(p2.estimatedEscrow));
      row("Years 6-30 — Estimated Total", money(p2.estimatedTotal), true);
    }
    y += 8;

    heading("Costs at Closing");
    row("Estimated Closing Costs", money(data.costsAtClosing.estimatedClosingCosts), true);
    row("Estimated Cash to Close", money(data.costsAtClosing.estimatedCashToClose), true);
    y += 8;

    const { loanCosts, otherCosts } = data.closingCostDetails;
    heading("A. Loan Costs");
    row("Origination Fee", money(loanCosts.originationCharges.originationFee));
    row("Points", money(loanCosts.originationCharges.points));
    row("Application Fee", money(loanCosts.originationCharges.applicationFee));
    row("Underwriting Fee", money(loanCosts.originationCharges.underwritingFee));
    row("Origination Charges Subtotal", money(loanCosts.originationCharges.total), true);
    y += 4;
    row("Appraisal", money(loanCosts.servicesYouCannotShopFor.appraisal));
    row("Credit Report", money(loanCosts.servicesYouCannotShopFor.creditReport));
    row("Flood Determination", money(loanCosts.servicesYouCannotShopFor.floodDetermination));
    row("Tax Service", money(loanCosts.servicesYouCannotShopFor.taxService));
    row("Services You Cannot Shop For Subtotal", money(loanCosts.servicesYouCannotShopFor.total), true);
    y += 4;
    row("Title Insurance", money(loanCosts.servicesYouCanShopFor.titleInsurance));
    row("Title Search", money(loanCosts.servicesYouCanShopFor.titleSearch));
    row("Survey", money(loanCosts.servicesYouCanShopFor.surveyFee));
    row("Pest Inspection", money(loanCosts.servicesYouCanShopFor.pestInspection));
    row("Services You Can Shop For Subtotal", money(loanCosts.servicesYouCanShopFor.total), true);
    y += 4;
    row("Total Loan Costs (A)", money(loanCosts.totalLoanCosts), true);
    y += 8;

    heading("B. Other Costs");
    row("Recording Fees", money(otherCosts.taxesAndGovernmentFees.recordingFees));
    row("Transfer Taxes", money(otherCosts.taxesAndGovernmentFees.transferTaxes));
    row("Taxes and Government Fees Subtotal", money(otherCosts.taxesAndGovernmentFees.total), true);
    y += 4;
    row("Prepaid Homeowner's Insurance", money(otherCosts.prepaids.homeownersInsurance));
    row("Prepaid Mortgage Insurance", money(otherCosts.prepaids.mortgageInsurance));
    row("Prepaid Interest", money(otherCosts.prepaids.prepaidInterest));
    row("Prepaid Property Taxes", money(otherCosts.prepaids.propertyTaxes));
    row("Prepaids Subtotal", money(otherCosts.prepaids.total), true);
    y += 4;
    row("Escrow — Homeowner's Insurance", money(otherCosts.initialEscrowPaymentAtClosing.homeownersInsurance));
    row("Escrow — Mortgage Insurance", money(otherCosts.initialEscrowPaymentAtClosing.mortgageInsurance));
    row("Escrow — Property Taxes", money(otherCosts.initialEscrowPaymentAtClosing.propertyTaxes));
    row("Initial Escrow Payment at Closing Subtotal", money(otherCosts.initialEscrowPaymentAtClosing.total), true);
    y += 4;
    row("Total Other Costs (B)", money(otherCosts.totalOtherCosts), true);
    y += 8;

    heading("Total Closing Costs");
    row("Total Closing Costs (A + B)", money(data.closingCostDetails.totalClosingCosts), true);
    if (data.lenderCredits > 0) {
      row("Lender Credits", `-${money(data.lenderCredits)}`);
    }
    y += 8;

    heading("Comparisons");
    row("In 5 Years — Total You Will Have Paid", money(data.comparisons.inFiveYears.totalYouWillHavePaid));
    row("In 5 Years — Principal Paid Off", money(data.comparisons.inFiveYears.principalPaidOff));
    row("Annual Percentage Rate (APR)", `${data.comparisons.apr}%`);
    row("Total Interest Percentage", `${data.comparisons.totalInterestPercentage}%`);
    y += 12;

    ensure(60);
    rule();
    doc.fontSize(8).fillColor(GRAY_400).text(
      "Your actual rate, payment, and costs could be higher. This document reproduces the figures of the " +
        "Loan Estimate issued for your records; it is not the official CFPB Loan Estimate form. " +
        `${data.companyLegalName} — NMLS #${data.companyNmlsId}. Equal Housing Lender.`,
      left,
      y,
      { width: pageWidth, lineGap: 1.5 },
    );

    doc.end();
  });
}
