type userDetailsMock = {
  id: string;
  role: string;
  firstName: string | null;
  lastName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  jobTitle: string | null;
  description: string | null;
  forbidden?: boolean | null;
};

export const userDetailsMocks = {
  data: [
    {
      id: "1234",
      firstName: "John",
      lastName: "Doe",
      contactEmail: "john@example.com",
      contactPhone: "123456789",
      jobTitle: "Content Creator",
      description: "About John",
      role: "content_creator",
      forbidden: false,
    },
    {
      id: "5678",
      firstName: "Johnny",
      lastName: "Dough",
      contactEmail: "johnny_dough@example.com",
      contactPhone: "700700700",
      jobTitle: "Professional Student",
      description: "About Johnny",
      role: "student",
      forbidden: true,
    },
  ] as userDetailsMock[],
};
