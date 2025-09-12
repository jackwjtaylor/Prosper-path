import React, { Suspense } from "react";
import { redirect } from "next/navigation";
import { TranscriptProvider } from "@/app/contexts/TranscriptContext";
import { EventProvider } from "@/app/contexts/EventContext";
import App from "./App";

export default function Page() {
  const marketingOnly = String(process.env.NEXT_PUBLIC_MARKETING_ONLY || "").toLowerCase();
  if (marketingOnly === "1" || marketingOnly === "true" || marketingOnly === "yes") {
    redirect("/waitlist");
  }
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <TranscriptProvider>
        <EventProvider>
          <App />
        </EventProvider>
      </TranscriptProvider>
    </Suspense>
  );
}
