/** Short-lived proof that the person answered the 13+ question before Apixis sign-in. */
export const AGE_COOKIE = "newsxis_age13";

export function ageCookieYes(value: string | undefined | null): boolean {
  return value === "yes";
}
