// TODO <inside this uncomment this section when backend categories api is ready>
// import { apiDelete, apiGet, apiPatch, apiPost } from '@/api/client';
import type { Category } from '@/api/types';

export function getCategories(token: string | null) {
  // TODO <inside this uncomment this section when backend categories api is ready>
  // return apiGet<Category[]>('/categories', token);
  return Promise.resolve<Category[]>([]);
}

export function createCategory(
  input: { name: string; color_hex?: string },
  token: string | null
) {
  // TODO <inside this uncomment this section when backend categories api is ready>
  // return apiPost<Category>('/categories', input, token);
  return Promise.reject(new Error('Category creation is temporarily unavailable.'));
}

export function updateCategory(
  id: number,
  input: { name?: string; color_hex?: string },
  token: string | null
) {
  // TODO <inside this uncomment this section when backend categories api is ready>
  // return apiPatch<Category>(`/categories/${id}`, input, token);
  return Promise.reject(new Error('Category updates are temporarily unavailable.'));
}

export function deleteCategory(id: number, token: string | null) {
  // TODO <inside this uncomment this section when backend categories api is ready>
  // return apiDelete<void>(`/categories/${id}`, token);
  return Promise.reject(new Error('Category deletion is temporarily unavailable.'));
}
