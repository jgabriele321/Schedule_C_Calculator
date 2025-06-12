"use client"

import * as React from "react"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

interface CheckboxProps {
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  disabled?: boolean
  className?: string
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, checked = false, onCheckedChange, disabled = false, ...props }, ref) => {
    return (
      <div
        className="relative inline-flex items-center"
        role="checkbox"
        aria-checked={checked}
        tabIndex={0}
      >
        <input
          type="checkbox"
          ref={ref}
          checked={checked}
          onChange={(e) => onCheckedChange?.(e.target.checked)}
          disabled={disabled}
          className="sr-only"
          {...props}
        />
        <div
          className={cn(
            "h-6 w-6 flex items-center justify-center shrink-0 rounded-sm border-2 border-gray-400 bg-gray-700 transition-all cursor-pointer",
            "hover:border-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
            checked && "bg-green-500 border-green-500",
            disabled && "cursor-not-allowed opacity-50",
            className
          )}
          onClick={() => !disabled && onCheckedChange?.(!checked)}
        >
          <Check className={cn("h-5 w-5 text-white transition-all", !checked && "opacity-0")}/>
        </div>
      </div>
    )
  }
)

Checkbox.displayName = "Checkbox"

export { Checkbox } 