import { t } from "@/i18n";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AlarmClock, Archive, ArrowRightLeft, Ban, Clock, MoreHorizontal, ExternalLink, RotateCcw, UserRound } from "lucide-react";
import type { AttentionItem } from "@paperclipai/shared";
import { Link } from "@/lib/router";
import {
  attentionCanWithdraw,
  attentionCloseModes,
  attentionForOtherText,
  attentionHiddenState,
  attentionHiddenText,
  attentionOtherAudienceUserId,
  attentionStaleChipText,
  attentionTransferTargets,
  attentionUserLabel,
  planStaleWithdraw,
} from "@/lib/attention-close";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { IssueGroupHeader } from "./IssueGroupHeader";
import { Textarea } from "./ui/textarea";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** Tomorrow at 9am local time. */
function tomorrowMorningIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d.toISOString();
}

/** Snooze presets, resolved to a future ISO timestamp at click time. */
const SNOOZE_PRESETS: ReadonlyArray<{ label: string; resolve: () => string }> = [
  { label: t("attentionQueueRow.n1Hour"), resolve: () => new Date(Date.now() + HOUR_MS).toISOString() },
  { label: t("attentionQueueRow.n4Hours"), resolve: () => new Date(Date.now() + 4 * HOUR_MS).toISOString() },
  { label: t("attentionQueueRow.tomorrowMorning"), resolve: tomorrowMorningIso },
  { label: t("attentionQueueRow.nextWeek"), resolve: () => new Date(Date.now() + 7 * DAY_MS).toISOString() },
];

export interface AttentionCloseMenuProps {
  item: AttentionItem;
  currentUserId: string | null | undefined;
  userLabelMap?: ReadonlyMap<string, string> | null;
  onWithdraw?: (item: AttentionItem, reason: string) => void;
  onArchive?: (item: AttentionItem) => void;
  onSnooze?: (item: AttentionItem, until: string) => void;
  onTransfer?: (item: AttentionItem, userId: string) => void;
  /**
   * Restore a card you archived or snoozed (the Archived view, PAP-749 plan
   * §3). With it, a hidden card offers Restore instead of Archive, and a
   * snoozed card offers "Change snooze time".
   */
  onRestore?: (item: AttentionItem) => void;
  busy?: boolean;
  className?: string;
}

/**
 * One Close… menu on every card (PAP-749 plan §2, Rule 6). Each verb has one
 * effect: Withdraw request closes it for everyone, Archive and Snooze hide it
 * for you only, Restore shows it again, Transfer sends it to a different
 * person. The menu shows only the verbs the server listed in `closeModes`;
 * the server checks each one again.
 */
export function AttentionCloseMenu({
  item,
  currentUserId,
  userLabelMap,
  onWithdraw,
  onArchive,
  onSnooze,
  onTransfer,
  onRestore,
  busy = false,
  className,
}: AttentionCloseMenuProps) {
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [transferTo, setTransferTo] = useState<{ userId: string; label: string } | null>(null);
  const otherUserId = attentionOtherAudienceUserId(item, currentUserId);
  const otherName = otherUserId ? attentionUserLabel(otherUserId, userLabelMap) : null;
  const hidden = onRestore ? attentionHiddenState(item) : null;
  const canWithdraw = !!onWithdraw && attentionCanWithdraw(item);
  const canRestore = hidden !== null;
  const canArchive = !hidden && !!onArchive && attentionCloseModes(item).includes("archive");
  const canSnooze = !!onSnooze && attentionCloseModes(item).includes("snooze");
  const targets = onTransfer ? attentionTransferTargets(item, currentUserId, userLabelMap) : [];
  const href = item.subject.href;
  if (!canWithdraw && !canRestore && !canArchive && !canSnooze && targets.length === 0 && !href) return null;

  const transfer = (target: { userId: string; label: string }) => {
    // Transfer changes who the card is for, so a card for a different person asks first.
    if (otherName) setTransferTo(target);
    else onTransfer?.(item, target.userId);
  };

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            disabled={busy}
            className={className ?? "text-muted-foreground"}
            aria-label={t("attentionCloseMenu.close")}
            title={t("attentionCloseMenu.close")}
            data-attention-close-menu
            onClick={(event) => event.stopPropagation()}
          >
            <MoreHorizontal className="size-4" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canWithdraw && (
            <DropdownMenuItem onSelect={() => setWithdrawOpen(true)} data-attention-close-mode="withdraw">
              <Ban className="h-4 w-4" />
              {t("attentionCloseMenu.withdrawRequestEllipsis")}
            </DropdownMenuItem>
          )}
          {canRestore && (
            <DropdownMenuItem onSelect={() => onRestore?.(item)} data-attention-close-mode="restore">
              <RotateCcw className="h-4 w-4" />
              {hidden?.kind === "snoozed" ? t("attentionCloseMenu.restoreNow") : t("attentionQueueRow.restore")}
            </DropdownMenuItem>
          )}
          {canArchive && (
            <DropdownMenuItem onSelect={() => onArchive?.(item)} data-attention-close-mode="archive">
              <Archive className="h-4 w-4" />
              {t("attentionCloseMenu.archiveForMe")}
            </DropdownMenuItem>
          )}
          {canSnooze && (
            <SnoozeSubmenu
              onSnooze={(until) => onSnooze?.(item, until)}
              label={hidden?.kind === "snoozed" ? t("attentionCloseMenu.changeSnoozeTime") : undefined}
            />
          )}
          {targets.length > 0 && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger data-attention-close-mode="transfer">
                <ArrowRightLeft className="h-4 w-4" />
                {t("attentionCloseMenu.transferToEllipsis")}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {targets.map((target) => (
                  <DropdownMenuItem key={target.userId} onSelect={() => transfer(target)}>
                    <UserRound className="h-4 w-4" />
                    @{target.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}
          {href && (
            <>
              {(canWithdraw || canRestore || canArchive || canSnooze || targets.length > 0) && <DropdownMenuSeparator />}
              <DropdownMenuItem asChild>
                <Link to={href}>
                  <ExternalLink className="h-4 w-4" />
                  {t("attentionQueueRow.openSource")}
                </Link>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {canWithdraw && (
        <WithdrawRequestDialog
          open={withdrawOpen}
          onOpenChange={setWithdrawOpen}
          title={item.subject.title}
          otherName={otherName}
          onConfirm={(reason) => {
            setWithdrawOpen(false);
            onWithdraw?.(item, reason);
          }}
        />
      )}

      {transferTo && otherName && (
        <Dialog open onOpenChange={(open) => { if (!open) setTransferTo(null); }}>
          <DialogContent showCloseButton={false} onClick={(event) => event.stopPropagation()}>
            <DialogHeader>
              <DialogTitle>{attentionForOtherText(otherName, "continue")}</DialogTitle>
              <DialogDescription>
                {t("attentionCloseMenu.transferConfirmation", { from: otherName, to: transferTo.label })}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="sm:justify-between">
              <Button type="button" variant="outline" onClick={() => setTransferTo(null)}>{t("common.cancel")}</Button>
              <Button
                type="button"
                onClick={() => {
                  onTransfer?.(item, transferTo.userId);
                  setTransferTo(null);
                }}
              >
                {t("attentionCloseMenu.transferToName", { name: transferTo.label })}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

/**
 * Withdraw closes the request for everyone and is never an approval. It cannot
 * be undone, so it always confirms; a card for a different person also says
 * "This is for @x. Withdraw anyway?" (PAP-749 plan §2, special conditions).
 */
function WithdrawRequestDialog({
  open,
  onOpenChange,
  title,
  otherName,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string | null;
  otherName: string | null;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) setReason(""); onOpenChange(next); }}>
      <DialogContent showCloseButton={false} onClick={(event) => event.stopPropagation()} data-attention-withdraw-dialog>
        <DialogHeader>
          <DialogTitle>{otherName ? attentionForOtherText(otherName, "withdraw") : t("attentionCloseMenu.withdrawThisRequest")}</DialogTitle>
          <DialogDescription>
            {title ? <><span className="font-medium text-foreground">{title}</span>{" — "}</> : null}
            {t("attentionCloseMenu.withdrawDescription")}
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder={t("attentionCloseMenu.whyIsItOutOfDate")}
          aria-label={t("attentionCloseMenu.reasonForWithdrawing")}
          className="min-h-16 text-sm"
        />
        <DialogFooter className="sm:justify-between">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("common.cancel")}</Button>
          <Button type="button" variant="destructive" onClick={() => { onConfirm(reason); setReason(""); }}>
            {t("attentionCloseMenu.withdrawRequest")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Snooze submenu: presets + a custom date-time. Personal; it does not move a shared deadline. */
export function SnoozeSubmenu({ onSnooze, label = t("attentionCloseMenu.snoozeForMe") }: { onSnooze: (snoozedUntil: string) => void; label?: string }) {
  const [customValue, setCustomValue] = useState("");
  const applyCustom = () => {
    if (!customValue) return;
    const ts = new Date(customValue);
    if (Number.isNaN(ts.getTime())) return;
    onSnooze(ts.toISOString());
  };
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger data-attention-close-mode="snooze">
        <AlarmClock className="h-4 w-4" />
        {label}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        {SNOOZE_PRESETS.map((preset) => (
          <DropdownMenuItem key={preset.label} onSelect={() => onSnooze(preset.resolve())}>
            {preset.label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        {/* Custom picker: a non-menu-item region so interacting with the input
            doesn't close the menu (guard keydown/select against Radix typeahead). */}
        <div
          className="flex flex-col gap-1.5 px-2 py-1.5"
          onKeyDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <span className="text-(length:--text-nano) font-medium uppercase tracking-(--tracking-eyebrow) text-muted-foreground">
            {t("common.custom")}
          </span>
          <input
            type="datetime-local"
            value={customValue}
            onChange={(e) => setCustomValue(e.target.value)}
            aria-label={t("attentionCloseMenu.snoozeUntil")}
            className="w-full rounded-sm border border-border bg-background px-2 py-1 text-xs"
          />
          <Button type="button" size="xs" disabled={!customValue} onClick={applyCustom}>
            {t("attentionQueueRow.snoozeUntil")}
          </Button>
        </div>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

/** "Stale · Waiting 30+ days" (PAP-749 plan §2, Rule 10). Nothing for a current card. */
export function AttentionStaleChip({ item }: { item: AttentionItem }) {
  const text = attentionStaleChipText(item);
  if (!text || !item.stale) return null;
  return (
    <Badge variant="outline" data-attention-stale={item.stale.reason} className="text-muted-foreground">
      <Clock aria-hidden="true" />
      {t("attentionCloseMenu.stalePrefix", { text })}
    </Badge>
  );
}

/**
 * When a card in the Archived view went away and when it comes back (PAP-749
 * plan §3): "Archived Oct 29" or "Back Fri, Oct 31, 9:00 AM". Nothing for a
 * card you did not hide.
 */
export function AttentionHiddenChip({ item }: { item: AttentionItem }) {
  const hidden = attentionHiddenState(item);
  if (!hidden) return null;
  const at = hidden.kind === "snoozed" ? hidden.until : hidden.since;
  return (
    <Badge variant="outline" data-attention-hidden={hidden.kind} className="text-muted-foreground" title={new Date(at).toLocaleString()}>
      {hidden.kind === "snoozed" ? <AlarmClock aria-hidden="true" /> : <Archive aria-hidden="true" />}
      <time dateTime={at}>{attentionHiddenText(hidden)}</time>
    </Badge>
  );
}

/**
 * The Snoozed group of the Archived view (PAP-749 plan §3). Open by default:
 * the person came to this view to see these cards. Each card shows when it
 * comes back; its Close… menu restores it now or changes the time.
 */
export function AttentionSnoozedGroup({
  count,
  open,
  onToggle,
  children,
}: {
  count: number;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  if (count === 0) return null;
  return (
    <section className="space-y-2" aria-label={t("attentionCloseMenu.snoozedCards")} data-attention-snoozed-group>
      <IssueGroupHeader
        label={t("attentionCloseMenu.snoozedCount", { count })}
        collapsible
        collapsed={!open}
        onToggle={onToggle}
        className="text-muted-foreground"
      />
      {open && <div className="space-y-4">{children}</div>}
    </section>
  );
}

/** The controls that act on a card; links only open something to read. */
const ACTING_CONTROL_SELECTOR = 'button, [role="button"], [role="radio"], [role="checkbox"], input[type="submit"]';

const AttentionActionConfirmationContext = createContext<() => Promise<void>>(() => Promise.resolve());

/** Resolver callbacks must pass the same gate as pointer controls. */
export function useAttentionActionConfirmation() {
  return useContext(AttentionActionConfirmationContext);
}

/**
 * Before you act on a card for a different person, the UI asks first (PAP-749
 * plan §6). The card stays readable: its title and body show at once, and the
 * question appears when you press one of its controls (PAP-767). Continue runs
 * the control you pressed; the server still checks who may answer.
 */
export function AttentionForOtherGate({
  item,
  currentUserId,
  userLabelMap,
  children,
}: {
  item: AttentionItem;
  currentUserId: string | null | undefined;
  userLabelMap?: ReadonlyMap<string, string> | null;
  children: ReactNode;
}) {
  const otherUserId = attentionOtherAudienceUserId(item, currentUserId);
  const audienceKey = `${item.id}:${otherUserId ?? ""}`;
  const [confirmedAudience, setConfirmedAudience] = useState<string | null>(null);
  const confirmed = confirmedAudience === audienceKey;
  const [pending, setPending] = useState<HTMLElement | null>(null);
  const [submissionPending, setSubmissionPending] = useState(false);
  const confirmation = useRef<{ promise: Promise<void>; resolve(): void; reject(error: Error): void } | null>(null);
  const confirmAction = useCallback(() => {
    if (!otherUserId || confirmed) return Promise.resolve();
    if (confirmation.current) return confirmation.current.promise;
    let resolve!: () => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<void>((accept, cancel) => { resolve = accept; reject = cancel; });
    confirmation.current = { promise, resolve, reject };
    setSubmissionPending(true);
    return promise;
  }, [confirmed, otherUserId]);
  useEffect(() => {
    setPending(null);
    setSubmissionPending(false);
    return () => {
      confirmation.current?.reject(new DOMException("Action cancelled.", "AbortError"));
      confirmation.current = null;
    };
  }, [audienceKey]);
  useEffect(() => {
    // Run the control that was held back once the person said Continue.
    if (!confirmed) return;
    const waiting = confirmation.current;
    confirmation.current = null;
    setSubmissionPending(false);
    waiting?.resolve();
    if (pending) {
      const control = pending;
      setPending(null);
      if (control.isConnected) control.click();
    }
  }, [confirmed, pending]);
  if (!otherUserId) return <>{children}</>;
  // The wrapper stays after Continue, so the card is not remounted and keeps
  // what the person typed or picked.
  return (
    <AttentionActionConfirmationContext.Provider value={confirmAction}>
      <div
        className="space-y-4"
        data-attention-for-other-gate={confirmed ? "confirmed" : pending || submissionPending ? "asking" : "waiting"}
        onClickCapture={(event) => {
          if (confirmed) return;
          const target = event.target instanceof Element ? event.target.closest<HTMLElement>(ACTING_CONTROL_SELECTOR) : null;
          if (!target || !event.currentTarget.contains(target) || target.closest("[data-attention-for-other-prompt]")) return;
          event.preventDefault();
          event.stopPropagation();
          setPending(target);
        }}
      >
        {children}
        {(pending || submissionPending) && !confirmed ? (
          <div
            role="group"
            aria-live="polite"
            data-attention-for-other-prompt
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm"
          >
            <span>{attentionForOtherText(attentionUserLabel(otherUserId, userLabelMap), "continue")}</span>
            <span className="flex items-center gap-2">
              <Button type="button" variant="ghost" size="xs" onClick={(event) => {
                event.stopPropagation();
                const waiting = confirmation.current;
                confirmation.current = null;
                setPending(null);
                setSubmissionPending(false);
                waiting?.reject(new DOMException("Action cancelled.", "AbortError"));
              }}>
                {t("common.cancel")}
              </Button>
              <Button type="button" variant="outline" size="xs" onClick={(event) => { event.stopPropagation(); setConfirmedAudience(audienceKey); }}>
                {t("common.continue")}
              </Button>
            </span>
          </div>
        ) : null}
      </div>
    </AttentionActionConfirmationContext.Provider>
  );
}

/**
 * The collapsed Stale (N) group at the bottom of a view (PAP-749 plan §3).
 * "Withdraw all stale" confirms first and lists each card: the ones it will
 * withdraw (marked when they are for a different person), the required ones
 * that stay with a person, and the ones with no request to withdraw.
 */
export function AttentionStaleGroup({
  items,
  open,
  onToggle,
  onWithdrawAll,
  busy = false,
  currentUserId,
  userLabelMap,
  titleOf = attentionCardHeadline,
  children,
}: {
  items: AttentionItem[];
  open: boolean;
  onToggle: () => void;
  onWithdrawAll?: (items: AttentionItem[], reason: string) => void | Promise<unknown>;
  busy?: boolean;
  currentUserId: string | null | undefined;
  userLabelMap?: ReadonlyMap<string, string> | null;
  /** The title each card leads with in this layout, so the confirmation names cards as they read (PAP-767). */
  titleOf?: (item: AttentionItem) => string;
  children: ReactNode;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reason, setReason] = useState("");
  const { withdrawable, required, kept } = planStaleWithdraw(items);
  if (items.length === 0) return null;
  const forOthers = withdrawable.filter((item) => attentionOtherAudienceUserId(item, currentUserId));
  const closeDialog = () => { setConfirmOpen(false); setReason(""); };

  return (
    <section className="space-y-2" aria-label={t("attentionCloseMenu.staleCards")} data-attention-stale-group>
      <IssueGroupHeader
        label={t("attentionCloseMenu.staleCount", { count: items.length })}
        collapsible
        collapsed={!open}
        onToggle={onToggle}
        className="text-muted-foreground"
        trailing={onWithdrawAll && withdrawable.length > 0 ? (
          <Button type="button" variant="outline" size="xs" disabled={busy} onClick={() => setConfirmOpen(true)}>
            <Ban aria-hidden="true" />
            {busy ? t("attentionCloseMenu.withdrawing") : t("attentionCloseMenu.withdrawAllStale")}
          </Button>
        ) : null}
      />
      {open && <div className="space-y-4">{children}</div>}

      <Dialog open={confirmOpen} onOpenChange={(next) => { if (!next) closeDialog(); }}>
        <DialogContent showCloseButton={false} data-attention-stale-withdraw-dialog>
          <DialogHeader>
            <DialogTitle>{withdrawable.length === 1 ? t("attentionCloseMenu.withdrawStaleRequestOne") : t("attentionCloseMenu.withdrawStaleRequests", { count: withdrawable.length })}</DialogTitle>
            <DialogDescription>
              {t("attentionCloseMenu.eachRequestClosesForEveryone")}
            </DialogDescription>
          </DialogHeader>
          {forOthers.length > 0 && (
            <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm" data-attention-stale-for-others>
              {forOthers.length === 1
                ? attentionForOtherText(attentionUserLabel(attentionOtherAudienceUserId(forOthers[0]!, currentUserId)!, userLabelMap), "continue")
                : t("attentionCloseMenu.countOfTheseAreForOther", { count: forOthers.length })}
            </p>
          )}
          <StaleItemList items={withdrawable} currentUserId={currentUserId} userLabelMap={userLabelMap} titleOf={titleOf} label={t("attentionCloseMenu.willBeWithdrawn")} />
          {required.length > 0 && (
            <StaleItemList items={required} currentUserId={currentUserId} userLabelMap={userLabelMap} titleOf={titleOf} label={t("attentionCloseMenu.stayOpenRequired")} />
          )}
          {kept.length > 0 && (
            <StaleItemList items={kept} currentUserId={currentUserId} userLabelMap={userLabelMap} titleOf={titleOf} label={t("attentionCloseMenu.stayOpenNoRequest")} />
          )}
          <Textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={t("attentionCloseMenu.whyAreTheyOutOfDate")}
            aria-label={t("attentionCloseMenu.reasonForWithdrawingStale")}
            className="min-h-16 text-sm"
          />
          <DialogFooter className="sm:justify-between">
            <Button type="button" variant="outline" onClick={closeDialog}>{t("common.cancel")}</Button>
            <Button
              type="button"
              variant="destructive"
              disabled={busy}
              onClick={() => {
                const confirmedReason = reason;
                closeDialog();
                void onWithdrawAll?.(withdrawable, confirmedReason);
              }}
            >
              {withdrawable.length === 1 ? t("attentionCloseMenu.withdrawOneRequest") : t("attentionCloseMenu.withdrawRequests", { count: withdrawable.length })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

/** The card title the classic row leads with (`AttentionQueueRow`). */
function attentionCardHeadline(item: AttentionItem) {
  return item.subject.title ?? item.whyNow;
}

function StaleItemList({
  items,
  label,
  currentUserId,
  userLabelMap,
  titleOf,
}: {
  items: AttentionItem[];
  label: string;
  currentUserId: string | null | undefined;
  userLabelMap?: ReadonlyMap<string, string> | null;
  titleOf: (item: AttentionItem) => string;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <ul className="max-h-48 space-y-1 overflow-auto text-sm" data-attention-stale-list={label}>
        {items.map((item) => {
          const otherUserId = attentionOtherAudienceUserId(item, currentUserId);
          const task = item.relatedIssue?.identifier ?? (item.subject.kind === "issue" ? item.subject.identifier : null);
          return (
            <li key={item.id} className="flex flex-wrap items-baseline gap-x-2" data-attention-stale-item={item.id}>
              <span className="min-w-0 truncate font-medium text-foreground">{titleOf(item)}</span>
              {task && <span className="font-mono text-xs text-muted-foreground">{task}</span>}
              <span className="text-xs text-muted-foreground">{attentionStaleChipText(item)}</span>
              {otherUserId && <span className="text-xs text-muted-foreground">{t("attentionCloseMenu.forName", { name: attentionUserLabel(otherUserId, userLabelMap) })}</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
