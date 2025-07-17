import { useFormContext } from "react-hook-form";

import { getBarColor } from "~/modules/Auth/utils";
import { validatePasswordStrength } from "~/modules/Dashboard/Settings/schema/password.schema";

import type React from "react";

interface PasswordStrengthBarsProps {
  fieldName: string;
}

const PasswordStrengthBars: React.FC<PasswordStrengthBarsProps> = ({ fieldName }) => {
  const { watch } = useFormContext();
  const password = watch(fieldName) || "";

  const validation = validatePasswordStrength(password);
  const passwordStrength = Object.values(validation).filter(Boolean).length;

  return (
    <div className="mb-3">
      <div className="-mx-1 flex">
        {[...Array(5)].map((_, index) => (
          <div key={index} className="w-1/5 px-1">
            <div
              className={`h-2 rounded-xl transition-colors ${getBarColor(index, passwordStrength)}`}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default PasswordStrengthBars;
