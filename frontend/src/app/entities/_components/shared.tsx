import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export const entityTypeOptions = [
  { label: "Individual", value: "individual" },
  { label: "Vendor", value: "vendor" },
  { label: "Organization", value: "organization" },
] as const

export const inputClassName =
  "h-11 rounded-2xl border-trim-offset bg-muted px-4"

export const textareaClassName =
  "min-h-30 rounded-2xl border-trim-offset bg-muted px-4 py-3"

export const selectTriggerClassName =
  "w-full rounded-2xl border-trim-offset bg-muted px-4 py-3 text-sm data-[size=default]:h-11"

type EntityTypeSelectProps = {
  defaultValue?: "individual" | "vendor" | "organization"
  id: string
  name: string
}

/** Render the shared entity type select used by create and edit forms. */
export function EntityTypeSelect({
  defaultValue = "vendor",
  id,
  name,
}: EntityTypeSelectProps) {
  return (
    <Select defaultValue={defaultValue} name={name}>
      <SelectTrigger className={selectTriggerClassName} id={id}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {entityTypeOptions.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
