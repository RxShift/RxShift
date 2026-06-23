import DemoPrompter from "@/components/app/demo-prompter";

// The living demo prompter — opened in a popout window from the Admin Console.
// Content is driven by lib/demo/prompter-steps.ts (kept current with the app).
export default function DemoPrompterPage() {
  return <DemoPrompter />;
}
