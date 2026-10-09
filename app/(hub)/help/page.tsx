import { redirect } from "next/navigation";

// Tickets live in the dashboard now; /help stays as a friendly, shareable URL.
export default async function HelpPage({ searchParams }: PageProps<"/help">) {
  const { new: start } = await searchParams;
  redirect(start === "1" ? "/dashboard/tickets?new=1" : "/dashboard/tickets");
}
