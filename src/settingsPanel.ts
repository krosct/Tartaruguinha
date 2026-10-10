import {
  Field,
  FieldGroup,
  FIELDS,
  GROUP_TITLES,
  sanitize,
  SettingKey,
  Settings,
  SettingValue,
} from "./settings";

export interface SettingsPanelOptions {
  form: HTMLFormElement;
  reset: HTMLButtonElement;
  current: Settings;
  defaults: Settings;
  onChange: (next: Settings, changed: SettingKey[]) => void;
}

type Control = HTMLInputElement | HTMLSelectElement;

function formatValue(field: Field, value: SettingValue): string {
  if (field.kind === "boolean") {
    return value ? "marcado" : "desmarcado";
  }
  if (field.kind === "select") {
    return field.options.find((option) => option.value === value)?.label ?? String(value);
  }
  return String(value);
}

function readControl(field: Field, control: Control): unknown {
  return field.kind === "boolean" ? (control as HTMLInputElement).checked : control.value;
}

function writeControl(field: Field, control: Control, value: SettingValue): void {
  if (field.kind === "boolean") {
    (control as HTMLInputElement).checked = Boolean(value);
  } else {
    control.value = String(value);
  }
}

function createControl(field: Field): Control {
  if (field.kind === "boolean") {
    const input = document.createElement("input");
    input.type = "checkbox";
    return input;
  }
  if (field.kind === "select") {
    const select = document.createElement("select");
    for (const option of field.options) {
      select.append(new Option(option.label, option.value));
    }
    return select;
  }
  const input = document.createElement("input");
  input.type = "number";
  input.min = String(field.min);
  input.max = String(field.max);
  input.step = String(field.step);
  input.inputMode = field.integer ? "numeric" : "decimal";
  return input;
}

export function mountSettingsPanel(options: SettingsPanelOptions): void {
  let current = { ...options.current };
  const controls = new Map<SettingKey, Control>();
  const groups = new Map<FieldGroup, HTMLFieldSetElement>();

  for (const field of FIELDS) {
    let fieldset = groups.get(field.group);
    if (!fieldset) {
      fieldset = document.createElement("fieldset");
      fieldset.className = "settings-group";
      const legend = document.createElement("legend");
      legend.textContent = GROUP_TITLES[field.group];
      fieldset.append(legend);
      groups.set(field.group, fieldset);
      options.form.append(fieldset);
    }

    const id = `setting-${field.key}`;
    const row = document.createElement("div");
    row.className = field.kind === "boolean" ? "setting setting-check" : "setting";

    const label = document.createElement("label");
    label.htmlFor = id;
    label.textContent = field.label;

    const control = createControl(field);
    control.id = id;
    control.name = field.key;

    const help = document.createElement("p");
    help.className = "setting-help";
    help.textContent = `${field.help} Padrão (.env): ${formatValue(field, options.defaults[field.key])}. Variável: ${field.env}.`;

    row.append(label, control, help);
    fieldset.append(row);
    controls.set(field.key, control);

    control.addEventListener("change", () => {
      const value = sanitize(field, readControl(field, control));
      if (value === null) {
        writeControl(field, control, current[field.key]);
        return;
      }
      writeControl(field, control, value);
      if (value === current[field.key]) {
        return;
      }
      current = { ...current, [field.key]: value };
      options.onChange(current, [field.key]);
    });
  }

  const render = () => {
    for (const field of FIELDS) {
      const control = controls.get(field.key);
      if (control) {
        writeControl(field, control, current[field.key]);
      }
    }
  };
  render();

  options.form.addEventListener("submit", (event) => event.preventDefault());
  options.reset.addEventListener("click", () => {
    const changed = FIELDS.map((field) => field.key).filter(
      (key) => current[key] !== options.defaults[key],
    );
    current = { ...options.defaults };
    render();
    if (changed.length > 0) {
      options.onChange(current, changed);
    }
  });
}
