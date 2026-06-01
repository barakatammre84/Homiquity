import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenAI({ apiKey }) : null;

interface LoanAnalysisInput {
  annualIncome: string;
  monthlyDebts: string;
  creditScore: string;
  purchasePrice: string;
  downPayment: string;
  propertyType: string;
  loanPurpose: string;
  isVeteran: boolean;
  isFirstTimeBuyer: boolean;
  employmentType: string;
  employmentYears: string;
}

interface LoanScenario {
  loanType: "conventional" | "fha" | "va";
  loanTerm: number;
  interestRate: string;
  apr: string;
  points: string;
  pointsCost: string;
  monthlyPayment: string;
  principalAndInterest: string;
  propertyTax: string;
  homeInsurance: string;
  pmi: string;
  loanAmount: string;
  closingCosts: string;
  cashToClose: string;
  totalInterestPaid: string;
  downPaymentAmount: string;
  downPaymentPercent: string;
  isRecommended: boolean;
}

interface LoanAnalysisResult {
  isApproved: boolean;
  preApprovalAmount: string;
  dtiRatio: string;
  ltvRatio: string;
  analysis: {
    strengths: string[];
    concerns: string[];
    recommendations: string[];
  };
  scenarios: LoanScenario[];
}

export async function analyzeLoanApplication(input: LoanAnalysisInput): Promise<LoanAnalysisResult> {
  const income = parseFloat(input.annualIncome.replace(/[,$]/g, ""));
  const monthlyDebts = parseFloat(input.monthlyDebts.replace(/[,$]/g, ""));
  const creditScore = parseInt(input.creditScore);
  const purchasePrice = parseFloat(input.purchasePrice.replace(/[,$]/g, ""));
  const downPayment = parseFloat(input.downPayment.replace(/[,$]/g, ""));
  
  const monthlyIncome = income / 12;
  const loanAmount = purchasePrice - downPayment;
  const ltvRatio = (loanAmount / purchasePrice) * 100;
  const downPaymentPercent = (downPayment / purchasePrice) * 100;

  const prompt = `You are a mortgage calculation engine. Compute loan scenarios from the inputs below using standard underwriting formulas. Do not make approval decisions, eligibility predictions, or qualitative assessments.

Inputs:
- Annual Income: $${income.toLocaleString()}
- Monthly Income: $${monthlyIncome.toFixed(2)}
- Monthly Debts: $${monthlyDebts}
- Credit Score: ${creditScore}
- Employment: ${input.employmentType}, ${input.employmentYears} years
- Veteran Status: ${input.isVeteran ? "Yes" : "No"}
- First-time Buyer: ${input.isFirstTimeBuyer ? "Yes" : "No"}
- Purchase Price: $${purchasePrice.toLocaleString()}
- Down Payment: $${downPayment.toLocaleString()} (${downPaymentPercent.toFixed(1)}%)
- Loan Amount: $${loanAmount.toLocaleString()}
- Property Type: ${input.propertyType}
- Loan Purpose: ${input.loanPurpose}

Compute and return a JSON response with:
1. Maximum loan amount the borrower could carry (based on DTI ≤ 43%)
2. Computed DTI ratio (including estimated mortgage payment)
3. Computed LTV ratio
4. Factual observations about the numeric inputs (no qualitative judgments)
5. Multiple loan scenarios (conventional with/without points, FHA if applicable, VA if veteran)

For each scenario, compute:
- Interest rate (current market: approximately 6.5-7.5% for conventional)
- Monthly P&I payment using standard amortization formula
- Property tax estimate (1.2% of purchase price annually / 12)
- Home insurance estimate ($1,200-2,400 annually / 12)
- PMI if LTV > 80% (0.5-1% of loan annually / 12)
- Closing costs (2-5% of loan amount)
- Cash to close (down payment + closing costs)

RULES:
- "strengths" must contain only factual numeric observations (e.g., "Credit score: 740", "Down payment: 20%"). No adjectives like "strong", "solid", "excellent".
- "concerns" must contain only factual threshold observations (e.g., "Computed DTI: 42.3%, above 36% guideline"). No words like "high", "risky", "concerning".
- "recommendations" must contain only procedural notes (e.g., "PMI applies at LTV above 80%"). No advice like "consider", "should", "we recommend".
- Do NOT include "isApproved" — approval is determined server-side.

Return ONLY valid JSON in this exact format:
{
  "preApprovalAmount": "500000",
  "dtiRatio": "35.5",
  "ltvRatio": "80.0",
  "analysis": {
    "strengths": ["Credit score: 740", "Employment duration: 5 years"],
    "concerns": ["Computed DTI: 38.2%, above 36% guideline threshold"],
    "recommendations": ["PMI applies at current LTV of 85%"]
  },
  "scenarios": [
    {
      "loanType": "conventional",
      "loanTerm": 30,
      "interestRate": "6.875",
      "apr": "7.125",
      "points": "0",
      "pointsCost": "0",
      "monthlyPayment": "2850.00",
      "principalAndInterest": "2625.00",
      "propertyTax": "500.00",
      "homeInsurance": "150.00",
      "pmi": "75.00",
      "loanAmount": "400000",
      "closingCosts": "12000",
      "cashToClose": "112000",
      "totalInterestPaid": "545000",
      "downPaymentAmount": "100000",
      "downPaymentPercent": "20.00",
      "isRecommended": true
    }
  ]
}`;

  if (!genAI) {
    console.log("Gemini API key not configured, using fallback analysis");
    return generateFallbackAnalysis(input, loanAmount, ltvRatio, monthlyIncome, monthlyDebts, creditScore, purchasePrice, downPayment, downPaymentPercent);
  }

  try {
    const response = await genAI.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
    });

    const text = response.text || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const computedDti = parseFloat(parsed.dtiRatio) || 0;
      const result: LoanAnalysisResult = {
        ...parsed,
        isApproved: computedDti <= 43 && creditScore >= 620,
      };
      return result;
    }
  } catch (error) {
    console.error("Gemini API error:", error);
  }

  return generateFallbackAnalysis(input, loanAmount, ltvRatio, monthlyIncome, monthlyDebts, creditScore, purchasePrice, downPayment, downPaymentPercent);
}

function generateFallbackAnalysis(
  input: LoanAnalysisInput,
  loanAmount: number,
  ltvRatio: number,
  monthlyIncome: number,
  monthlyDebts: number,
  creditScore: number,
  purchasePrice: number,
  downPayment: number,
  downPaymentPercent: number
): LoanAnalysisResult {
  const baseRate = 6.75;
  const monthlyRate = baseRate / 100 / 12;
  const numPayments = 360;
  
  const monthlyPI = (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / 
                    (Math.pow(1 + monthlyRate, numPayments) - 1);
  
  const propertyTax = (purchasePrice * 0.012) / 12;
  const homeInsurance = 150;
  const pmi = ltvRatio > 80 ? (loanAmount * 0.008) / 12 : 0;
  const totalMonthlyPayment = monthlyPI + propertyTax + homeInsurance + pmi;
  
  const dtiRatio = ((monthlyDebts + totalMonthlyPayment) / monthlyIncome) * 100;
  const isApproved = dtiRatio <= 43 && creditScore >= 620;

  const scenarios: LoanScenario[] = [];

  scenarios.push({
    loanType: "conventional",
    loanTerm: 30,
    interestRate: baseRate.toFixed(3),
    apr: (baseRate + 0.25).toFixed(3),
    points: "0",
    pointsCost: "0",
    monthlyPayment: totalMonthlyPayment.toFixed(2),
    principalAndInterest: monthlyPI.toFixed(2),
    propertyTax: propertyTax.toFixed(2),
    homeInsurance: homeInsurance.toFixed(2),
    pmi: pmi.toFixed(2),
    loanAmount: loanAmount.toFixed(2),
    closingCosts: (loanAmount * 0.03).toFixed(2),
    cashToClose: (downPayment + loanAmount * 0.03).toFixed(2),
    totalInterestPaid: ((monthlyPI * numPayments) - loanAmount).toFixed(2),
    downPaymentAmount: downPayment.toFixed(2),
    downPaymentPercent: downPaymentPercent.toFixed(2),
    isRecommended: true,
  });

  const pointsRate = baseRate - 0.25;
  const pointsCost = loanAmount * 0.01;
  const monthlyRateWithPoints = pointsRate / 100 / 12;
  const monthlyPIWithPoints = (loanAmount * monthlyRateWithPoints * Math.pow(1 + monthlyRateWithPoints, numPayments)) / 
                              (Math.pow(1 + monthlyRateWithPoints, numPayments) - 1);
  const totalWithPoints = monthlyPIWithPoints + propertyTax + homeInsurance + pmi;

  scenarios.push({
    loanType: "conventional",
    loanTerm: 30,
    interestRate: pointsRate.toFixed(3),
    apr: pointsRate.toFixed(3),
    points: "1",
    pointsCost: pointsCost.toFixed(2),
    monthlyPayment: totalWithPoints.toFixed(2),
    principalAndInterest: monthlyPIWithPoints.toFixed(2),
    propertyTax: propertyTax.toFixed(2),
    homeInsurance: homeInsurance.toFixed(2),
    pmi: pmi.toFixed(2),
    loanAmount: loanAmount.toFixed(2),
    closingCosts: (loanAmount * 0.03 + pointsCost).toFixed(2),
    cashToClose: (downPayment + loanAmount * 0.03 + pointsCost).toFixed(2),
    totalInterestPaid: ((monthlyPIWithPoints * numPayments) - loanAmount).toFixed(2),
    downPaymentAmount: downPayment.toFixed(2),
    downPaymentPercent: downPaymentPercent.toFixed(2),
    isRecommended: false,
  });

  if (creditScore <= 720 || input.isFirstTimeBuyer) {
    const fhaRate = baseRate - 0.25;
    const fhaMonthlyRate = fhaRate / 100 / 12;
    const fhaMIP = (loanAmount * 0.0085) / 12;
    const fhaPI = (loanAmount * fhaMonthlyRate * Math.pow(1 + fhaMonthlyRate, numPayments)) / 
                  (Math.pow(1 + fhaMonthlyRate, numPayments) - 1);
    const fhaTotal = fhaPI + propertyTax + homeInsurance + fhaMIP;

    scenarios.push({
      loanType: "fha",
      loanTerm: 30,
      interestRate: fhaRate.toFixed(3),
      apr: (fhaRate + 0.5).toFixed(3),
      points: "0",
      pointsCost: "0",
      monthlyPayment: fhaTotal.toFixed(2),
      principalAndInterest: fhaPI.toFixed(2),
      propertyTax: propertyTax.toFixed(2),
      homeInsurance: homeInsurance.toFixed(2),
      pmi: fhaMIP.toFixed(2),
      loanAmount: loanAmount.toFixed(2),
      closingCosts: (loanAmount * 0.035).toFixed(2),
      cashToClose: (downPayment + loanAmount * 0.035).toFixed(2),
      totalInterestPaid: ((fhaPI * numPayments) - loanAmount).toFixed(2),
      downPaymentAmount: downPayment.toFixed(2),
      downPaymentPercent: downPaymentPercent.toFixed(2),
      isRecommended: false,
    });
  }

  if (input.isVeteran) {
    const vaRate = baseRate - 0.5;
    const vaMonthlyRate = vaRate / 100 / 12;
    const vaPI = (loanAmount * vaMonthlyRate * Math.pow(1 + vaMonthlyRate, numPayments)) / 
                 (Math.pow(1 + vaMonthlyRate, numPayments) - 1);
    const vaTotal = vaPI + propertyTax + homeInsurance;

    scenarios.push({
      loanType: "va",
      loanTerm: 30,
      interestRate: vaRate.toFixed(3),
      apr: vaRate.toFixed(3),
      points: "0",
      pointsCost: "0",
      monthlyPayment: vaTotal.toFixed(2),
      principalAndInterest: vaPI.toFixed(2),
      propertyTax: propertyTax.toFixed(2),
      homeInsurance: homeInsurance.toFixed(2),
      pmi: "0",
      loanAmount: loanAmount.toFixed(2),
      closingCosts: (loanAmount * 0.025).toFixed(2),
      cashToClose: (downPayment + loanAmount * 0.025).toFixed(2),
      totalInterestPaid: ((vaPI * numPayments) - loanAmount).toFixed(2),
      downPaymentAmount: downPayment.toFixed(2),
      downPaymentPercent: downPaymentPercent.toFixed(2),
      isRecommended: input.isVeteran,
    });
  }

  return {
    isApproved,
    preApprovalAmount: isApproved ? purchasePrice.toFixed(2) : "0",
    dtiRatio: dtiRatio.toFixed(2),
    ltvRatio: ltvRatio.toFixed(2),
    analysis: {
      strengths: [
        `Credit score: ${creditScore}`,
        `Employment duration: ${input.employmentYears} years`,
        `Down payment: ${downPaymentPercent.toFixed(1)}%`,
      ],
      concerns: dtiRatio > 36 
        ? [`Computed DTI: ${dtiRatio.toFixed(1)}%, above 36% guideline threshold`] 
        : [],
      recommendations: ltvRatio > 80 
        ? [`PMI applies at current LTV of ${ltvRatio.toFixed(1)}%`]
        : [],
    },
    scenarios,
  };
}
