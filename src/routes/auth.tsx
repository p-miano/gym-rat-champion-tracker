import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { lovable } from "@/integrations/lovable";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Entrar — Atletas com Dorflex" }] }),
  component: AuthPage,
});

function AuthPage() {
  const [loading, setLoading] = useState(false);

  async function signInGoogle() {
    setLoading(true);
    try {
      const result = await Promise.race([
        lovable.auth.signInWithOAuth("google", {
          redirect_uri: window.location.origin,
        }),
        new Promise<never>((_, reject) => {
          window.setTimeout(() => {
            reject(new Error("O redirecionamento para o Google demorou mais que o esperado."));
          }, 15000);
        }),
      ]);
      if (result.error) {
        toast.error("Não foi possível entrar com o Google. Tente novamente.");
        setLoading(false);
        return;
      }
      if (result.redirected) return;
      window.location.href = "/";
    } catch (e: any) {
      toast.error(e?.message ?? "Erro no login.");
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="display text-3xl text-lime">
            Acesso Exclusivo para Atletas do Grupo
          </CardTitle>
          <CardDescription>
            Faça login com a sua conta Google para liberar a visualização dos dados reais.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-3 rounded-md border border-border bg-card/60 p-4 text-sm leading-relaxed">
            <p>
              <span className="font-semibold">🔒 Privacidade em Primeiro Lugar:</span>{" "}
              Este aplicativo foi desenvolvido como um portfólio público. Por padrão,
              todos os dados de treino de visitantes anônimos são protegidos por nomes
              fictícios e avatares com iniciais coloridas.
            </p>
            <p>
              <span className="font-semibold">🔑 Apenas para Membros:</span> A
              visualização dos dados reais e o vínculo com seu histórico de treinos só
              são liberados para atletas do grupo ativo. Para concluir o seu cadastro
              após o login com o Google, você precisará informar o Código do Grupo
              GymRats do mês vigente.
            </p>
          </div>

          <Button onClick={signInGoogle} disabled={loading} className="w-full" size="lg">
            {loading ? "Redirecionando…" : "Entrar com Google"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
