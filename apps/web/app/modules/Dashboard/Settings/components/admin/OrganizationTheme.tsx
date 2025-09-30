import { HexColorPicker } from "react-colorful";

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { useTheme } from "~/modules/Theme";

export const OrganizationTheme = () => {
  const { primaryColor, setPrimaryColor } = useTheme();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Organization Theme</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex w-fit flex-col space-y-4">
          <HexColorPicker color={primaryColor} onChange={setPrimaryColor} />
          <div className="flex items-center justify-center space-x-1">
            <span className="text-sm text-gray-500">#</span>
            <Input
              type="text"
              id="primary-color-input"
              value={primaryColor.replace(/^#/, "")}
              onChange={(event) => {
                const value = event.target.value.startsWith("#")
                  ? event.target.value
                  : `#${event.target.value}`;

                if (/^#([0-9A-Fa-f]{3}){1,2}$/.test(value)) {
                  setPrimaryColor(value);
                }
              }}
              className="w-24"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
