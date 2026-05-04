/**
 * Multica architecture diagram for §1.2 "How Multica Works".
 *
 * Boundary-style layout: one large panel for "Your side" (where all the
 * interesting stuff happens — code, keys, compute), one smaller panel for
 * "Multica" (metadata store and coordinator).  The asymmetric sizes and the
 * brand-tinted left panel visually argue Multica's core thesis: AI runs on
 * your machine, not ours.
 *
 * No SVG arrows.  Relationships are carried by the layout itself — client
 * side vs. server side is the universal mental model, readers don't need
 * arrows to understand it.
 */
export function ArchitectureDiagram() {
  return (
    <div className="not-prose my-8">
      {/* Desktop: asymmetric two-panel with connector */}
      <div className="hidden md:grid md:grid-cols-[1.7fr_auto_1fr] md:gap-4 md:items-stretch">
        <YourSide />
        <Connector horizontal />
        <MulticaSide />
      </div>

      {/* Mobile: stacked */}
      <div className="md:hidden space-y-4">
        <YourSide />
        <Connector horizontal={false} />
        <MulticaSide />
      </div>
    </div>
  );
}

function YourSide() {
  return (
    <div className="rounded-lg border border-brand/30 bg-brand/[0.03] p-6 flex flex-col">
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-brand mb-5">
        Your side
      </div>

      <div className="flex-1 space-y-5">
        {/* Client surfaces */}
        <div>
          <SectionLabel>客户端</SectionLabel>
          <div className="flex flex-wrap gap-2">
            <Pill>Web 应用</Pill>
            <Pill>CLI</Pill>
          </div>
        </div>

        {/* Horizontal separator */}
        <div className="h-px bg-brand/15" />

        {/* Daemon + local tools */}
        <div>
          <SectionLabel>守护进程</SectionLabel>
          <div className="text-xs text-muted-foreground mb-2.5">
            Polls work from Multica. Invokes local AI coding tools:
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Pill>Claude Code</Pill>
            <Pill>Codex</Pill>
            <Pill>Cursor</Pill>
            <Pill>Copilot</Pill>
            <Pill muted>+ 6 more</Pill>
          </div>
        </div>
      </div>

      {/* Tagline */}
      <div className="mt-6 pt-4 border-t border-brand/20 flex items-center justify-center gap-3 text-[13px] font-medium text-brand">
        <span>你的代码。</span>
        <span className="text-brand/40">·</span>
        <span>你的密钥。</span>
        <span className="text-brand/40">·</span>
        <span>你的算力。</span>
      </div>
    </div>
  );
}

function MulticaSide() {
  return (
    <div className="rounded-lg border border-border/70 bg-muted/25 p-6 flex flex-col">
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-5">
        Multica
      </div>

      <div className="flex-1 flex flex-col">
        <SectionLabel>服务端</SectionLabel>
        <div className="text-xs text-muted-foreground mb-4">
          Cloud or self-hosted
        </div>

        <div className="text-xs space-y-1.5 text-foreground/80">
          <div>工作区</div>
          <div>Issue 与任务</div>
          <div>智能体定义</div>
          <div>实时通信（WebSocket）</div>
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-border/60 text-[11px] text-muted-foreground text-center uppercase tracking-[0.08em]">
        No AI execution here.
      </div>
    </div>
  );
}

function Connector({ horizontal }: { horizontal: boolean }) {
  if (horizontal) {
    return (
      <div
        className="flex items-center justify-center text-muted-foreground/50 text-xl select-none px-1"
        aria-hidden="true"
      >
        ⇄
      </div>
    );
  }
  return (
    <div
      className="text-center text-muted-foreground/50 text-xl select-none"
      aria-hidden="true"
    >
      ⇅
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground/70 mb-1.5">
      {children}
    </div>
  );
}

function Pill({
  children,
  muted = false,
}: {
  children: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-1 text-[11px] font-medium ${
        muted
          ? "border-border/50 bg-background/50 text-muted-foreground"
          : "border-border/70 bg-background text-foreground"
      }`}
    >
      {children}
    </span>
  );
}
