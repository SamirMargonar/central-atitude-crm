export default function SearchInput({
  value,
  onChange,
}) {

  return (

    <input
      type="text"
      className="searchInput"
      placeholder="🔍 Pesquisar nome ou telefone..."
      value={value}
      onChange={(e) =>
        onChange(e.target.value)
      }
    />

  );

}