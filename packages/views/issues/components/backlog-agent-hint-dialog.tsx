"use client";

import { useState } from "react";
import { Archive, ArrowRight, Bot, CheckCircle2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
} from "@multica/ui/components/ui/alert-dialog";
import { Button } from "@multica/ui/components/ui/button";
import { Checkbox } from "@multica/ui/components/ui/checkbox";

interface BacklogAgentHintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDismissPermanently: () => void;
  onMoveToTodo: () => void;
}

export function BacklogAgentHintDialog({
  open,
  onOpenChange,
  onDismissPermanently,
  onMoveToTodo,
}: BacklogAgentHintDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="w-[calc(100vw-2rem)] !max-w-[480px] gap-0 overflow-hidden rounded-lg p-0">
        <BacklogAgentHintContent
          onKeepInBacklog={() => onOpenChange(false)}
          onDismissPermanently={onDismissPermanently}
          onMoveToTodo={onMoveToTodo}
        />
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface BacklogAgentHintContentProps {
  onKeepInBacklog: () => void;
  onDismissPermanently: () => void;
  onMoveToTodo: () => void;
}

export function BacklogAgentHintContent({
  onKeepInBacklog,
  onDismissPermanently,
  onMoveToTodo,
}: BacklogAgentHintContentProps) {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const handleKeepInBacklog = () => {
    if (dontShowAgain) onDismissPermanently();
    onKeepInBacklog();
  };

  const handleMoveToTodo = () => {
    if (dontShowAgain) onDismissPermanently();
    onMoveToTodo();
  };

  return (
    <>
      <div className="px-5 pb-4 pt-5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
            <Bot className="size-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold">
              Agent 在 Backlog 中会暂停
            </h2>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">
              该 issue 已暂存，因此分配的 agent 会等待。想让 agent 开始时，请将它移动到 Todo。
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-2 rounded-lg border bg-muted/35 p-3 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Archive className="size-4 shrink-0" />
            <span className="font-medium text-foreground">Backlog</span>
            <span className="text-muted-foreground">会让 agent 暂停</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <ArrowRight className="size-4 shrink-0" />
            <span className="font-medium text-foreground">Todo</span>
            <span className="text-muted-foreground">会启动 agent</span>
            <CheckCircle2 className="ml-auto size-4 shrink-0 text-primary" />
          </div>
        </div>
      </div>

      <div className="border-t bg-muted/25 px-5 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex min-w-0 cursor-pointer items-center gap-2 text-sm text-muted-foreground">
            <Checkbox
              checked={dontShowAgain}
              onCheckedChange={(next) => setDontShowAgain(next === true)}
            />
            <span className="truncate">不再显示</span>
          </label>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={handleKeepInBacklog}
            >
              保留在 Backlog
            </Button>
            <Button
              type="button"
              className="w-full sm:w-auto"
              onClick={handleMoveToTodo}
            >
              移动到 Todo
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
