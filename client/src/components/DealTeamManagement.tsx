import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  UserPlus, 
  Trash2,
  Mail, 
  Phone, 
  Building,
  Users,
  User,
} from "lucide-react";

interface StaffMember {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  role: string;
}

interface TeamMemberUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  profileImageUrl: string | null;
  role: string;
}

interface DealTeamMember {
  id: string;
  applicationId: string;
  userId: string | null;
  teamRole: string;
  externalName: string | null;
  externalEmail: string | null;
  externalPhone: string | null;
  externalCompany: string | null;
  isPrimary: boolean;
  isActive: boolean;
  notes: string | null;
  user?: TeamMemberUser;
}

const teamRoles = [
  { value: "loan_officer", label: "Loan Officer" },
  { value: "loan_processor", label: "Loan Processor" },
  { value: "underwriter", label: "Underwriter" },
  { value: "closer", label: "Closer/Funder" },
  { value: "real_estate_agent", label: "Real Estate Agent" },
  { value: "title_agent", label: "Title Agent" },
  { value: "appraiser", label: "Appraiser" },
  { value: "insurance_agent", label: "Insurance Agent" },
  { value: "attorney", label: "Attorney" },
  { value: "escrow_officer", label: "Escrow Officer" },
];

const roleLabels: Record<string, string> = {
  loan_officer: "Loan Officer",
  loan_processor: "Loan Processor",
  underwriter: "Underwriter",
  closer: "Closer/Funder",
  real_estate_agent: "Real Estate Agent",
  title_agent: "Title Agent",
  appraiser: "Appraiser",
  insurance_agent: "Insurance Agent",
  attorney: "Attorney",
  escrow_officer: "Escrow Officer",
};

interface DealTeamManagementProps {
  applicationId: string;
}

export function DealTeamManagement({ applicationId }: DealTeamManagementProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [memberType, setMemberType] = useState<"internal" | "external">("internal");
  const [selectedStaffId, setSelectedStaffId] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [isPrimary, setIsPrimary] = useState(false);
  const [notes, setNotes] = useState("");
  
  // External member fields
  const [externalName, setExternalName] = useState("");
  const [externalEmail, setExternalEmail] = useState("");
  const [externalPhone, setExternalPhone] = useState("");
  const [externalCompany, setExternalCompany] = useState("");

  const { data: team, isLoading: teamLoading } = useQuery<DealTeamMember[]>({
    queryKey: ["/api/applications", applicationId, "team"],
    queryFn: async () => {
      const res = await fetch(`/api/applications/${applicationId}/team`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch team");
      return res.json();
    },
  });

  const { data: availableStaff } = useQuery<StaffMember[]>({
    queryKey: ["/api/available-staff"],
    queryFn: async () => {
      const res = await fetch("/api/available-staff", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch staff");
      return res.json();
    },
  });

  const addMemberMutation = useMutation({
    mutationFn: async (data: {
      userId?: string;
      teamRole: string;
      externalName?: string;
      externalEmail?: string;
      externalPhone?: string;
      externalCompany?: string;
      isPrimary?: boolean;
      notes?: string;
    }) => {
      const response = await apiRequest("POST", `/api/applications/${applicationId}/team`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/applications", applicationId, "team"] });
      toast({
        title: "Team member added",
        description: "The team member has been added to this deal.",
      });
      resetForm();
      setIsAddDialogOpen(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add team member. Please try again.",
        variant: "destructive",
      });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const response = await apiRequest("DELETE", `/api/deal-team/${memberId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/applications", applicationId, "team"] });
      toast({
        title: "Team member removed",
        description: "The team member has been removed from this deal.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove team member. Please try again.",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setMemberType("internal");
    setSelectedStaffId("");
    setSelectedRole("");
    setIsPrimary(false);
    setNotes("");
    setExternalName("");
    setExternalEmail("");
    setExternalPhone("");
    setExternalCompany("");
  };

  const handleAddMember = () => {
    if (!selectedRole) {
      toast({
        title: "Role required",
        description: "Please select a role for the team member.",
        variant: "destructive",
      });
      return;
    }

    if (memberType === "internal" && !selectedStaffId) {
      toast({
        title: "Staff member required",
        description: "Please select a staff member to add.",
        variant: "destructive",
      });
      return;
    }

    if (memberType === "external" && !externalName) {
      toast({
        title: "Name required",
        description: "Please enter the external partner's name.",
        variant: "destructive",
      });
      return;
    }

    const data = memberType === "internal"
      ? {
          userId: selectedStaffId,
          teamRole: selectedRole,
          isPrimary,
          notes: notes || undefined,
        }
      : {
          teamRole: selectedRole,
          externalName,
          externalEmail: externalEmail || undefined,
          externalPhone: externalPhone || undefined,
          externalCompany: externalCompany || undefined,
          isPrimary,
          notes: notes || undefined,
        };

    addMemberMutation.mutate(data);
  };

  if (teamLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-1">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            Deal Team
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-1 flex-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-deal-team-management">
      <CardHeader className="flex flex-row items-center justify-between gap-1">
        <CardTitle className="text-lg flex items-center gap-2">
          <Users className="h-5 w-5" />
          Deal Team ({team?.length || 0})
        </CardTitle>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1" data-testid="button-add-team-member">
              <UserPlus className="h-4 w-4" />
              Add
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add Team Member</DialogTitle>
              <DialogDescription>
                Add an internal staff member or external partner to this deal.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="flex gap-2">
                <Button
                  variant={memberType === "internal" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setMemberType("internal")}
                  className="flex-1"
                  data-testid="button-type-internal"
                >
                  <User className="h-4 w-4 mr-1" />
                  Internal Staff
                </Button>
                <Button
                  variant={memberType === "external" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setMemberType("external")}
                  className="flex-1"
                  data-testid="button-type-external"
                >
                  <Building className="h-4 w-4 mr-1" />
                  External Partner
                </Button>
              </div>

              <div className="space-y-2">
                <Label>Role *</Label>
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger data-testid="select-role">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {teamRoles.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        {role.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {memberType === "internal" ? (
                <div className="space-y-2">
                  <Label>Staff Member *</Label>
                  <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
                    <SelectTrigger data-testid="select-staff">
                      <SelectValue placeholder="Select staff member" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableStaff?.map((staff) => (
                        <SelectItem key={staff.id} value={staff.id}>
                          {staff.firstName} {staff.lastName} ({staff.role})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>Name *</Label>
                    <Input
                      value={externalName}
                      onChange={(e) => setExternalName(e.target.value)}
                      placeholder="Full name"
                      data-testid="input-external-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={externalEmail}
                      onChange={(e) => setExternalEmail(e.target.value)}
                      placeholder="email@example.com"
                      data-testid="input-external-email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input
                      type="tel"
                      value={externalPhone}
                      onChange={(e) => setExternalPhone(e.target.value)}
                      placeholder="(555) 123-4567"
                      data-testid="input-external-phone"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Company</Label>
                    <Input
                      value={externalCompany}
                      onChange={(e) => setExternalCompany(e.target.value)}
                      placeholder="Company name"
                      data-testid="input-external-company"
                    />
                  </div>
                </>
              )}

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="primary"
                  checked={isPrimary}
                  onCheckedChange={(checked) => setIsPrimary(checked === true)}
                  data-testid="checkbox-primary"
                />
                <Label htmlFor="primary" className="text-sm">
                  Primary contact for this role
                </Label>
              </div>

              <div className="space-y-2">
                <Label>Notes (optional)</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any additional notes..."
                  className="h-20"
                  data-testid="textarea-notes"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleAddMember}
                disabled={addMemberMutation.isPending}
                data-testid="button-confirm-add"
              >
                {addMemberMutation.isPending ? "Adding..." : "Add Member"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {!team || team.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No team members assigned</p>
            <p className="text-sm mt-1">Add team members to collaborate on this deal</p>
          </div>
        ) : (
          <div className="space-y-3">
            {team.map((member) => {
              const name = member.user 
                ? `${member.user.firstName || ''} ${member.user.lastName || ''}`.trim()
                : member.externalName || 'Team Member';
              const email = member.user?.email || member.externalEmail;
              const phone = member.externalPhone;
              const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'TM';

              return (
                <div 
                  key={member.id} 
                  className="flex items-center gap-3 p-3 rounded-lg border"
                  data-testid={`team-member-row-${member.id}`}
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={member.user?.profileImageUrl || undefined} />
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{name}</span>
                      <Badge variant="secondary" className="text-xs">
                        {roleLabels[member.teamRole] || member.teamRole}
                      </Badge>
                      {member.isPrimary && (
                        <Badge variant="outline" className="text-xs">Primary</Badge>
                      )}
                      {member.externalCompany && (
                        <span className="text-xs text-muted-foreground">
                          {member.externalCompany}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-3 mt-1 text-sm text-muted-foreground">
                      {email && (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {email}
                        </span>
                      )}
                      {phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {phone}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeMemberMutation.mutate(member.id)}
                    disabled={removeMemberMutation.isPending}
                    data-testid={`button-remove-${member.id}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}