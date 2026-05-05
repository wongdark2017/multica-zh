"use client";

import { useQuery } from "@tanstack/react-query";
import { useWorkspaceId } from "@multica/core/hooks";
import { notificationPreferenceOptions } from "@multica/core/notification-preferences/queries";
import { useUpdateNotificationPreferences } from "@multica/core/notification-preferences/mutations";
import type { NotificationGroupKey, NotificationPreferences } from "@multica/core/types";
import { Card, CardContent } from "@multica/ui/components/ui/card";
import { Switch } from "@multica/ui/components/ui/switch";
import { toast } from "sonner";

const notificationGroups: {
  key: NotificationGroupKey;
  label: string;
  description: string;
}[] = [
  {
    key: "assignments",
    label: "Assignments",
    description: "When you are assigned or unassigned from an issue",
  },
  {
    key: "status_changes",
    label: "Status changes",
    description: "When an issue you follow changes status (e.g. todo, in progress, done)",
  },
  {
    key: "comments",
    label: "Comments & Mentions",
    description: "New comments on issues you follow, or when someone @mentions you",
  },
  {
    key: "updates",
    label: "Priority & Due date",
    description: "When priority or due date changes on issues you follow",
  },
  {
    key: "agent_activity",
    label: "Agent activity",
    description: "When an agent task completes or fails",
  },
];

export function NotificationsTab() {
  const wsId = useWorkspaceId();
  const { data } = useQuery(notificationPreferenceOptions(wsId));
  const mutation = useUpdateNotificationPreferences();

  const preferences = data?.preferences ?? {};

  const handleToggle = (key: NotificationGroupKey, enabled: boolean) => {
    const updated: NotificationPreferences = {
      ...preferences,
      [key]: enabled ? "all" : "muted",
    };
    // Remove keys set to "all" (default) to keep the object clean
    if (enabled) {
      delete updated[key];
    }
    mutation.mutate(updated, {
      onError: () => toast.error("更新通知设置失败"),
    });
  };

  return (
    <div className="space-y-4">
      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold">Inbox 通知</h2>
          <p className="text-sm text-muted-foreground mt-1">
            控制哪些事件会生成 inbox 通知。被静音的事件类型会被静默过滤，你仍然可以直接访问 issue 查看它们。
          </p>
        </div>

        <Card>
          <CardContent className="divide-y">
            {notificationGroups.map((group) => {
              const enabled = preferences[group.key] !== "muted";
              return (
                <div
                  key={group.key}
                  className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                >
                  <div className="space-y-0.5 pr-4">
                    <p className="text-sm font-medium">{group.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {group.description}
                    </p>
                  </div>
                  <Switch
                    checked={enabled}
                    onCheckedChange={(checked) =>
                      handleToggle(group.key, checked)
                    }
                  />
                </div>
              );
            })}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
