const messages = {
  "Invalid request origin.":
    "Sign-in is blocked by the website address settings. Please contact your administrator.",
  "Username or password is incorrect.": "Username or password is incorrect.",
  "Too many login attempts. Please try again later.":
    "Too many login attempts. Wait up to 15 minutes before trying again.",
  "Sign-in is temporarily unavailable.":
    "Sign-in is temporarily unavailable. Please try again shortly.",
};
export function loginErrorMessage(error) {
  return (
    messages[error?.message] ||
    "Unable to connect to sign-in. Please try again or contact your company administrator."
  );
}
