export default function FilterSelect({
  value,
  onChange,
  options,
  placeholder,
}) {

  return (

    <select
      className="filterSelect"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >

      <option value="">
        {placeholder}
      </option>

      {options.map((item) => (

        <option
          key={item}
          value={item}
        >
          {item}
        </option>

      ))}

    </select>

  );

}