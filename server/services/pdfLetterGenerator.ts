// @ts-ignore - pdfkit types
import PDFDocument from "pdfkit";

interface LetterData {
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
