import { Html, Text } from "@react-email/components";

export type FinishedCourseEmailProps = {
  usersName: string;
  courseName: string;
  completedAt: string;
  groupName: string;
};

export const FinishedCourseEmail = ({
  usersName,
  courseName,
  completedAt,
  groupName,
}: FinishedCourseEmailProps) => {
  return (
    <Html>
      <Text>
        <b>{usersName}</b> finished the course <b>{courseName}</b>.
        <br />
        Completed at: {completedAt}
        <br />
        Group name: {groupName}
      </Text>
    </Html>
  );
};

export default FinishedCourseEmail;
