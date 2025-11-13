import { Button, Html, Text } from "@react-email/components";

export type UserInviteProps = {
  name: string;
  createPasswordLink: string;
};

export const UserInviteEmail = ({ name, createPasswordLink }: UserInviteProps) => {
  return (
    <Html>
      <Text>Witaj {name},</Text>
      <Text>
        Zostałeś zaproszony do naszej platformy.
        <br />
        Kliknij, aby aktywować konto. 🔗
      </Text>
      <Button href={createPasswordLink}>Aktywuj konto</Button>
    </Html>
  );
};

export default UserInviteEmail;
