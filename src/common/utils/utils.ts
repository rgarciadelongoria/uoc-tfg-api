import { ValidCodes } from "../../game/enums/valid-codes.enum";
import { ValidRoles } from "../../user/enums/valid-roles.enum";
import { User } from "../../user/entities/user.entity";

const { google } = require('googleapis');
const MESSAGING_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
const SCOPES = [MESSAGING_SCOPE];

export function isAdminOrSameUser(userId: string, userToken: User) {
    return (userToken.roles?.includes(ValidRoles.ADMIN) || userId === userToken.id);
}

export function isCorrectCode(code: string) {
    return Object.values(ValidCodes).includes(code as ValidCodes);
}

export function getAccessToken() {
    return new Promise(function(resolve, reject) {
      const key = require('../../../lookttery-firebase-adminsdk-xk5hm-71c0b026cf.json');
      const jwtClient = new google.auth.JWT(
        key.client_email,
        null,
        key.private_key,
        SCOPES,
        null
      );
      jwtClient.authorize(function(err, tokens) {
        if (err) {
          reject(err);
          return;
        }
        resolve(tokens.access_token);
      });
    });
  }