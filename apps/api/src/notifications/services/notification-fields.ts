/** Copy identity values while the originating operation still owns the business data. */
export function getNotificationUserFields(user: {
  firstName: string;
  lastName: string;
  email: string;
}) {
  return {
    userFirstName: user.firstName,
    userLastName: user.lastName,
    userEmail: user.email,
  };
}
