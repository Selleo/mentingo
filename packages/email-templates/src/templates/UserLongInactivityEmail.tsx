import { Button, Html, Text } from "@react-email/components";

export type UserLongInactivityProps = {
  name: string;
  courseLink: string;
};

export const UserLongInactivityEmail = ({ name, courseLink }: UserLongInactivityProps) => {
  return (
    <Html>
      <Text>
        {name}, Twój <Button href={courseLink}>kurs</Button> nadal czeka! Nie pozwól, by postęp się
        zatrzymał.
      </Text>
    </Html>
  );
};

export default UserLongInactivityEmail;
