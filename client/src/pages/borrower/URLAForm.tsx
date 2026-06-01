import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AddressInput } from "@/components/AddressInput";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { LoanApplication, UrlaPersonalInfo, EmploymentHistory, UrlaAsset, UrlaLiability, UrlaPropertyInfo, OtherIncomeSource } from "@shared/schema";
import {
  User,
  Briefcase,
  DollarSign,
  Home,
  FileText,
  Percent,
  Save,
  Plus,
  Trash2,
  Loader2,
} from "lucide-react";

interface DashboardData {
  applications: LoanApplication[];
}

interface UrlaData {
  application: LoanApplication;
  personalInfo: UrlaPersonalInfo | null;
  employmentHistory: EmploymentHistory[];
  otherIncomeSources: OtherIncomeSource[];
  assets: UrlaAsset[];
  liabilities: UrlaLiability[];
  propertyInfo: UrlaPropertyInfo | null;
}

interface UrlaSavePayload {
  personalInfo: Partial<UrlaPersonalInfo>;
  employmentHistory: Partial<EmploymentHistory>[];
  assets: Partial<UrlaAsset>[];
  liabilities: Partial<UrlaLiability>[];
  otherIncomeSources: Partial<OtherIncomeSource>[];
  propertyInfo: Partial<UrlaPropertyInfo>;
}

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
];

const ACCOUNT_TYPES = [
  "Checking", "Savings", "Money Market", "Certificate of Deposit",
  "Mutual Fund", "Stocks", "Stock Options", "Bonds",
  "Retirement (e.g., 401k, IRA)", "Bridge Loan Proceeds",
  "Individual Development Account", "Trust Account",
  "Cash Value of Life Insurance"
];

const LIABILITY_TYPES = [
  "Revolving (Credit Card)", "Installment (Auto Loan)", 
  "Student Loan", "Mortgage", "HELOC", 
  "Alimony", "Child Support", "Other"
];

const INCOME_SOURCES = [
  "Alimony", "Child Support", "Interest and Dividends", "Notes Receivable",
  "Royalty Payments", "Unemployment Benefits", "Automobile Allowance",
  "Disability", "Mortgage Credit Certificate", "Public Assistance",
  "Retirement (e.g., Pension, IRA)", "Social Security", "Boarder Income",
  "Foster Care", "Housing or Parsonage", "Separate Maintenance",
  "Trust", "VA Compensation", "Capital Gains", "Other"
];

export default function URLAForm() {
  const { isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const { data: dashboardData, isLoading: dashboardLoading } = useQuery<DashboardData>({
    queryKey: ["/api/dashboard"],
    enabled: !authLoading,
  });

  const applications = dashboardData?.applications || [];
  const activeApplication = applications.find(
    (app) => !["closed", "denied"].includes(app.status)
  );

  const { data: urlaData, isLoading: urlaLoading } = useQuery<UrlaData>({
    queryKey: ['/api/urla', activeApplication?.id],
    enabled: !!activeApplication?.id,
  });

  const [personalInfo, setPersonalInfo] = useState<Partial<UrlaPersonalInfo>>({});
  const [employmentRecords, setEmploymentRecords] = useState<Partial<EmploymentHistory>[]>([{}]);
  const [otherIncomes, setOtherIncomes] = useState<Partial<OtherIncomeSource>[]>([]);
  const [assets, setAssets] = useState<Partial<UrlaAsset>[]>([{}]);
  const [liabilities, setLiabilities] = useState<Partial<UrlaLiability>[]>([{}]);
  const [propertyInfo, setPropertyInfo] = useState<Partial<UrlaPropertyInfo>>({});

  useEffect(() => {
    if (urlaData) {
      setPersonalInfo(urlaData.personalInfo || {});
      setEmploymentRecords(urlaData.employmentHistory?.length ? urlaData.employmentHistory : [{}]);
      setOtherIncomes(urlaData.otherIncomeSources?.length ? urlaData.otherIncomeSources : []);
      setAssets(urlaData.assets?.length ? urlaData.assets : [{}]);
      setLiabilities(urlaData.liabilities?.length ? urlaData.liabilities : [{}]);
      setPropertyInfo(urlaData.propertyInfo || {});
    }
  }, [urlaData, activeApplication?.id]);

  const saveMutation = useMutation({
    mutationFn: async (data: UrlaSavePayload) => {
      const response = await apiRequest("POST", `/api/urla/${activeApplication?.id}/save`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "URLA Saved",
        description: "Your Uniform Residential Loan Application has been saved successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/urla', activeApplication?.id] });
    },
    onError: () => {
      toast({
        title: "Save Failed",
        description: "There was an error saving your application. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    const cleanedEmployment = employmentRecords.filter(emp => emp.employerName || emp.positionTitle);
    const cleanedAssets = assets.filter(asset => asset.accountType || asset.financialInstitution);
    const cleanedLiabilities = liabilities.filter(liability => liability.liabilityType || liability.creditorName);
    const cleanedOtherIncomes = otherIncomes.filter(income => income.incomeSource && income.monthlyAmount);

    saveMutation.mutate({
      personalInfo,
      employmentHistory: cleanedEmployment.map(emp => ({
        ...emp,
        employmentType: emp.employmentType || "current",
      })),
      assets: cleanedAssets,
      liabilities: cleanedLiabilities,
      otherIncomeSources: cleanedOtherIncomes,
      propertyInfo,
    });
  };

  if (authLoading || dashboardLoading || urlaLoading) {
    return (
      <div className="p-8">
        <Skeleton className="mb-8 h-8 w-48" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!activeApplication) {
    return (
      <div className="p-8">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-lg font-medium">No active application</p>
            <p className="text-sm text-muted-foreground mt-2">
              Start a pre-approval application to access the URLA form.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const app = urlaData?.application || activeApplication;

  return (
    <>
      <div className="border-b p-4 sm:p-6 lg:p-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  Uniform Residential Loan Application
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Freddie Mac Form 65 / Fannie Mae Form 1003 (Effective 1/2021)
                </p>
              </div>
              <Button onClick={handleSave} disabled={saveMutation.isPending} className="gap-2" data-testid="button-save-urla-top">
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save URLA
              </Button>
            </div>
          </div>

          <div className="p-4 sm:p-6 lg:p-8">
            <Tabs defaultValue="borrower" className="space-y-6">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="borrower" className="gap-2" data-testid="tab-borrower">
                  <User className="h-4 w-4" />
                  <span className="hidden sm:inline">Borrower</span>
                </TabsTrigger>
                <TabsTrigger value="employment" className="gap-2" data-testid="tab-employment">
                  <Briefcase className="h-4 w-4" />
                  <span className="hidden sm:inline">Employment</span>
                </TabsTrigger>
                <TabsTrigger value="assets" className="gap-2" data-testid="tab-assets">
                  <DollarSign className="h-4 w-4" />
                  <span className="hidden sm:inline">Assets</span>
                </TabsTrigger>
                <TabsTrigger value="liabilities" className="gap-2" data-testid="tab-liabilities">
                  <Percent className="h-4 w-4" />
                  <span className="hidden sm:inline">Liabilities</span>
                </TabsTrigger>
                <TabsTrigger value="property" className="gap-2" data-testid="tab-property">
                  <Home className="h-4 w-4" />
                  <span className="hidden sm:inline">Property</span>
                </TabsTrigger>
              </TabsList>

              {/* Section 1a: Personal Information */}
              <TabsContent value="borrower" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Section 1a: Personal Information</CardTitle>
                    <CardDescription>
                      This section asks about your personal information to qualify for this loan.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="space-y-2">
                        <Label htmlFor="borrower-first-name">First Name</Label>
                        <Input
                          id="borrower-first-name"
                          placeholder="First Name"
                          value={personalInfo.firstName || ""}
                          onChange={(e) => setPersonalInfo({ ...personalInfo, firstName: e.target.value })}
                          data-testid="input-borrower-first-name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="borrower-middle-name">Middle Name</Label>
                        <Input
                          id="borrower-middle-name"
                          placeholder="Middle Name"
                          value={personalInfo.middleName || ""}
                          onChange={(e) => setPersonalInfo({ ...personalInfo, middleName: e.target.value })}
                          data-testid="input-borrower-middle-name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="borrower-last-name">Last Name</Label>
                        <Input
                          id="borrower-last-name"
                          placeholder="Last Name"
                          value={personalInfo.lastName || ""}
                          onChange={(e) => setPersonalInfo({ ...personalInfo, lastName: e.target.value })}
                          data-testid="input-borrower-last-name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="borrower-suffix">Suffix</Label>
                        <Input
                          id="borrower-suffix"
                          placeholder="Jr., Sr., III, etc."
                          value={personalInfo.suffix || ""}
                          onChange={(e) => setPersonalInfo({ ...personalInfo, suffix: e.target.value })}
                          data-testid="input-borrower-suffix"
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <div className="space-y-2">
                        <Label htmlFor="ssn">Social Security Number</Label>
                        <Input
                          id="ssn"
                          placeholder="XXX-XX-XXXX"
                          value={personalInfo.ssn || ""}
                          onChange={(e) => setPersonalInfo({ ...personalInfo, ssn: e.target.value })}
                          data-testid="input-ssn"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="dob">Date of Birth</Label>
                        <Input
                          id="dob"
                          type="date"
                          value={personalInfo.dateOfBirth || ""}
                          onChange={(e) => setPersonalInfo({ ...personalInfo, dateOfBirth: e.target.value })}
                          data-testid="input-dob"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="citizenship">Citizenship</Label>
                        <Select
                          value={personalInfo.citizenship || ""}
                          onValueChange={(value) => setPersonalInfo({ ...personalInfo, citizenship: value })}
                        >
                          <SelectTrigger id="citizenship" data-testid="select-citizenship">
                            <SelectValue placeholder="Select..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="us_citizen">U.S. Citizen</SelectItem>
                            <SelectItem value="permanent_resident">Permanent Resident Alien</SelectItem>
                            <SelectItem value="non_permanent_resident">Non-Permanent Resident Alien</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <hr />

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="credit-type">Type of Credit</Label>
                        <Select
                          value={personalInfo.creditType || ""}
                          onValueChange={(value) => setPersonalInfo({ ...personalInfo, creditType: value })}
                        >
                          <SelectTrigger id="credit-type" data-testid="select-credit-type">
                            <SelectValue placeholder="Select..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="individual">I am applying for individual credit</SelectItem>
                            <SelectItem value="joint">I am applying for joint credit</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="marital-status">Marital Status</Label>
                        <Select
                          value={personalInfo.maritalStatus || ""}
                          onValueChange={(value) => setPersonalInfo({ ...personalInfo, maritalStatus: value })}
                        >
                          <SelectTrigger id="marital-status" data-testid="select-marital-status">
                            <SelectValue placeholder="Select..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="married">Married</SelectItem>
                            <SelectItem value="separated">Separated</SelectItem>
                            <SelectItem value="unmarried">Unmarried (Single, Divorced, Widowed)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="dependents">Number of Dependents</Label>
                        <Input
                          id="dependents"
                          type="number"
                          min="0"
                          value={personalInfo.numberOfDependents ?? ""}
                          onChange={(e) => setPersonalInfo({ ...personalInfo, numberOfDependents: parseInt(e.target.value) || 0 })}
                          data-testid="input-dependents"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="dependent-ages">Ages of Dependents</Label>
                        <Input
                          id="dependent-ages"
                          placeholder="e.g., 12, 8, 5"
                          value={personalInfo.dependentAges || ""}
                          onChange={(e) => setPersonalInfo({ ...personalInfo, dependentAges: e.target.value })}
                          data-testid="input-dependent-ages"
                        />
                      </div>
                    </div>

                    <hr />

                    <h4 className="font-semibold">Contact Information</h4>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <div className="space-y-2">
                        <Label htmlFor="home-phone">Home Phone</Label>
                        <Input
                          id="home-phone"
                          placeholder="(xxx) xxx-xxxx"
                          value={personalInfo.homePhone || ""}
                          onChange={(e) => setPersonalInfo({ ...personalInfo, homePhone: e.target.value })}
                          data-testid="input-home-phone"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="cell-phone">Cell Phone</Label>
                        <Input
                          id="cell-phone"
                          placeholder="(xxx) xxx-xxxx"
                          value={personalInfo.cellPhone || ""}
                          onChange={(e) => setPersonalInfo({ ...personalInfo, cellPhone: e.target.value })}
                          data-testid="input-cell-phone"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="email@example.com"
                          value={personalInfo.email || ""}
                          onChange={(e) => setPersonalInfo({ ...personalInfo, email: e.target.value })}
                          data-testid="input-email"
                        />
                      </div>
                    </div>

                    <hr />

                    <h4 className="font-semibold">Current Address</h4>
                    <div className="mb-3">
                      <Label>Search Address</Label>
                      <AddressInput
                        placeholder="Start typing your current address..."
                        defaultValue={personalInfo.currentStreet || ""}
                        onSelect={(result) => setPersonalInfo({
                          ...personalInfo,
                          currentStreet: result.streetAddress || result.formattedAddress,
                          currentCity: result.city,
                          currentState: result.state,
                          currentZip: result.zip,
                        })}
                      />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="sm:col-span-2 space-y-2">
                        <Label htmlFor="current-street">Street Address</Label>
                        <Input
                          id="current-street"
                          placeholder="Street Address"
                          value={personalInfo.currentStreet || ""}
                          onChange={(e) => setPersonalInfo({ ...personalInfo, currentStreet: e.target.value })}
                          data-testid="input-current-street"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="current-unit">Unit #</Label>
                        <Input
                          id="current-unit"
                          placeholder="Unit #"
                          value={personalInfo.currentUnit || ""}
                          onChange={(e) => setPersonalInfo({ ...personalInfo, currentUnit: e.target.value })}
                          data-testid="input-current-unit"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="current-city">City</Label>
                        <Input
                          id="current-city"
                          placeholder="City"
                          value={personalInfo.currentCity || ""}
                          onChange={(e) => setPersonalInfo({ ...personalInfo, currentCity: e.target.value })}
                          data-testid="input-current-city"
                        />
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="space-y-2">
                        <Label htmlFor="current-state">State</Label>
                        <Select
                          value={personalInfo.currentState || ""}
                          onValueChange={(value) => setPersonalInfo({ ...personalInfo, currentState: value })}
                        >
                          <SelectTrigger id="current-state" data-testid="select-current-state">
                            <SelectValue placeholder="State" />
                          </SelectTrigger>
                          <SelectContent>
                            {US_STATES.map((state) => (
                              <SelectItem key={state} value={state}>{state}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="current-zip">ZIP Code</Label>
                        <Input
                          id="current-zip"
                          placeholder="ZIP"
                          value={personalInfo.currentZip || ""}
                          onChange={(e) => setPersonalInfo({ ...personalInfo, currentZip: e.target.value })}
                          data-testid="input-current-zip"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="current-years">Years at Address</Label>
                        <Input
                          id="current-years"
                          type="number"
                          min="0"
                          value={personalInfo.currentAddressYears ?? ""}
                          onChange={(e) => setPersonalInfo({ ...personalInfo, currentAddressYears: parseInt(e.target.value) || 0 })}
                          data-testid="input-current-years"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="current-housing">Housing</Label>
                        <Select
                          value={personalInfo.currentHousingType || ""}
                          onValueChange={(value) => setPersonalInfo({ ...personalInfo, currentHousingType: value })}
                        >
                          <SelectTrigger id="current-housing" data-testid="select-current-housing">
                            <SelectValue placeholder="Select..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="own">Own</SelectItem>
                            <SelectItem value="rent">Rent</SelectItem>
                            <SelectItem value="no_expense">No Primary Housing Expense</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Section 1b-1e: Employment and Income */}
              <TabsContent value="employment" className="space-y-6">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Section 1b: Current Employment/Self-Employment and Income</CardTitle>
                        <CardDescription>
                          Provide at least 2 years of current and previous employment and income.
                        </CardDescription>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEmploymentRecords([...employmentRecords, { employmentType: "additional" }])}
                        data-testid="button-add-employment"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Employment
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {employmentRecords.map((emp, index) => (
                      <div key={index} className="border rounded-lg p-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold">
                            {index === 0 ? "Current Employment" : `Additional Employment ${index}`}
                          </h4>
                          {index > 0 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setEmploymentRecords(employmentRecords.filter((_, i) => i !== index))}
                              data-testid={`button-remove-employment-${index}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                          <div className="sm:col-span-2 space-y-2">
                            <Label>Employer or Business Name</Label>
                            <Input
                              placeholder="Employer Name"
                              value={emp.employerName || (index === 0 ? app.employerName || "" : "")}
                              onChange={(e) => {
                                const updated = [...employmentRecords];
                                updated[index] = { ...updated[index], employerName: e.target.value };
                                setEmploymentRecords(updated);
                              }}
                              data-testid={`input-employer-name-${index}`}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Phone</Label>
                            <Input
                              placeholder="(xxx) xxx-xxxx"
                              value={emp.employerPhone || ""}
                              onChange={(e) => {
                                const updated = [...employmentRecords];
                                updated[index] = { ...updated[index], employerPhone: e.target.value };
                                setEmploymentRecords(updated);
                              }}
                              data-testid={`input-employer-phone-${index}`}
                            />
                          </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                          <div className="sm:col-span-2 space-y-2">
                            <Label>Street Address</Label>
                            <Input
                              placeholder="Street Address"
                              value={emp.employerStreet || ""}
                              onChange={(e) => {
                                const updated = [...employmentRecords];
                                updated[index] = { ...updated[index], employerStreet: e.target.value };
                                setEmploymentRecords(updated);
                              }}
                              data-testid={`input-employer-street-${index}`}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>City</Label>
                            <Input
                              placeholder="City"
                              value={emp.employerCity || ""}
                              onChange={(e) => {
                                const updated = [...employmentRecords];
                                updated[index] = { ...updated[index], employerCity: e.target.value };
                                setEmploymentRecords(updated);
                              }}
                              data-testid={`input-employer-city-${index}`}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>State</Label>
                            <Select
                              value={emp.employerState || ""}
                              onValueChange={(value) => {
                                const updated = [...employmentRecords];
                                updated[index] = { ...updated[index], employerState: value };
                                setEmploymentRecords(updated);
                              }}
                            >
                              <SelectTrigger data-testid={`select-employer-state-${index}`}>
                                <SelectValue placeholder="State" />
                              </SelectTrigger>
                              <SelectContent>
                                {US_STATES.map((state) => (
                                  <SelectItem key={state} value={state}>{state}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                          <div className="space-y-2">
                            <Label>Position or Title</Label>
                            <Input
                              placeholder="Position Title"
                              value={emp.positionTitle || ""}
                              onChange={(e) => {
                                const updated = [...employmentRecords];
                                updated[index] = { ...updated[index], positionTitle: e.target.value };
                                setEmploymentRecords(updated);
                              }}
                              data-testid={`input-position-${index}`}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Start Date</Label>
                            <Input
                              type="date"
                              value={emp.startDate || ""}
                              onChange={(e) => {
                                const updated = [...employmentRecords];
                                updated[index] = { ...updated[index], startDate: e.target.value };
                                setEmploymentRecords(updated);
                              }}
                              data-testid={`input-start-date-${index}`}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Years in Line of Work</Label>
                            <Input
                              type="number"
                              min="0"
                              value={emp.yearsInLineOfWork ?? (index === 0 ? app.employmentYears || "" : "")}
                              onChange={(e) => {
                                const updated = [...employmentRecords];
                                updated[index] = { ...updated[index], yearsInLineOfWork: parseInt(e.target.value) || 0 };
                                setEmploymentRecords(updated);
                              }}
                              data-testid={`input-years-work-${index}`}
                            />
                          </div>
                          <div className="flex items-center gap-2 pt-6">
                            <Checkbox
                              id={`self-employed-${index}`}
                              checked={emp.isSelfEmployed || app.employmentType === "self_employed"}
                              onCheckedChange={(checked) => {
                                const updated = [...employmentRecords];
                                updated[index] = { ...updated[index], isSelfEmployed: !!checked };
                                setEmploymentRecords(updated);
                              }}
                              data-testid={`checkbox-self-employed-${index}`}
                            />
                            <Label htmlFor={`self-employed-${index}`} className="font-normal">Self-Employed</Label>
                          </div>
                        </div>

                        <hr />

                        <h5 className="font-medium">Gross Monthly Income</h5>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                          <div className="space-y-2">
                            <Label>Base Income</Label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                              <Input
                                className="pl-7"
                                placeholder="0.00"
                                value={emp.baseIncome || (index === 0 ? (parseFloat(app.annualIncome || "0") / 12).toFixed(0) : "")}
                                onChange={(e) => {
                                  const updated = [...employmentRecords];
                                  updated[index] = { ...updated[index], baseIncome: e.target.value };
                                  setEmploymentRecords(updated);
                                }}
                                data-testid={`input-base-income-${index}`}
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>Overtime</Label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                              <Input
                                className="pl-7"
                                placeholder="0.00"
                                value={emp.overtimeIncome || ""}
                                onChange={(e) => {
                                  const updated = [...employmentRecords];
                                  updated[index] = { ...updated[index], overtimeIncome: e.target.value };
                                  setEmploymentRecords(updated);
                                }}
                                data-testid={`input-overtime-${index}`}
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>Bonus</Label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                              <Input
                                className="pl-7"
                                placeholder="0.00"
                                value={emp.bonusIncome || ""}
                                onChange={(e) => {
                                  const updated = [...employmentRecords];
                                  updated[index] = { ...updated[index], bonusIncome: e.target.value };
                                  setEmploymentRecords(updated);
                                }}
                                data-testid={`input-bonus-${index}`}
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>Commission</Label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                              <Input
                                className="pl-7"
                                placeholder="0.00"
                                value={emp.commissionIncome || ""}
                                onChange={(e) => {
                                  const updated = [...employmentRecords];
                                  updated[index] = { ...updated[index], commissionIncome: e.target.value };
                                  setEmploymentRecords(updated);
                                }}
                                data-testid={`input-commission-${index}`}
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>Military Entitlements</Label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                              <Input
                                className="pl-7"
                                placeholder="0.00"
                                value={emp.militaryEntitlements || ""}
                                onChange={(e) => {
                                  const updated = [...employmentRecords];
                                  updated[index] = { ...updated[index], militaryEntitlements: e.target.value };
                                  setEmploymentRecords(updated);
                                }}
                                data-testid={`input-military-${index}`}
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>Other Income</Label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                              <Input
                                className="pl-7"
                                placeholder="0.00"
                                value={emp.otherIncome || ""}
                                onChange={(e) => {
                                  const updated = [...employmentRecords];
                                  updated[index] = { ...updated[index], otherIncome: e.target.value };
                                  setEmploymentRecords(updated);
                                }}
                                data-testid={`input-other-income-${index}`}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Section 1e: Income from Other Sources</CardTitle>
                        <CardDescription>
                          Include income from other sources such as retirement, Social Security, disability, etc.
                        </CardDescription>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setOtherIncomes([...otherIncomes, {}])}
                        data-testid="button-add-other-income"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Income Source
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {otherIncomes.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No additional income sources. Click "Add Income Source" to add one.
                      </p>
                    ) : (
                      <div className="space-y-4">
                        {otherIncomes.map((income, index) => (
                          <div key={index} className="flex gap-4 items-end">
                            <div className="flex-1 space-y-2">
                              <Label>Income Source</Label>
                              <Select
                                value={income.incomeSource || ""}
                                onValueChange={(value) => {
                                  const updated = [...otherIncomes];
                                  updated[index] = { ...updated[index], incomeSource: value };
                                  setOtherIncomes(updated);
                                }}
                              >
                                <SelectTrigger data-testid={`select-income-source-${index}`}>
                                  <SelectValue placeholder="Select source..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {INCOME_SOURCES.map((source) => (
                                    <SelectItem key={source} value={source}>{source}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="flex-1 space-y-2">
                              <Label>Monthly Amount</Label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                                <Input
                                  className="pl-7"
                                  placeholder="0.00"
                                  value={income.monthlyAmount || ""}
                                  onChange={(e) => {
                                    const updated = [...otherIncomes];
                                    updated[index] = { ...updated[index], monthlyAmount: e.target.value };
                                    setOtherIncomes(updated);
                                  }}
                                  data-testid={`input-income-amount-${index}`}
                                />
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setOtherIncomes(otherIncomes.filter((_, i) => i !== index))}
                              data-testid={`button-remove-income-${index}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Section 2a: Assets */}
              <TabsContent value="assets" className="space-y-6">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Section 2a: Assets - Bank Accounts, Retirement, and Other Accounts</CardTitle>
                        <CardDescription>
                          Include all accounts that you want considered to qualify for this loan.
                        </CardDescription>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAssets([...assets, {}])}
                        data-testid="button-add-asset"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Asset
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {assets.map((asset, index) => (
                      <div key={index} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="font-medium">Asset {index + 1}</h4>
                          {index > 0 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setAssets(assets.filter((_, i) => i !== index))}
                              data-testid={`button-remove-asset-${index}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                          <div className="space-y-2">
                            <Label>Account Type</Label>
                            <Select
                              value={asset.accountType || ""}
                              onValueChange={(value) => {
                                const updated = [...assets];
                                updated[index] = { ...updated[index], accountType: value };
                                setAssets(updated);
                              }}
                            >
                              <SelectTrigger data-testid={`select-asset-type-${index}`}>
                                <SelectValue placeholder="Select type..." />
                              </SelectTrigger>
                              <SelectContent>
                                {ACCOUNT_TYPES.map((type) => (
                                  <SelectItem key={type} value={type}>{type}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Financial Institution</Label>
                            <Input
                              placeholder="Bank Name"
                              value={asset.financialInstitution || ""}
                              onChange={(e) => {
                                const updated = [...assets];
                                updated[index] = { ...updated[index], financialInstitution: e.target.value };
                                setAssets(updated);
                              }}
                              data-testid={`input-institution-${index}`}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Account Number</Label>
                            <Input
                              placeholder="Account #"
                              value={asset.accountNumber || ""}
                              onChange={(e) => {
                                const updated = [...assets];
                                updated[index] = { ...updated[index], accountNumber: e.target.value };
                                setAssets(updated);
                              }}
                              data-testid={`input-account-number-${index}`}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Cash or Market Value</Label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                              <Input
                                className="pl-7"
                                placeholder="0.00"
                                value={asset.cashOrMarketValue || ""}
                                onChange={(e) => {
                                  const updated = [...assets];
                                  updated[index] = { ...updated[index], cashOrMarketValue: e.target.value };
                                  setAssets(updated);
                                }}
                                data-testid={`input-asset-value-${index}`}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Section 2: Liabilities */}
              <TabsContent value="liabilities" className="space-y-6">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Section 2: Liabilities - Debts and Obligations</CardTitle>
                        <CardDescription>
                          Include all debts that you pay each month, such as credit cards, loans, alimony, etc.
                        </CardDescription>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setLiabilities([...liabilities, {}])}
                        data-testid="button-add-liability"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Liability
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {liabilities.map((liability, index) => (
                      <div key={index} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="font-medium">Liability {index + 1}</h4>
                          {index > 0 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setLiabilities(liabilities.filter((_, i) => i !== index))}
                              data-testid={`button-remove-liability-${index}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                          <div className="space-y-2">
                            <Label>Liability Type</Label>
                            <Select
                              value={liability.liabilityType || ""}
                              onValueChange={(value) => {
                                const updated = [...liabilities];
                                updated[index] = { ...updated[index], liabilityType: value };
                                setLiabilities(updated);
                              }}
                            >
                              <SelectTrigger data-testid={`select-liability-type-${index}`}>
                                <SelectValue placeholder="Select type..." />
                              </SelectTrigger>
                              <SelectContent>
                                {LIABILITY_TYPES.map((type) => (
                                  <SelectItem key={type} value={type}>{type}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Creditor Name</Label>
                            <Input
                              placeholder="Creditor"
                              value={liability.creditorName || ""}
                              onChange={(e) => {
                                const updated = [...liabilities];
                                updated[index] = { ...updated[index], creditorName: e.target.value };
                                setLiabilities(updated);
                              }}
                              data-testid={`input-creditor-${index}`}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Unpaid Balance</Label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                              <Input
                                className="pl-7"
                                placeholder="0.00"
                                value={liability.unpaidBalance || ""}
                                onChange={(e) => {
                                  const updated = [...liabilities];
                                  updated[index] = { ...updated[index], unpaidBalance: e.target.value };
                                  setLiabilities(updated);
                                }}
                                data-testid={`input-balance-${index}`}
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>Monthly Payment</Label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                              <Input
                                className="pl-7"
                                placeholder="0.00"
                                value={liability.monthlyPayment || ""}
                                onChange={(e) => {
                                  const updated = [...liabilities];
                                  updated[index] = { ...updated[index], monthlyPayment: e.target.value };
                                  setLiabilities(updated);
                                }}
                                data-testid={`input-monthly-payment-${index}`}
                              />
                            </div>
                          </div>
                          <div className="flex items-center gap-2 pt-6">
                            <Checkbox
                              id={`paid-off-${index}`}
                              checked={liability.toBePaidOff || false}
                              onCheckedChange={(checked) => {
                                const updated = [...liabilities];
                                updated[index] = { ...updated[index], toBePaidOff: !!checked };
                                setLiabilities(updated);
                              }}
                              data-testid={`checkbox-paid-off-${index}`}
                            />
                            <Label htmlFor={`paid-off-${index}`} className="font-normal text-sm">To be paid off</Label>
                          </div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Property Information */}
              <TabsContent value="property" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Property Information and Loan Details</CardTitle>
                    <CardDescription>
                      Information about the property you are purchasing or refinancing.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <h4 className="font-semibold">Property Address</h4>
                    <div className="mb-3">
                      <Label>Search Address</Label>
                      <AddressInput
                        placeholder="Start typing the property address..."
                        defaultValue={propertyInfo.propertyStreet || app.propertyAddress || ""}
                        onSelect={(result) => setPropertyInfo({
                          ...propertyInfo,
                          propertyStreet: result.streetAddress || result.formattedAddress,
                          propertyCity: result.city,
                          propertyState: result.state,
                          propertyZip: result.zip,
                          propertyCounty: result.county || propertyInfo.propertyCounty,
                        })}
                      />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="sm:col-span-2 space-y-2">
                        <Label htmlFor="property-street">Street Address</Label>
                        <Input
                          id="property-street"
                          placeholder="Street Address"
                          value={propertyInfo.propertyStreet || app.propertyAddress || ""}
                          onChange={(e) => setPropertyInfo({ ...propertyInfo, propertyStreet: e.target.value })}
                          data-testid="input-property-street"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="property-unit">Unit #</Label>
                        <Input
                          id="property-unit"
                          placeholder="Unit #"
                          value={propertyInfo.propertyUnit || ""}
                          onChange={(e) => setPropertyInfo({ ...propertyInfo, propertyUnit: e.target.value })}
                          data-testid="input-property-unit"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="property-city">City</Label>
                        <Input
                          id="property-city"
                          placeholder="City"
                          value={propertyInfo.propertyCity || app.propertyCity || ""}
                          onChange={(e) => setPropertyInfo({ ...propertyInfo, propertyCity: e.target.value })}
                          data-testid="input-property-city"
                        />
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="space-y-2">
                        <Label htmlFor="property-state">State</Label>
                        <Select
                          value={propertyInfo.propertyState || app.propertyState || ""}
                          onValueChange={(value) => setPropertyInfo({ ...propertyInfo, propertyState: value })}
                        >
                          <SelectTrigger id="property-state" data-testid="select-property-state">
                            <SelectValue placeholder="State" />
                          </SelectTrigger>
                          <SelectContent>
                            {US_STATES.map((state) => (
                              <SelectItem key={state} value={state}>{state}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="property-zip">ZIP Code</Label>
                        <Input
                          id="property-zip"
                          placeholder="ZIP"
                          value={propertyInfo.propertyZip || app.propertyZip || ""}
                          onChange={(e) => setPropertyInfo({ ...propertyInfo, propertyZip: e.target.value })}
                          data-testid="input-property-zip"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="number-of-units">Number of Units</Label>
                        <Input
                          id="number-of-units"
                          type="number"
                          min="1"
                          value={propertyInfo.numberOfUnits ?? 1}
                          onChange={(e) => setPropertyInfo({ ...propertyInfo, numberOfUnits: parseInt(e.target.value) || 1 })}
                          data-testid="input-number-units"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="occupancy-type">Occupancy Type</Label>
                        <Select
                          value={propertyInfo.occupancyType || "primary_residence"}
                          onValueChange={(value) => setPropertyInfo({ ...propertyInfo, occupancyType: value })}
                        >
                          <SelectTrigger id="occupancy-type" data-testid="select-occupancy-type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="primary_residence">Primary Residence</SelectItem>
                            <SelectItem value="second_home">Second Home</SelectItem>
                            <SelectItem value="investment">Investment Property</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <hr />

                    <h4 className="font-semibold">Loan Details</h4>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <div className="space-y-2">
                        <Label htmlFor="property-value">Property Value</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                          <Input
                            id="property-value"
                            className="pl-7"
                            placeholder="0.00"
                            value={propertyInfo.propertyValue || app.propertyValue || app.purchasePrice || ""}
                            onChange={(e) => setPropertyInfo({ ...propertyInfo, propertyValue: e.target.value })}
                            data-testid="input-property-value"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="loan-purpose">Loan Purpose</Label>
                        <Select defaultValue={app.loanPurpose || "purchase"}>
                          <SelectTrigger id="loan-purpose" data-testid="select-loan-purpose">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="purchase">Purchase</SelectItem>
                            <SelectItem value="refinance">Refinance</SelectItem>
                            <SelectItem value="cash_out">Cash Out Refinance</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="loan-type">Loan Type</Label>
                        <Select defaultValue={app.preferredLoanType || "conventional"}>
                          <SelectTrigger id="loan-type" data-testid="select-loan-type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="conventional">Conventional</SelectItem>
                            <SelectItem value="fha">FHA</SelectItem>
                            <SelectItem value="va">VA</SelectItem>
                            <SelectItem value="usda">USDA</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <hr />

                    <div className="space-y-4">
                      <h4 className="font-semibold">Special Property Characteristics</h4>
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="mixed-use"
                            checked={propertyInfo.isMixedUse || false}
                            onCheckedChange={(checked) => setPropertyInfo({ ...propertyInfo, isMixedUse: !!checked })}
                            data-testid="checkbox-mixed-use"
                          />
                          <Label htmlFor="mixed-use" className="font-normal">
                            This property is mixed-use (e.g., residential and commercial)
                          </Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="manufactured"
                            checked={propertyInfo.isManufacturedHome || false}
                            onCheckedChange={(checked) => setPropertyInfo({ ...propertyInfo, isManufacturedHome: !!checked })}
                            data-testid="checkbox-manufactured"
                          />
                          <Label htmlFor="manufactured" className="font-normal">
                            This is a manufactured home
                          </Label>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            <div className="mt-8 flex justify-end gap-4">
              <Button onClick={handleSave} disabled={saveMutation.isPending} className="gap-2" data-testid="button-save-urla">
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save URLA Form
              </Button>
            </div>
          </div>
    </>
  );
}
