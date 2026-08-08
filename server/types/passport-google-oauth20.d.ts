declare module 'passport-google-oauth20' {
  import { Strategy } from 'passport';

  export interface Profile {
    id: string;
    displayName: string;
    name?: {
      givenName?: string;
      familyName?: string;
    };
    emails?: Array<{ value: string; type?: string }>;
    photos?: Array<{ value: string }>;
    provider: string;
  }

  export type VerifyCallback = (err: Error | null, user?: any, info?: any) => void;

  export class Strategy implements Strategy {
    constructor(options: {
      clientID: string;
      clientSecret: string;
      callbackURL: string;
    }, verify: (
      accessToken: string,
      refreshToken: string,
      profile: Profile,
      done: VerifyCallback
    ) => void);
  }
}
