import CrudScreen from "@/src/components/CrudScreen";

export default function AdminServicos() {
  return (
    <CrudScreen
      title="Serviços"
      endpoint="/servicos"
      fields={[
        { key: "nome", label: "Nome", required: true },
        { key: "descricao", label: "Descrição", type: "multiline" },
        { key: "preco", label: "Preço (R$)", type: "number" },
        { key: "duracao_minutos", label: "Duração (min)", type: "integer" },
        { key: "imagem_url", label: "URL da imagem" },
      ]}
      renderPrimary={(s) => s.nome}
      renderSecondary={(s) => `R$ ${Number(s.preco).toFixed(2).replace(".", ",")} • ${s.duracao_minutos} min`}
    />
  );
}
