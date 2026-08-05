/**
 * Run an async action while a busy flag is held, and always release it.
 *
 * The page's submit and save-draft handlers used to be:
 *
 *   setSubmitting(true);
 *   await submitConsentMutation.mutateAsync(true);
 *   setSubmitting(false);
 *
 * `mutateAsync` *rejects* when the mutation fails (unlike `mutate`), and
 * `apiRequest` throws on any non-2xx. So a failed POST threw straight past the
 * final line: the flag stayed true, the button stayed disabled showing
 * "Processing..." / "Saving...", and the rejection escaped as an unhandled
 * promise rejection. The borrower saw the error toast the mutation's onError
 * raised, then had no way to retry short of reloading — and on this page a
 * reload discards exactly the form state that the now-stuck Save Progress
 * button was there to persist.
 *
 * Swallowing the rejection here is deliberate and is the whole point: the
 * mutation's own onError has already surfaced the failure to the borrower, so
 * there is nothing left to report, only a flag left to release.
 */
export async function runBusy(
  setBusy: (busy: boolean) => void,
  action: () => Promise<unknown>,
): Promise<void> {
  setBusy(true);
  try {
    await action();
  } catch {
    // Reported by the mutation's onError toast; see the note above.
  } finally {
    setBusy(false);
  }
}
