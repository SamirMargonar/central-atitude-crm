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
      onChange={(e) =>
        onChange(e.target.value)
      }
    >

      <option value="">
        {placeholder}
      </option>

      {options.map((item) => {

        // ==========================================
        // OPÇÕES NORMAIS
        // ==========================================

        if (
          typeof item === "string"
        ) {

          return (

            <option
              key={item}
              value={item}
            >

              {item}

            </option>

          );

        }


        // ==========================================
        // OPÇÕES DE MÊS
        // ==========================================

        return (

          <option
            key={item.value}
            value={item.value}
          >

            {item.label}

          </option>

        );

      })}

    </select>

  );

}