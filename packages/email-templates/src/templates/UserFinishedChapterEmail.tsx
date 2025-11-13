import { Button, Html, Text } from "@react-email/components";

export type UserFinishedChapterProps = {
  chapterName: string;
  courseLink: string;
};

export const UserFinishedChapterEmail = ({ chapterName, courseLink }: UserFinishedChapterProps) => {
  return (
    <Html>
      <Text>Świetna robota!</Text>
      <Text>
        Ukończyłeś moduł {chapterName}. <Button href={courseLink}>Zobacz</Button>, co dalej!
      </Text>
    </Html>
  );
};

export default UserFinishedChapterEmail;
