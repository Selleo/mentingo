import { Button, Html, Text } from "@react-email/components";

export type UserAssignedToCourseProps = {
  courseName: string;
  courseLink: string;
};

export const UserAssignedToCourse = ({ courseLink, courseName }: UserAssignedToCourseProps) => {
  return (
    <Html>
      <Text>Zostałeś zapisany na kurs: {courseName}.</Text>
      <Text>
        <Button href={courseLink}>Kliknij</Button>, aby rozpocząć naukę.
      </Text>
    </Html>
  );
};

export default UserAssignedToCourse;
