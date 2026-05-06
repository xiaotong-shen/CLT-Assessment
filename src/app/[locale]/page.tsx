import { redirect } from "next/navigation";

// Root locale page — redirect students to intake
export default function HomePage() {
  redirect("intake");
}
