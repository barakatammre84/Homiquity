import { storage } from "../storage";
import { calculateLLPA } from "../pricing";
import type { LoanApplication } from "@shared/schema";

export interface LoanEstimateData {
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
    years1Through5: {
      principalAndInterest: number;
      mortgageInsurance: number;
      estimatedEscrow: number;
      estimatedTotal: number;
    };
    years6Through30?: {
      principalAndInterest: number;
      mortgageInsurance: number;
      estimatedEscrow: number;
      estimatedTotal: number;
    };
  };
  
  costsAtClosing: {
    estimatedClosingCosts: number;
    estimatedCashToClose: number;
  };
  
  closingCostDetails: {
    loanCosts: {
      originationCharges: {
        points: number;
        applicationFee: number;
        underwritingFee: number;
        total: number;
      };
      servicesYouCannotShopFor: {
        appraisal: number;
        creditReport: number;
        floodDetermination: number;
        taxService: number;
        total: number;
      };
      servicesYouCanShopFor: {
        titleInsurance: number;
        titleSearch: number;
        surveyFee: number;
        pestInspection: number;
        total: number;
      };
      totalLoanCosts: number;
    };
    otherCosts: {
      taxesAndGovernmentFees: {
        recordingFees: number;
        transferTaxes: number;
        total: number;
      };
      prepaids: {
        homeownersInsurance: number;
        mortgageInsurance: number;
        prepaidInterest: number;
        propertyTaxes: number;
        total: number;
      };
      initialEscrowPaymentAtClosing: {
        homeownersInsurance: number;
        mortgageInsurance: number;
        propertyTaxes: number;
        total: number;
      };
      otherItems: {
        ownersTitleInsurance: number;
        total: number;
      };
      totalOtherCosts: number;
    };
    totalClosingCosts: number;
  };
  
  cashToClose: {
    totalClosingCosts: number;
    closingCostsPaidBeforeClosing: number;
    downPayment: number;
    deposit: number;
    fundsFromBorrower: number;
    sellerCredits: number;
    adjustmentsAndOtherCredits: number;
    cashToClose: number;
  };
  
  appraisedPropertyValue: number;
  estimatedPropertyTaxes: number;
  homeownersInsurance: number;
  
  comparisons: {
    inFiveYears: {
      totalYouWillHavePaid: number;
      principalPaidOff: number;
    };
    apr: number;
    totalInterestPercentage: number;
  };
  
  lenderCredits: number;
  
  tridCompliance: {
    disclosureProvided: boolean;
    dateProvided: Date | null;
    withinThreeBusinessDays: boolean;
    applicationDate: Date;
  };
}

function calculateMonthlyPayment(principal: number, annualRate: number, termMonths: number): number {
  if (annualRate === 0) return principal / termMonths;
  const monthlyRate = annualRate / 12 / 100;
  return principal * (monthlyRate * Math.pow(1 + monthlyRate, termMonths)) / 
    (Math.pow(1 + monthlyRate, termMonths) - 1);
}

function calculatePMI(loanAmount: number, propertyValue: number, creditScore: number): number {
  const ltv = (loanAmount / propertyValue) * 100;
  if (ltv <= 80) return 0;
  
  let rate = 0;
  if (creditScore >= 760) {
    rate = ltv > 95 ? 1.05 : ltv > 90 ? 0.80 : ltv > 85 ? 0.52 : 0.35;
  } else if (creditScore >= 720) {
    rate = ltv > 95 ? 1.35 : ltv > 90 ? 1.05 : ltv > 85 ? 0.68 : 0.45;
  } else if (creditScore >= 680) {
    rate = ltv > 95 ? 1.85 : ltv > 90 ? 1.40 : ltv > 85 ? 0.95 : 0.65;
  } else {
    rate = ltv > 95 ? 2.45 : ltv > 90 ? 1.90 : ltv > 85 ? 1.35 : 0.95;
  }
  
  return (loanAmount * rate / 100) / 12;
}

function estimateClosingDate(): Date {
  const closingDate = new Date();
  closingDate.setDate(closingDate.getDate() + 30);
  return closingDate;
}

function calculatePrepaidInterest(loanAmount: number, rate: number, closingDate: Date): number {
  const daysInMonth = new Date(closingDate.getFullYear(), closingDate.getMonth() + 1, 0).getDate();
  const daysRemaining = daysInMonth - closingDate.getDate();
  const dailyInterest = (loanAmount * (rate / 100)) / 365;
  return dailyInterest * daysRemaining;
}

export async function generateLoanEstimate(applicationId: string): Promise<LoanEstimateData> {
  const application = await storage.getLoanApplication(applicationId);
  if (!application) {
    throw new Error("Application not found");
  }

  const purchasePrice = Number(application.purchasePrice);
  if (!purchasePrice || purchasePrice <= 0) {
    throw new Error("Purchase price is required to generate a loan estimate");
  }
  const downPayment = Number(application.downPayment);
  if (isNaN(downPayment) || downPayment < 0) {
    throw new Error("Down payment is required to generate a loan estimate");
  }
  const loanAmount = purchasePrice - downPayment;
  if (loanAmount <= 0) {
    throw new Error("Loan amount must be positive (purchase price must exceed down payment)");
  }
  const creditScore = application.creditScore;
  if (!creditScore) {
    throw new Error("Credit score is required to generate a loan estimate");
  }
  const propertyState = application.propertyState;
  if (!propertyState) {
    throw new Error("Property state is required to generate a loan estimate");
  }
  
  const ltv = (loanAmount / purchasePrice) * 100;
  const isVeteran = application.isVeteran || false;
  const loanType = application.preferredLoanType || "conventional";
  
  let baseRate = 6.875;
  if (loanType === "va") baseRate = 6.250;
  else if (loanType === "fha") baseRate = 6.500;
  
  if (creditScore >= 780) baseRate -= 0.25;
  else if (creditScore >= 760) baseRate -= 0.125;
  else if (creditScore < 680) baseRate += 0.375;
  else if (creditScore < 700) baseRate += 0.25;
  
  const propertyType = (application.propertyType || "single_family") as "single_family" | "condo" | "townhouse" | "multi_family";
  
  const llpaResult = calculateLLPA(
    loanAmount,
    creditScore,
    ltv,
    propertyType,
    "primary_residence",
    application.isFirstTimeBuyer || false
  );
  
  baseRate += llpaResult.totalLLPA * 0.125;
  const interestRate = Math.round(baseRate * 1000) / 1000;
  
  const termMonths = 360;
  const monthlyPandI = calculateMonthlyPayment(loanAmount, interestRate, termMonths);
  const monthlyPMI = calculatePMI(loanAmount, purchasePrice, creditScore);
  
  const annualPropertyTax = purchasePrice * 0.012;
  const monthlyPropertyTax = annualPropertyTax / 12;
  const annualHomeownersInsurance = Math.max(1200, purchasePrice * 0.003);
  const monthlyHomeownersInsurance = annualHomeownersInsurance / 12;
  
  const monthlyEscrow = monthlyPropertyTax + monthlyHomeownersInsurance;
  const monthlyTotal = monthlyPandI + monthlyPMI + monthlyEscrow;
  
  const originationFee = loanAmount * 0.01;
  const points = 0;
  const applicationFee = 500;
  const underwritingFee = 1500;
  const appraisalFee = 650;
  const creditReportFee = 75;
  const floodDeterminationFee = 25;
  const taxServiceFee = 100;
  const titleInsurance = loanAmount * 0.005;
  const titleSearch = 350;
  const surveyFee = 450;
  const pestInspectionFee = 150;
  const recordingFees = 150;
  const transferTaxes = purchasePrice * 0.001;
  
  const closingDate = estimateClosingDate();
  const prepaidInterest = calculatePrepaidInterest(loanAmount, interestRate, closingDate);
  const prepaidHomeownersInsurance = annualHomeownersInsurance;
  const prepaidMortgageInsurance = monthlyPMI * 2;
  const prepaidPropertyTaxes = monthlyPropertyTax * 2;
  
  const escrowHomeownersInsurance = monthlyHomeownersInsurance * 3;
  const escrowMortgageInsurance = monthlyPMI * 2;
  const escrowPropertyTaxes = monthlyPropertyTax * 3;
  
  const ownersTitleInsurance = purchasePrice * 0.003;
  
  const loanCostsTotal = originationFee + points + applicationFee + underwritingFee +
    appraisalFee + creditReportFee + floodDeterminationFee + taxServiceFee +
    titleInsurance + titleSearch + surveyFee + pestInspectionFee;
  
  const otherCostsTotal = recordingFees + transferTaxes +
    prepaidHomeownersInsurance + prepaidMortgageInsurance + prepaidInterest + prepaidPropertyTaxes +
    escrowHomeownersInsurance + escrowMortgageInsurance + escrowPropertyTaxes +
    ownersTitleInsurance;
  
  const totalClosingCosts = loanCostsTotal + otherCostsTotal;
  
  const lenderCredits = llpaResult.fthbWaiver > 0 ? llpaResult.fthbWaiver * loanAmount / 100 : 0;
  
  const cashToClose = totalClosingCosts + downPayment - lenderCredits;
  
  const totalPaidIn5Years = (monthlyTotal * 60) + totalClosingCosts;
  
  let principalPaidOff = 0;
  let balance = loanAmount;
  const monthlyRate = interestRate / 12 / 100;
  for (let i = 0; i < 60; i++) {
    const interestPayment = balance * monthlyRate;
    const principalPayment = monthlyPandI - interestPayment;
    balance -= principalPayment;
    principalPaidOff += principalPayment;
  }
  
  const totalInterest = (monthlyPandI * termMonths) - loanAmount;
  const totalInterestPercentage = (totalInterest / loanAmount) * 100;
  
  const apr = interestRate + (totalClosingCosts / loanAmount / 30 * 100 * 0.1);
  
  const applicationDate = application.createdAt ? new Date(application.createdAt) : new Date();
  const threeDaysLater = new Date(applicationDate);
  threeDaysLater.setDate(threeDaysLater.getDate() + 3);
  
  const now = new Date();
  const dateIssued = now;
  const expirationDate = new Date(now);
  expirationDate.setDate(expirationDate.getDate() + 10);
  
  return {
    applicationId,
    dateIssued,
    expirationDate,
    
    loanTerms: {
      loanAmount,
      interestRate,
      monthlyPrincipalAndInterest: Math.round(monthlyPandI * 100) / 100,
      prepaymentPenalty: false,
      balloonPayment: false,
    },
    
    projectedPayments: {
      years1Through5: {
        principalAndInterest: Math.round(monthlyPandI * 100) / 100,
        mortgageInsurance: Math.round(monthlyPMI * 100) / 100,
        estimatedEscrow: Math.round(monthlyEscrow * 100) / 100,
        estimatedTotal: Math.round(monthlyTotal * 100) / 100,
      },
      years6Through30: ltv > 78 ? undefined : {
        principalAndInterest: Math.round(monthlyPandI * 100) / 100,
        mortgageInsurance: 0,
        estimatedEscrow: Math.round(monthlyEscrow * 100) / 100,
        estimatedTotal: Math.round((monthlyPandI + monthlyEscrow) * 100) / 100,
      },
    },
    
    costsAtClosing: {
      estimatedClosingCosts: Math.round(totalClosingCosts),
      estimatedCashToClose: Math.round(cashToClose),
    },
    
    closingCostDetails: {
      loanCosts: {
        originationCharges: {
          points: Math.round(points),
          applicationFee: Math.round(applicationFee),
          underwritingFee: Math.round(underwritingFee),
          total: Math.round(originationFee + points + applicationFee + underwritingFee),
        },
        servicesYouCannotShopFor: {
          appraisal: Math.round(appraisalFee),
          creditReport: Math.round(creditReportFee),
          floodDetermination: Math.round(floodDeterminationFee),
          taxService: Math.round(taxServiceFee),
          total: Math.round(appraisalFee + creditReportFee + floodDeterminationFee + taxServiceFee),
        },
        servicesYouCanShopFor: {
          titleInsurance: Math.round(titleInsurance),
          titleSearch: Math.round(titleSearch),
          surveyFee: Math.round(surveyFee),
          pestInspection: Math.round(pestInspectionFee),
          total: Math.round(titleInsurance + titleSearch + surveyFee + pestInspectionFee),
        },
        totalLoanCosts: Math.round(loanCostsTotal),
      },
      otherCosts: {
        taxesAndGovernmentFees: {
          recordingFees: Math.round(recordingFees),
          transferTaxes: Math.round(transferTaxes),
          total: Math.round(recordingFees + transferTaxes),
        },
        prepaids: {
          homeownersInsurance: Math.round(prepaidHomeownersInsurance),
          mortgageInsurance: Math.round(prepaidMortgageInsurance),
          prepaidInterest: Math.round(prepaidInterest),
          propertyTaxes: Math.round(prepaidPropertyTaxes),
          total: Math.round(prepaidHomeownersInsurance + prepaidMortgageInsurance + prepaidInterest + prepaidPropertyTaxes),
        },
        initialEscrowPaymentAtClosing: {
          homeownersInsurance: Math.round(escrowHomeownersInsurance),
          mortgageInsurance: Math.round(escrowMortgageInsurance),
          propertyTaxes: Math.round(escrowPropertyTaxes),
          total: Math.round(escrowHomeownersInsurance + escrowMortgageInsurance + escrowPropertyTaxes),
        },
        otherItems: {
          ownersTitleInsurance: Math.round(ownersTitleInsurance),
          total: Math.round(ownersTitleInsurance),
        },
        totalOtherCosts: Math.round(otherCostsTotal),
      },
      totalClosingCosts: Math.round(totalClosingCosts),
    },
    
    cashToClose: {
      totalClosingCosts: Math.round(totalClosingCosts),
      closingCostsPaidBeforeClosing: 0,
      downPayment: Math.round(downPayment),
      deposit: 0,
      fundsFromBorrower: Math.round(downPayment + totalClosingCosts),
      sellerCredits: 0,
      adjustmentsAndOtherCredits: Math.round(lenderCredits),
      cashToClose: Math.round(cashToClose),
    },
    
    appraisedPropertyValue: purchasePrice,
    estimatedPropertyTaxes: Math.round(annualPropertyTax),
    homeownersInsurance: Math.round(annualHomeownersInsurance),
    
    comparisons: {
      inFiveYears: {
        totalYouWillHavePaid: Math.round(totalPaidIn5Years),
        principalPaidOff: Math.round(principalPaidOff),
      },
      apr: Math.round(apr * 1000) / 1000,
      totalInterestPercentage: Math.round(totalInterestPercentage * 10) / 10,
    },
    
    lenderCredits: Math.round(lenderCredits),
    
    tridCompliance: {
      disclosureProvided: false,
      dateProvided: null,
      withinThreeBusinessDays: now <= threeDaysLater,
      applicationDate,
    },
  };
}

export function formatLoanEstimateForDisplay(le: LoanEstimateData) {
  return {
    ...le,
    loanTerms: {
      ...le.loanTerms,
      loanAmountFormatted: `$${le.loanTerms.loanAmount.toLocaleString()}`,
      interestRateFormatted: `${le.loanTerms.interestRate}%`,
      monthlyPIFormatted: `$${le.loanTerms.monthlyPrincipalAndInterest.toLocaleString()}`,
    },
    costsAtClosing: {
      ...le.costsAtClosing,
      estimatedClosingCostsFormatted: `$${le.costsAtClosing.estimatedClosingCosts.toLocaleString()}`,
      estimatedCashToCloseFormatted: `$${le.costsAtClosing.estimatedCashToClose.toLocaleString()}`,
    },
  };
}
