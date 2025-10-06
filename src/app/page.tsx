import { redirect } from "next/navigation";

export default function Page() {
  const marketingOnly = String(process.env.NEXT_PUBLIC_MARKETING_ONLY || "").toLowerCase();
  if (marketingOnly === "1" || marketingOnly === "true" || marketingOnly === "yes") {
    redirect("/waitlist");
  }

  const landingVariant = String(process.env.NEXT_PUBLIC_LANDING_VARIANT || "").toLowerCase();
  if (landingVariant === "landingsimple") {
    redirect("/landingsimple");
  }

  redirect("/landingsimple");
}
