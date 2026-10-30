import CrudScreen from "@/src/components/CrudScreen";

export default function AdminProdutos() {
  return (
    <CrudScreen
      title="Produtos"
      endpoint="/produtos"
      fields={[
        { key: "nome", label: "Nome", required: true },
        { key: "descricao", label: "Descrição", type: "multiline" },
        { key: "preco", label: "Preço (R$)", type: "number" },
        { key: "estoque", label: "Estoque", type: "integer" },
        { key: "imagem_url", label: "URL da imagem" },
      ]}
      renderPrimary={(p) => p.nome}
      renderSecondary={(p) => `R$ ${Number(p.preco).toFixed(2).replace(".", ",")} • Estoque: ${p.estoque}`}
    />
  );
}
