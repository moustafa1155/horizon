"use client";
import dynamic from "next/dynamic";
const Workspace = dynamic(() => import("../App"), {
  ssr: false,
  loading: () => <p className="p-8 text-navy-700">Loading workspace…</p>,
});
export default function ClientShell() {
  return <Workspace />;
}
