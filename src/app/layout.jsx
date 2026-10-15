import "../index.css";
export const metadata = {
  title: "Horizon Company Portal",
  description: "Branch operations, weekly reports and employee management",
};
export default function RootLayout({ children }) {
  return (
    <html lang="en" dir="ltr">
      <body>{children}</body>
    </html>
  );
}
