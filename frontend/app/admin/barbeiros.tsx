import CrudScreen from "@/src/components/CrudScreen";

export default function AdminBarbeiros() {
  return (
    <CrudScreen
      title="Barbeiros"
      endpoint="/barbeiros"
      fields={[
        { key: "nome", label: "Nome", required: true },
        { key: "especialidade", label: "Especialidade" },
        { key: "telefone", label: "Telefone" },
        { key: "foto_url", label: "URL da foto" },
        { key: "bio", label: "Biografia", type: "multiline" },
        { key: "status", label: "Status (Ativo ou Inativo)", placeholder: "Ativo", required: true, options: ["Ativo", "Inativo"] },
        { key: "galeria", label: "Galeria (URLs das fotos)", type: "list" },
      ]}
      renderPrimary={(b) => b.nome}
      renderSecondary={(b) => `${b.especialidade || "—"} • ${b.status} • ${(b.galeria || []).length} fotos`}
    />
  );
}
