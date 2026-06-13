import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { listAthletes } from "@/lib/data.functions";
import { Avatar } from "./index";

const opts = () => queryOptions({ queryKey: ["athletes"], queryFn: () => listAthletes() });

export const Route = createFileRoute("/atletas/")({
  head: () => ({ meta: [{ title: "Atletas — Atletas com Dorflex" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(opts()),
  component: AthletesIndex,
});

function AthletesIndex() {
  const { data: athletes } = useSuspenseQuery(opts());
  return (
    <div className="space-y-6">
      <h1 className="display text-4xl text-lime">Atletas com Dorflex</h1>
      {athletes.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
          Nenhum atleta ainda. Importe um mês primeiro.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {athletes.map((a) => (
            <Link key={a.id} to="/atletas/$id" params={{ id: a.id }}>
              <div className="flex items-center gap-3 rounded-xl border border-border bg-card/50 p-4 transition-colors hover:bg-card">
                <AthleteAvatar athlete={a} size={48} shape="rounded" />
                <div className="display text-lg"><AthleteName athlete={a} /></div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
