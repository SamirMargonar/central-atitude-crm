export default function SearchInput({
  value,
  onChange,
}) {

  return (

    <input
      type="text"
      className="searchInput"
      placeholder="🔍 Pesquisar nome do lead..."
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />

  );

}