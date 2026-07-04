import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AddressInput } from "@/components/AddressInput";
import { US_STATES } from "@/lib/us-states";
import { Lock } from "lucide-react";
import type { PersonalInfoForm } from "./types";

interface PersonalInfoSectionProps {
  personalInfo: PersonalInfoForm;
  onChange: (value: PersonalInfoForm) => void;
}

export function PersonalInfoSection({ personalInfo, onChange }: PersonalInfoSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Section 1a: Personal Information</CardTitle>
        <CardDescription>
          The basics every lender needs to open your file — who you are and how to reach you.
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
              onChange={(e) => onChange({ ...personalInfo, firstName: e.target.value })}
              data-testid="input-borrower-first-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="borrower-middle-name">Middle Name</Label>
            <Input
              id="borrower-middle-name"
              placeholder="Middle Name"
              value={personalInfo.middleName || ""}
              onChange={(e) => onChange({ ...personalInfo, middleName: e.target.value })}
              data-testid="input-borrower-middle-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="borrower-last-name">Last Name</Label>
            <Input
              id="borrower-last-name"
              placeholder="Last Name"
              value={personalInfo.lastName || ""}
              onChange={(e) => onChange({ ...personalInfo, lastName: e.target.value })}
              data-testid="input-borrower-last-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="borrower-suffix">Suffix</Label>
            <Input
              id="borrower-suffix"
              placeholder="Jr., Sr., III, etc."
              value={personalInfo.suffix || ""}
              onChange={(e) => onChange({ ...personalInfo, suffix: e.target.value })}
              data-testid="input-borrower-suffix"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="ssn">Social Security Number</Label>
            <Input
              id="ssn"
              aria-describedby="ssn-privacy-note"
              placeholder={
                personalInfo.ssnLast4
                  ? `On file: •••-••-${personalInfo.ssnLast4} (enter to replace)`
                  : "XXX-XX-XXXX"
              }
              value={personalInfo.ssn || ""}
              onChange={(e) => onChange({ ...personalInfo, ssn: e.target.value })}
              data-testid="input-ssn"
            />
            <p id="ssn-privacy-note" className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <Lock aria-hidden="true" className="mt-0.5 h-3 w-3 shrink-0" />
              Encrypted in transit and at rest — only your loan team can see this. We use it to
              verify your credit, nothing else.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="dob">Date of Birth</Label>
            <Input
              id="dob"
              type="date"
              value={personalInfo.dateOfBirth || ""}
              onChange={(e) => onChange({ ...personalInfo, dateOfBirth: e.target.value })}
              data-testid="input-dob"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="citizenship">Citizenship</Label>
            <Select
              value={personalInfo.citizenship || ""}
              onValueChange={(value) => onChange({ ...personalInfo, citizenship: value })}
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
              onValueChange={(value) => onChange({ ...personalInfo, creditType: value })}
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
              onValueChange={(value) => onChange({ ...personalInfo, maritalStatus: value })}
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
              onChange={(e) => onChange({ ...personalInfo, numberOfDependents: parseInt(e.target.value) || 0 })}
              data-testid="input-dependents"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dependent-ages">Ages of Dependents</Label>
            <Input
              id="dependent-ages"
              placeholder="e.g., 12, 8, 5"
              value={personalInfo.dependentAges || ""}
              onChange={(e) => onChange({ ...personalInfo, dependentAges: e.target.value })}
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
              onChange={(e) => onChange({ ...personalInfo, homePhone: e.target.value })}
              data-testid="input-home-phone"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cell-phone">Cell Phone</Label>
            <Input
              id="cell-phone"
              placeholder="(xxx) xxx-xxxx"
              value={personalInfo.cellPhone || ""}
              onChange={(e) => onChange({ ...personalInfo, cellPhone: e.target.value })}
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
              onChange={(e) => onChange({ ...personalInfo, email: e.target.value })}
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
            onSelect={(result) => onChange({
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
              onChange={(e) => onChange({ ...personalInfo, currentStreet: e.target.value })}
              data-testid="input-current-street"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="current-unit">Unit #</Label>
            <Input
              id="current-unit"
              placeholder="Unit #"
              value={personalInfo.currentUnit || ""}
              onChange={(e) => onChange({ ...personalInfo, currentUnit: e.target.value })}
              data-testid="input-current-unit"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="current-city">City</Label>
            <Input
              id="current-city"
              placeholder="City"
              value={personalInfo.currentCity || ""}
              onChange={(e) => onChange({ ...personalInfo, currentCity: e.target.value })}
              data-testid="input-current-city"
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="current-state">State</Label>
            <Select
              value={personalInfo.currentState || ""}
              onValueChange={(value) => onChange({ ...personalInfo, currentState: value })}
            >
              <SelectTrigger id="current-state" data-testid="select-current-state">
                <SelectValue placeholder="State" />
              </SelectTrigger>
              <SelectContent>
                {US_STATES.map((state) => (
                  <SelectItem key={state.value} value={state.value}>{state.value}</SelectItem>
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
              onChange={(e) => onChange({ ...personalInfo, currentZip: e.target.value })}
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
              onChange={(e) => onChange({ ...personalInfo, currentAddressYears: parseInt(e.target.value) || 0 })}
              data-testid="input-current-years"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="current-housing">Housing</Label>
            <Select
              value={personalInfo.currentHousingType || ""}
              onValueChange={(value) => onChange({ ...personalInfo, currentHousingType: value })}
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
  );
}
