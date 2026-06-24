import { redirect } from "next/navigation";

// /dashboard → Boards (the main dashboard page).
export default function DashboardIndex() {
  redirect("/dashboard/boards");
}
