import { useQuery } from "@tanstack/react-query";
import { Megaphone } from "lucide-react";

type MoveNotice = { moveAt: string; newUrl: string } | null;

// Shown on every signed-in screen while the MOVE_AT setting is set; renders nothing otherwise.
export function MoveBanner() {
  const { data } = useQuery<MoveNotice>({ queryKey: ["/api/move-notice"] });
  if (!data) return null;

  const when = new Date(data.moveAt).toLocaleString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
  const host = new URL(data.newUrl).host;

  return (
    <div
      role="status"
      className="flex items-start gap-2 border-b bg-primary/10 px-4 py-2 text-sm"
      data-testid="banner-move"
    >
      <Megaphone className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <p>
        RS3 Flip Tracker is moving to{" "}
        <a href={data.newUrl} className="font-medium underline">
          {host}
        </a>{" "}
        on <strong>{when}</strong>. The app will be offline for about an hour during the move,
        and your sign-in keeps working there.
      </p>
    </div>
  );
}
