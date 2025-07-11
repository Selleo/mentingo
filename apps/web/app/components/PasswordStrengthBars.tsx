import { useState, useEffect } from "react";

import { validatePassword } from "../modules/Dashboard/Settings/schema/password.schema";

import type React from "react";

interface PasswordStrengthBarsProps {
  password: string;
}

const PasswordStrengthBars: React.FC<PasswordStrengthBarsProps> = ({ password }) => {
  const [passwordScore, setPasswordScore] = useState(0);

  useEffect(() => {
    const validation = validatePassword(password);
    const score = Object.values(validation).filter(Boolean).length;
    setPasswordScore(score);
  }, [password]);

  return (
    <div className="mb-3">
      <div className="-mx-1 flex">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="w-1/5 px-1">
            <div
              className={`h-2 rounded-xl transition-colors ${
                i < passwordScore
                  ? passwordScore <= 2
                    ? "bg-red-400"
                    : passwordScore <= 4
                      ? "bg-yellow-400"
                      : "bg-teal-500"
                  : "bg-gray-200"
              }`}
            ></div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PasswordStrengthBars;
