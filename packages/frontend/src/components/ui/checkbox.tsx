import * as React from "react"
import { cn } from "@/lib/utils"
import { Check } from "lucide-react"

export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
    onCheckedChange?: (checked: boolean) => void;
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
    ({ className, onCheckedChange, onChange, ...props }, ref) => {
        return (
            <div className={cn("relative flex items-center", className)}>
                <input
                    type="checkbox"
                    className="peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 appearance-none bg-background checked:bg-primary checked:text-primary-foreground"
                    ref={ref}
                    onChange={(e) => {
                        onChange?.(e);
                        onCheckedChange?.(e.target.checked);
                    }}
                    {...props}
                />
                <Check className="absolute left-0 top-0 h-4 w-4 hidden peer-checked:block text-primary-foreground pointer-events-none" />
            </div>
        )
    }
)
Checkbox.displayName = "Checkbox"

export { Checkbox }
