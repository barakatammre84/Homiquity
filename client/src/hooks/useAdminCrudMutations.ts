// Create/update/delete mutations for a REST-shaped admin resource.
//
// The admin content pages each hand-wrote three near-identical useMutation
// blocks per entity (nine in AdminContent alone) that differed only in the
// endpoint, the toast wording, and an optional payload transform. Nine copies
// of "POST, invalidate, toast, close the dialog" is nine places for the
// invalidate or the reset to be forgotten — so this states the shape once.
//
// Deliberately narrow: it assumes the resource follows the admin convention of
// POST /base, PATCH /base/:id, DELETE /base/:id, and that the list query is
// keyed by the base path. Anything that doesn't fit should keep its own
// useMutation rather than grow options here.
import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export interface AdminCrudOptions<TFormData> {
  /** Collection endpoint, e.g. "/api/admin/articles". Also the list query key. */
  endpoint: string;
  /**
   * Entity name as it appears in the SUCCESS toast ("Article created
   * successfully"). Kept separate from errorLabel because the existing copy
   * capitalizes these differently and this refactor preserves it verbatim.
   */
  successLabel: string;
  /** Entity name as it appears in the FAILURE toast ("Failed to create article"). */
  errorLabel: string;
  /** Form values -> request body. Defaults to sending the form values as-is. */
  toPayload?: (data: TFormData) => unknown;
  /**
   * Run after a successful create/update — closing the dialog, clearing the
   * "editing" row, resetting the form. NOT run after delete, which has no
   * dialog to close (matching the previous per-entity behavior).
   */
  onSaved?: () => void;
}

export interface AdminCrudMutations<TFormData> {
  create: UseMutationResult<Response, Error, TFormData>;
  update: UseMutationResult<Response, Error, { id: string; data: TFormData }>;
  remove: UseMutationResult<Response, Error, string>;
  /** True while a create or update is in flight (for disabling the save button). */
  isSaving: boolean;
}

export function useAdminCrudMutations<TFormData>({
  endpoint,
  successLabel,
  errorLabel,
  toPayload,
  onSaved,
}: AdminCrudOptions<TFormData>): AdminCrudMutations<TFormData> {
  const { toast } = useToast();
  const buildPayload = toPayload ?? ((data: TFormData) => data);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [endpoint] });
  };

  const create = useMutation<Response, Error, TFormData>({
    mutationFn: async (data) => apiRequest("POST", endpoint, buildPayload(data)),
    onSuccess: () => {
      invalidate();
      toast({ title: `${successLabel} created successfully` });
      onSaved?.();
    },
    onError: () => {
      toast({ title: `Failed to create ${errorLabel}`, variant: "destructive" });
    },
  });

  const update = useMutation<Response, Error, { id: string; data: TFormData }>({
    mutationFn: async ({ id, data }) =>
      apiRequest("PATCH", `${endpoint}/${id}`, buildPayload(data)),
    onSuccess: () => {
      invalidate();
      toast({ title: `${successLabel} updated successfully` });
      onSaved?.();
    },
    onError: () => {
      toast({ title: `Failed to update ${errorLabel}`, variant: "destructive" });
    },
  });

  const remove = useMutation<Response, Error, string>({
    mutationFn: async (id) => apiRequest("DELETE", `${endpoint}/${id}`),
    onSuccess: () => {
      invalidate();
      toast({ title: `${successLabel} deleted successfully` });
    },
    onError: () => {
      toast({ title: `Failed to delete ${errorLabel}`, variant: "destructive" });
    },
  });

  return { create, update, remove, isSaving: create.isPending || update.isPending };
}
