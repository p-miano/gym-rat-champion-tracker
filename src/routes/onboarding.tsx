import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import {
  validateGroupCode,
  completeOnboarding,
  getMyOnboardingState,
} from "@/lib/onboarding.functions";

export const Route = createFileRoute("/onboarding")({
  head: () => ({ meta: [{ title: "Concluir Cadastro — Atletas com Dorflex" }] }),
  component: OnboardingPage,
});

type AthleteOption = { id: string; full_name: string; claimed: boolean };

function OnboardingPage() {
  const router = useRouter();
  const validateCall = useServerFn(validateGroupCode);
  const completeCall = useServerFn(completeOnboarding);
  const stateCall = useServerFn(getMyOnboardingState);

  const [checking, setChecking] = useState(true);
  const [code, setCode] = useState("");
  const [athletes, setAthletes] = useState<AthleteOption[] | null>(null);
  const [validating, setValidating] = useState(false);

  const [athleteId, setAthleteId] = useState<string>("");
  const [displayMode, setDisplayMode] = useState<"placeholder" | "nickname" | "real">("placeholder");
  const [nickname, setNickname] = useState("");
  const [showPhoto, setShowPhoto] = useState<"yes" | "no">("no");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.navigate({ to: "/auth" });
        return;
      }
      try {
        const s = await stateCall();
        if (s.onboarded) {
          router.navigate({ to: "/" });
          return;
        }
      } catch {
        // ignore
      }
      setChecking(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onValidate(e: React.FormEvent) {
    e.preventDefault();
    setValidating(true);
    try {
      const res = await validateCall({ data: { code } });
      setAthletes(res.athletes);
      toast.success(`Grupo encontrado: ${res.group.name}`);
    } catch (err: any) {
      toast.error(err.message ?? "Código do grupo inválido ou não encontrado.");
      setAthletes(null);
    } finally {
      setValidating(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!athleteId) {
      toast.error("Selecione o seu nome de atleta.");
      return;
    }
    if (displayMode === "nickname" && !nickname.trim()) {
      toast.error("Informe um apelido personalizado.");
      return;
    }
    setSubmitting(true);
    try {
      await completeCall({
        data: {
          group_code: code,
          athlete_id: athleteId,
          display_mode: displayMode,
          public_nickname: displayMode === "nickname" ? nickname.trim() : null,
          show_google_photo: showPhoto === "yes",
        },
      });
      toast.success("Cadastro concluído!");
      router.navigate({ to: "/" });
    } catch (err: any) {
      toast.error(err.message ?? "Não foi possível concluir o cadastro.");
    } finally {
      setSubmitting(false);
    }
  }

  if (checking) {
    return <div className="mx-auto max-w-xl text-center text-muted-foreground">Carregando…</div>;
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="display text-3xl text-lime">Concluir Cadastro</CardTitle>
          <CardDescription>
            Informe o código do grupo GymRats do mês vigente para liberar o acesso aos
            dados reais.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onValidate} className="flex flex-wrap items-end gap-3">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="code">Código do Grupo GymRats</Label>
              <Input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Ex.: 123456"
                required
              />
            </div>
            <Button type="submit" disabled={validating}>
              {validating ? "Validando…" : "Validar código"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {athletes && (
        <Card>
          <CardHeader>
            <CardTitle className="display text-2xl text-lime">Vincular Atleta</CardTitle>
            <CardDescription>
              Selecione o seu nome e configure suas preferências de privacidade.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-6">
              <div className="space-y-1.5">
                <Label>Seu nome de atleta</Label>
                <Select value={athleteId} onValueChange={setAthleteId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione…" />
                  </SelectTrigger>
                  <SelectContent>
                    {athletes.map((a) => (
                      <SelectItem key={a.id} value={a.id} disabled={a.claimed}>
                        {a.full_name} {a.claimed ? "· já vinculado" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Como você deseja aparecer para visitantes públicos?</Label>
                <RadioGroup
                  value={displayMode}
                  onValueChange={(v) => setDisplayMode(v as any)}
                  className="space-y-2"
                >
                  <label className="flex items-center gap-2">
                    <RadioGroupItem value="placeholder" id="dm-p" />
                    <span>Manter nome fictício aleatório</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <RadioGroupItem value="nickname" id="dm-n" />
                    <span>Usar um apelido personalizado</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <RadioGroupItem value="real" id="dm-r" />
                    <span>Mostrar meu nome real</span>
                  </label>
                </RadioGroup>
                {displayMode === "nickname" && (
                  <Input
                    placeholder="Seu apelido"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    maxLength={60}
                  />
                )}
              </div>

              <div className="space-y-2">
                <Label>
                  Autoriza exibir sua foto de perfil do Google publicamente para
                  visitantes do portfólio?
                </Label>
                <RadioGroup
                  value={showPhoto}
                  onValueChange={(v) => setShowPhoto(v as any)}
                  className="flex gap-6"
                >
                  <label className="flex items-center gap-2">
                    <RadioGroupItem value="yes" id="sp-y" />
                    <span>Sim</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <RadioGroupItem value="no" id="sp-n" />
                    <span>Não</span>
                  </label>
                </RadioGroup>
              </div>

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Salvando…" : "Concluir cadastro"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
