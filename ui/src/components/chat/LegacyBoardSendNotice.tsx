import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { t } from "@/i18n";
import { Button } from "@/components/ui/button";

export function LegacyBoardSendNotice({ onDiscard }: { onDiscard: () => void }) {
  return <AlertDialog>
    <AlertDialogTrigger asChild>
      <Button size="sm" variant="outline">{t("legacyBoardSendNotice.discardSavedDeliveryRecord")}</Button>
    </AlertDialogTrigger>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{t("legacyBoardSendNotice.discardSavedDeliveryRecordQuestion")}</AlertDialogTitle>
        <AlertDialogDescription>
          {t("legacyBoardSendNotice.firstCheckActivity")}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>{t("legacyBoardSendNotice.keepRecord")}</AlertDialogCancel>
        <AlertDialogAction onClick={onDiscard}>{t("legacyBoardSendNotice.discardRecord")}</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}
