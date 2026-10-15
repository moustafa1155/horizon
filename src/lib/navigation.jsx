"use client";
import NextLink from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
export function Link({ to, children, ...props }) {
  return (
    <NextLink href={to || "#"} {...props}>
      {children}
    </NextLink>
  );
}
export function useLocation() {
  return { pathname: usePathname() };
}
export function useNavigate() {
  const router = useRouter();
  return (to, options = {}) =>
    options.replace ? router.replace(to) : router.push(to);
}
export function Navigate({ to }) {
  const router = useRouter();
  useEffect(() => {
    router.replace(to);
  }, [router, to]);
  return null;
}
