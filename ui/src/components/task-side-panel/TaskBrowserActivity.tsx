import type { TaskBrowser } from "@paperclipai/shared";
import { Globe } from "lucide-react";
import { t } from "@/i18n";
import { Button } from "@/components/ui/button";

export function TaskBrowserActivity({
  browser,
  label = t("taskBrowserActivity.browser"),
  onOpen,
}: {
  browser: TaskBrowser;
  label?: string;
  onOpen?: (id: string) => void;
}) {
  const closed = browser.status === "closed" || browser.status === "failed";
  return (
    <div className="flex flex-wrap items-center gap-2 py-1 text-sm" aria-label={t("taskBrowserActivity.sessionAriaLabel", { label })}>
      <Globe className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <span>{label}</span>
      <span className="text-muted-foreground">· {browser.status}</span>
      {onOpen && (
        <Button variant="ghost" size="sm" onClick={() => onOpen(browser.id)}>
          {closed ? t("taskBrowserActivity.viewSession") : t("taskBrowserActivity.openBrowser")}
        </Button>
      )}
    </div>
  );
}
