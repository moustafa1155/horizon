export const hostedPreview =
  process.env.NODE_ENV === "production" &&
  process.env.NEXT_PUBLIC_HOSTED_PREVIEW === "true";
