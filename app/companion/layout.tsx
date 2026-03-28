// Companion layout — no SessionProvider here.
// The root layout (app/layout.tsx) already wraps the entire app
// in <Providers> which includes SessionProvider. Nesting a second
// SessionProvider caused duplicate session subscriptions, cascading
// re-renders, and multi-minute freezes after login.

export default function CompanionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
