import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState, useRef, useEffect } from "react";
import { Upload, FileJson, AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { importMonth, recomputeAwards } from "@/lib/import.functions";
import { isCurrentUserAdmin } from "@/lib/data.functions";
import { parseExport, type GymRatsExport } from "@/lib/gymrats-parser";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/importar")({
  head: () => ({ meta: [{ title: "Importar mês — Atletas com Dorflex" }] }),
  component: ImportPage,
});

function ImportPage() {
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const adminCall = useServerFn(isCurrentUserAdmin);
  const { data: adminCheck } = useQuery({
    queryKey: ["admin", session?.user?.id],
    queryFn: () => adminCall(),
    enabled: !!session,
  });

  const [payload, setPayload] = useState<GymRatsExport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const importCall = useServerFn(importMonth);
  const mutation = useMutation({
    mutationFn: (p: GymRatsExport) => importCall({ data: { payload: p } }),
    onSuccess: (res) => {
      toast.success(`Mês importado! ${res.check_ins} treinos (${res.invalid} flagrados).`);
      router.invalidate();
      router.navigate({ to: "/meses/$id", params: { id: res.month_id } });
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao importar"),
  });

  const recomputeCall = useServerFn(recomputeAwards);
  const recomputeMutation = useMutation({
    mutationFn: () => recomputeCall({ data: { year: new Date().getFullYear() } }),
    onSuccess: (res) => {
      toast.success(`Conquistas de ${res.year} recalculadas.`);
      router.invalidate();
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao recalcular"),
  });

  async function handleFile(file: File) {
    setError(null);
    setPayload(null);
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      if (!json.id || !json.members || !json.check_ins) {
        throw new Error("JSON inválido: precisa ter id, members e check_ins.");
      }
      setPayload(json);
    } catch (e: any) {
      setError(e.message);
    }
  }

  if (!session) {
    return (
      <div className="mx-auto max-w-md rounded-xl border border-dashed p-10 text-center">
        <Upload className="mx-auto h-10 w-10 text-muted-foreground" />
        <h2 className="display mt-3 text-2xl">Login necessário</h2>
        <p className="mt-2 text-sm text-muted-foreground">Só admin importa dados.</p>
        <Button className="mt-4" onClick={() => router.navigate({ to: "/auth" })}>Entrar</Button>
      </div>
    );
  }
  if (adminCheck && !adminCheck.admin) {
    return (
      <div className="mx-auto max-w-md rounded-xl border border-destructive/40 bg-destructive/5 p-8 text-center">
        <AlertCircle className="mx-auto h-10 w-10 text-destructive" />
        <h2 className="display mt-3 text-2xl">Sem permissão</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Sua conta não é admin. Peça pra Paula (ou pra quem criou tudo isso) te promover.
        </p>
      </div>
    );
  }

  const parsed = payload ? parseExport(payload) : null;
  const invalid = parsed?.check_ins.filter((c) => !c.is_valid).length ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="display text-4xl text-lime">Importar JSON do Gym Rats</h1>
        <p className="text-muted-foreground">Arrasta o arquivo do mês ou clica pra escolher.</p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="display text-lg">Recalcular conquistas do ano</div>
            <p className="text-xs text-muted-foreground">
              Roda o cálculo de prêmios anuais sobre os check-ins já importados, sem reimportar JSON.
              Use depois de mudanças na lógica de classificação.
            </p>
          </div>
          <Button
            variant="secondary"
            className="gap-2"
            disabled={recomputeMutation.isPending}
            onClick={() => recomputeMutation.mutate()}
          >
            <RefreshCw className={`h-4 w-4 ${recomputeMutation.isPending ? "animate-spin" : ""}`} />
            {recomputeMutation.isPending ? "Recalculando..." : `Recalcular ${new Date().getFullYear()}`}
          </Button>
        </CardContent>
      </Card>

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files[0];
          if (f) handleFile(f);
        }}
        onClick={() => fileRef.current?.click()}
        className="cursor-pointer rounded-2xl border-2 border-dashed border-border bg-card/30 p-10 text-center transition-colors hover:border-primary/60 hover:bg-primary/5"
      >
        <FileJson className="mx-auto h-12 w-12 text-primary" />
        <div className="mt-3 display text-xl">Solta o JSON aqui</div>
        <div className="text-xs text-muted-foreground">ou clica pra escolher um arquivo</div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}

      {parsed && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Preview · {parsed.name}</span>
              <Badge variant="outline">{parsed.year}/{String(parsed.month).padStart(2, "0")}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat label="Atletas" value={parsed.members.length} />
              <Stat label="Check-ins" value={parsed.check_ins.length} />
              <Stat label="Válidos" value={parsed.check_ins.length - invalid} good />
              <Stat label="Flagrados" value={invalid} danger />
            </div>
            <div className="flex items-start gap-2 rounded-md bg-secondary/40 p-3 text-xs text-muted-foreground">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              Se já existe um mês com esse ano/mês, ele será sobrescrito. Os prêmios do ano são recalculados.
            </div>
            <Button
              size="lg"
              className="w-full gap-2"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate(payload!)}
            >
              <CheckCircle2 className="h-4 w-4" />
              {mutation.isPending ? "Salvando..." : "Salvar mês"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value, good, danger }: { label: string; value: React.ReactNode; good?: boolean; danger?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 text-center ${good ? "border-primary/40 bg-primary/10" : danger ? "border-destructive/40 bg-destructive/10" : "border-border bg-card/60"}`}>
      <div className="display text-2xl">{value}</div>
      <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
    </div>
  );
}
