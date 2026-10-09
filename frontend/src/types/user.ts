export interface UserBase {
  name: string;
  email: string;
  is_active: boolean;
}

export interface UserCreate extends UserBase {
  password: string;
}

export interface UserUpdate {
  name?: string;
  email?: string;
  is_active?: boolean;
}

export interface User extends UserBase {
  user_id: string;
  created_at: string;
  updated_at: string;
  profile_picture_url?: string | null;
}
