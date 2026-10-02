import AsyncStorage from "@react-native-async-storage/async-storage";

export type User = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
};

type StoredUser = User & { password: string };

const USERS_KEY = "ogasela_users_v1";

export class AuthError extends Error {}

async function readUsers(): Promise<StoredUser[]> {
  const raw = await AsyncStorage.getItem(USERS_KEY);
  return raw ? (JSON.parse(raw) as StoredUser[]) : [];
}

async function writeUsers(users: StoredUser[]): Promise<void> {
  await AsyncStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function normalizePhone(value: string): string {
  return value.replace(/\s+/g, "");
}

export async function findExistingUser(
  email: string,
  phone: string
): Promise<StoredUser | undefined> {
  const users = await readUsers();
  return users.find(
    (user) =>
      normalize(user.email) === normalize(email) ||
      normalizePhone(user.phone) === normalizePhone(phone)
  );
}

export async function registerUser(input: {
  fullName: string;
  email: string;
  phone: string;
  password: string;
}): Promise<User> {
  const existing = await findExistingUser(input.email, input.phone);
  if (existing) {
    throw new AuthError(
      "An account with this email or phone number already exists."
    );
  }

  const users = await readUsers();
  const newUser: StoredUser = {
    id: `${Date.now()}`,
    fullName: input.fullName.trim(),
    email: normalize(input.email),
    phone: input.phone.trim(),
    password: input.password,
  };
  users.push(newUser);
  await writeUsers(users);

  const { password, ...publicUser } = newUser;
  return publicUser;
}

export async function loginWithEmail(
  email: string,
  password: string
): Promise<User> {
  const users = await readUsers();
  const match = users.find((user) => normalize(user.email) === normalize(email));

  if (!match) {
    throw new AuthError("No account found with this email address.");
  }
  if (match.password !== password) {
    throw new AuthError("Incorrect password. Please try again.");
  }

  const { password: _password, ...publicUser } = match;
  return publicUser;
}

export async function findUserByPhone(phone: string): Promise<User | undefined> {
  const users = await readUsers();
  const match = users.find((user) => normalizePhone(user.phone) === normalizePhone(phone));
  if (!match) return undefined;

  const { password: _password, ...publicUser } = match;
  return publicUser;
}

export async function loginWithPhone(phone: string): Promise<User> {
  const user = await findUserByPhone(phone);
  if (!user) {
    throw new AuthError("No account found with this phone number.");
  }
  return user;
}
