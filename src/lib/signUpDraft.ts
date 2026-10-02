/**
 * What the user has typed into the two-step sign-up form, kept while they move between steps
 * (each step is its own screen, swapped with router.replace, so form state alone doesn't survive).
 * Memory only - never written to storage, so the password is gone once the app closes - and
 * cleared once the account is created.
 */
export type SignUpDraft = {
  fullName: string;
  email: string;
  phone: string;
  businessName: string;
  password: string;
  confirmPassword: string;
  acceptedTerms: boolean;
};

const EMPTY_DRAFT: SignUpDraft = {
  fullName: "",
  email: "",
  phone: "",
  businessName: "",
  password: "",
  confirmPassword: "",
  acceptedTerms: false,
};

let draft: SignUpDraft = { ...EMPTY_DRAFT };

export function getSignUpDraft(): SignUpDraft {
  return draft;
}

export function updateSignUpDraft(values: Partial<SignUpDraft>): void {
  draft = { ...draft, ...values };
}

export function clearSignUpDraft(): void {
  draft = { ...EMPTY_DRAFT };
}
