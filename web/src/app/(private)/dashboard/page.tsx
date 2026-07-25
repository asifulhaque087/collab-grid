import { redirect } from "next/navigation";

export default async function DashboardIndex() {
  redirect("/dashboard/boards");
}
