import { Html, Text } from "@react-email/components";

export type NewUserEmailProps = {
  first_name: string;
  last_name: string;
  email: string;
};

export const NewUserEmail = ({ first_name, last_name, email }: NewUserEmailProps) => {
  return (
    <Html>
      <Text>A new user has registered on your platform</Text>
      <Text>
        Name: {first_name} {last_name}
        <br />
        Email:{email}
      </Text>
    </Html>
  );
};

export default NewUserEmail;
