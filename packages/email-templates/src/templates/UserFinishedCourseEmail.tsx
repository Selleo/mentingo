import { Button, Html, Text } from "@react-email/components";

export type UserFinishedCourseProps = {
  name: string;
  courseName: string;
  certificateDownloadLink: string;
};

export const UserFinishedCourseEmail = ({
  name,
  courseName,
  certificateDownloadLink,
}: UserFinishedCourseProps) => {
  return (
    <Html>
      <Text>Brawo {name}!</Text>
      <Text>
        Ukończyłeś kurs {courseName}. <Button href={certificateDownloadLink}>Pobierz</Button>{" "}
        certyfikat!
      </Text>
    </Html>
  );
};

export default UserFinishedCourseEmail;
