import { ControlCenter } from "@/components/dashboard/control-center";

export const metadata = {
  title: "Auto-Researcher | Research Console",
  description: "Durable 10-stage autonomous scientific discovery control plane."
};

export default function ResearchConsolePage() {
  return (
    <div className="space-y-4">
      <ControlCenter />
    </div>
  );
}
