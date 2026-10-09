"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials, stringToColor } from "@/lib/utils";
import { usersApi } from "@/lib/api/users";

type AvatarUser = { user_id: string; name: string; profile_picture_url?: string | null; updated_at?: string };

export function UserAvatar({
  user,
  showName = true,
  size = "sm",
}: {
  user: AvatarUser | null | undefined;
  showName?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const imageQuery = useQuery({
    queryKey: ["profile-picture", user?.user_id, user?.updated_at],
    queryFn: () => usersApi.getProfilePicture(user!.user_id),
    enabled: !!user?.profile_picture_url,
    staleTime: 5 * 60_000,
  });
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!imageQuery.data) {
      setImageUrl(null);
      return;
    }
    const url = URL.createObjectURL(imageQuery.data);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageQuery.data]);

  if (!user) {
    return <span className="text-xs text-muted-foreground">Unassigned</span>;
  }

  const dimension = size === "sm" ? "h-7 w-7" : size === "xl" ? "h-44 w-44" : size === "lg" ? "h-14 w-14" : "h-9 w-9";

  return (
    <div className="flex items-center gap-2">
      <Avatar className={dimension}>
        {imageUrl && <AvatarImage src={imageUrl} alt={`${user.name} profile photo`} />}
        <AvatarFallback style={{ backgroundColor: stringToColor(user.name) }} className="text-[11px]">
          {getInitials(user.name)}
        </AvatarFallback>
      </Avatar>
      {showName && <span className="text-sm text-foreground">{user.name}</span>}
    </div>
  );
}
