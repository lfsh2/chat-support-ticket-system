import { notFound, redirect } from "next/navigation";

// Old-style ticket links (/help/1042, e.g. from emails) → the dashboard ticket view.
export default async function HelpTicketRedirect({ params }: PageProps<"/help/[number]">) {
  const { number } = await params;
  if (!/^\d{1,9}$/.test(number)) notFound();
  redirect(`/dashboard/tickets/${number}`);
}
