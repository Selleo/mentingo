export type UserInvite = {
  createdByUserName: string;
  token: string;
  email: string;
};

export class UserInviteEvent {
  constructor(public readonly userInvite: UserInvite) {}
}
