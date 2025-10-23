import { Button, Html, Text } from "@react-email/components";

export type UserShortInactivityProps = {
  name: string;
  courseName: string;
  courseLink: string;
};

export const UserShortInactivityEmail = ({
  name,
  courseName,
  courseLink,
}: UserShortInactivityProps) => {
  return (
    <Html>
      <Text>Cześć {name}, dawno Cię nie było!</Text>
      <Text>
        <Button href={courseLink}>Wróć</Button> do kursu {courseName} i kontynuuj naukę.
      </Text>
    </Html>
  );
};

export default UserShortInactivityEmail;
