import { Select, SelectContent, SelectItem, SelectTrigger } from "~/components/ui/select";
import { cn } from "~/lib/utils";

import type { GetCourseOwnershipResponse } from "~/api/generated-api";

type TransferOwnershipSelectProps = {
  value: string;
  onChange: (value: string) => void;
  candidates?: GetCourseOwnershipResponse["data"]["possibleCandidates"];
  id?: string;
  triggerClassName?: string;
  disabled?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

const TransferOwnershipSelect = ({
  value,
  onChange,
  candidates,
  id,
  triggerClassName,
  disabled,
  open,
  onOpenChange,
}: TransferOwnershipSelectProps) => {
  return (
    <Select
      value={value}
      onValueChange={onChange}
      disabled={disabled}
      open={open}
      onOpenChange={onOpenChange}
    >
      <SelectTrigger id={id} className={cn("w-full", triggerClassName)}></SelectTrigger>
      <SelectContent>
        {candidates?.map((user) => (
          <SelectItem value={user.id} key={user.id}>
            <div className="flex flex-col items-start text-left">
              <span className="font-medium">{user.name}</span>
              <span className="text-xs text-neutral-500">{user.email}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default TransferOwnershipSelect;
