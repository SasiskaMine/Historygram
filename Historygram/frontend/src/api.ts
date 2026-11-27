
export const BASE_URL =
  import.meta.env.VITE_API_URL ||
  `${window.location.protocol}//${window.location.hostname}:3001`;

export interface User {
  id: number;
  account: string;
  email: string;
  avatar: string | null;
  totalLikes: number;
  storiesCount: number;
}

export interface Story {
  id: number;
  account: string;
  title: string;
  text: string;
  collection: string;
  likes: number;
  img?: string;
  authorAvatar?: string | null;
  likedByMe?: boolean;
  createdAt?: number;
}

export interface StoryCollection {
  name: string;
  count: number;
  coverImg: string | null;
}

export interface AuthResponse {
  status: 'ok';
  user: User;
}

export interface MeResponse {
  status: 'ok';
  user: User | null;
}

export interface CreateStoryResponse {
  status: 'ok';
  story: Story;
}

export interface LikeResponse {
  status: 'ok';
  storyId: number;
  likes: number;
  likedByMe: boolean;
}

export function resolveMediaUrl(src?: string | null, fallback = ''): string {
  if (!src) return fallback;
  if (
    src.startsWith('http://') ||
    src.startsWith('https://') ||
    src.startsWith('data:') ||
    src.startsWith('blob:')
  ) {
    return src;
  }
  if (src.startsWith('/uploads/')) {
    return `${BASE_URL}${src}`;
  }
  return src;
}

export async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const isFormData = options.body instanceof FormData;
  const headers: HeadersInit = isFormData
    ? { ...options.headers }
    : {
        'Content-Type': 'application/json',
        ...options.headers,
      };

  const response = await fetch(BASE_URL + endpoint, {
    credentials: 'include',
    ...options,
    headers,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      data && typeof data === 'object' && 'message' in data && typeof data.message === 'string'
        ? data.message
        : `Ошибка: ${response.status}`;
    throw new Error(message);
  }

  return data as T;
}

export function fetchStories(collection?: string): Promise<Story[]> {
  const query =
    collection && collection !== 'Все'
      ? `?collection=${encodeURIComponent(collection)}`
      : '';
  return request<Story[]>(`/stories${query}`);
}

export function fetchCollections(): Promise<StoryCollection[]> {
  return request<StoryCollection[]>('/stories/collections');
}

export function createStory(payload: {
  title: string;
  text: string;
  collection: string;
  imageFile?: File | null;
  img?: string;
}): Promise<CreateStoryResponse> {
  if (payload.imageFile) {
    const formData = new FormData();
    formData.append('title', payload.title);
    formData.append('text', payload.text);
    formData.append('collection', payload.collection);
    formData.append('image', payload.imageFile);
    return request<CreateStoryResponse>('/stories', {
      method: 'POST',
      body: formData,
    });
  }

  return request<CreateStoryResponse>('/stories', {
    method: 'POST',
    body: JSON.stringify({
      title: payload.title,
      text: payload.text,
      collection: payload.collection,
      img: payload.img ?? '',
    }),
  });
}

export function toggleStoryLike(storyId: number): Promise<LikeResponse> {
  return request<LikeResponse>(`/stories/${storyId}/like`, {
    method: 'POST',
  });
}

export function deleteStory(storyId: number): Promise<{ status: 'ok'; deletedId: number }> {
  return request<{ status: 'ok'; deletedId: number }>(`/stories/${storyId}`, {
    method: 'DELETE',
  });
}

export function fetchCurrentUser(): Promise<MeResponse> {
  return request<MeResponse>('/auth/me');
}

export function loginUser(payload: { login: string; password: string }): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function registerUser(payload: {
  account: string;
  email: string;
  password: string;
}): Promise<AuthResponse> {
  return request<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function uploadAvatar(file: File): Promise<AuthResponse> {
  const formData = new FormData();
  formData.append('avatar', file);
  return request<AuthResponse>('/auth/avatar', {
    method: 'POST',
    body: formData,
  });
}

export function logoutUser(): Promise<{ status: 'ok' }> {
  return request<{ status: 'ok' }>('/auth/logout', {
    method: 'POST',
  });
}
