import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getInitials, stringToColor } from "@/lib/utils";
import type { User } from "@/types/user";

export function UserAvatar({
  user,
  showName = true,
  size = "sm",
}: {
  user: User | null | undefined;
  showName?: boolean;
  size?: "sm" | "md";
}) {
  if (!user) {
    return <span className="text-xs text-muted-foreground">Unassigned</span>;
  }

  const dimension = size === "sm" ? "h-7 w-7" : "h-9 w-9";

  return (
    <div className="flex items-center gap-2">
      <Avatar className={dimension}>
        <AvatarFallback style={{ backgroundColor: stringToColor(user.name) }} className="text-[11px]">
          {getInitials(user.name)}
        </AvatarFallback>
      </Avatar>
      {showName && <span className="text-sm text-foreground">{user.name}</span>}
    </div>
  );
}
