import { Html, Text } from "@react-email/components";

type UserFirstLoginEmailProps = {
  name: string;
};

export const UserFirstLoginEmail = ({ name }: UserFirstLoginEmailProps) => {
  return (
    <Html>
      <Text>
        Witaj {name}, cieszymy się, że jesteś z nami!
        <br />
        Zajrzyj do zakładki 'Moje kursy' i rozpocznij naukę.
      </Text>
    </Html>
  );
};

export default UserFirstLoginEmail;
