import { t } from "@/i18n";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface ShortcutEntry {
  keys: string[];
  label: string;
  /** Render keys as a simultaneous chord (joined with "+") rather than a
   *  "then" sequence. */
  combo?: boolean;
}

interface ShortcutSection {
  title: string;
  shortcuts: ShortcutEntry[];
}

const sections: ShortcutSection[] = [
  {
    title: t("common.inbox"),
    shortcuts: [
      { keys: ["j"], label: t("keyboardShortcutsCheatsheet.moveDown") },
      { keys: ["↓"], label: t("keyboardShortcutsCheatsheet.moveDown") },
      { keys: ["k"], label: t("keyboardShortcutsCheatsheet.moveUp") },
      { keys: ["↑"], label: t("keyboardShortcutsCheatsheet.moveUp") },
      { keys: ["←"], label: t("keyboardShortcutsCheatsheet.collapseSelectedGroup") },
      { keys: ["→"], label: t("keyboardShortcutsCheatsheet.expandSelectedGroup") },
      { keys: ["Enter"], label: t("keyboardShortcutsCheatsheet.openSelectedItem") },
      { keys: ["a"], label: t("keyboardShortcutsCheatsheet.archiveItem") },
      { keys: ["y"], label: t("keyboardShortcutsCheatsheet.archiveItem") },
      { keys: ["r"], label: t("common.markAsRead") },
      { keys: ["U"], label: t("common.markAsUnread") },
    ],
  },
  {
    title: t("keyboardShortcutsCheatsheet.taskDetail"),
    shortcuts: [
      { keys: ["y"], label: t("keyboardShortcutsCheatsheet.quickArchiveBackToInbox") },
      { keys: ["g", "i"], label: t("keyboardShortcutsCheatsheet.goToInbox") },
      { keys: ["g", "c"], label: t("keyboardShortcutsCheatsheet.focusCommentComposer") },
    ],
  },
  {
    title: t("keyboardShortcutsCheatsheet.decisions"),
    shortcuts: [
      { keys: ["j"], label: t("keyboardShortcutsCheatsheet.moveDown") },
      { keys: ["↓"], label: t("keyboardShortcutsCheatsheet.moveDown") },
      { keys: ["k"], label: t("keyboardShortcutsCheatsheet.moveUp") },
      { keys: ["↑"], label: t("keyboardShortcutsCheatsheet.moveUp") },
      { keys: ["Enter"], label: t("keyboardShortcutsCheatsheet.openOrCloseSelectedDecision") },
      { keys: ["x"], label: t("keyboardShortcutsCheatsheet.dismissSelectedDecision") },
    ],
  },
  {
    title: t("keyboardShortcutsCheatsheet.global"),
    shortcuts: [
      { keys: ["/"], label: t("keyboardShortcutsCheatsheet.searchCurrentPageOrQuick") },
      { keys: ["c"], label: t("common.newTask2") },
      { keys: ["["], label: t("keyboardShortcutsCheatsheet.toggleSidebar") },
      { keys: ["]"], label: t("keyboardShortcutsCheatsheet.togglePanel") },
      { keys: ["?"], label: t("keyboardShortcutsCheatsheet.showKeyboardShortcuts") },
    ],
  },
];

function KeyCap({ children }: { children: string }) {
  return (
    <kbd className="inline-flex h-6 min-w-6 items-center justify-center rounded border border-border bg-muted px-1.5 font-mono text-xs font-medium text-foreground shadow-(--shadow-extract-10)">
      {children}
    </kbd>
  );
}

export function KeyboardShortcutsCheatsheetContent() {
  return (
    <>
      <div className="divide-y divide-border border-t border-border">
        {sections.map((section) => (
          <div key={section.title} className="px-5 py-3">
            <h3 className="mb-2 text-(length:--text-micro) font-semibold uppercase tracking-wider text-muted-foreground">
              {section.title}
            </h3>
            <div className="space-y-1.5">
              {section.shortcuts.map((shortcut) => (
                <div
                  key={shortcut.label + shortcut.keys.join()}
                  className="flex items-center justify-between gap-4"
                >
                  <span className="text-sm text-foreground/90">{shortcut.label}</span>
                  <div className="flex items-center gap-1">
                    {shortcut.keys.map((key, i) => (
                      <span key={key} className="flex items-center gap-1">
                        {i > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {shortcut.combo ? "+" : "then"}
                          </span>
                        )}
                        <KeyCap>{key}</KeyCap>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-border px-5 py-3">
        <p className="text-xs text-muted-foreground">
          {t("keyboardShortcutsCheatsheet.press")} <KeyCap>Esc</KeyCap> {t("keyboardShortcutsCheatsheet.toCloseShortcutsAreDisabled")}
        </p>
      </div>
    </>
  );
}

export function KeyboardShortcutsCheatsheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md gap-0 p-0 overflow-hidden" showCloseButton={false}>
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="text-base">{t("keyboardShortcutsCheatsheet.keyboardShortcuts")}</DialogTitle>
        </DialogHeader>
        <KeyboardShortcutsCheatsheetContent />
      </DialogContent>
    </Dialog>
  );
}
