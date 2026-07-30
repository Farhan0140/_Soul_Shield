import { apiDelete, apiGet, apiPatch, apiPost } from '@/api/client';
import type { Category } from '@/api/types';

export function getCategories(token: string | null) {
  return apiGet<Category[]>('/categories', token);
}

export function createCategory(
  input: { name: string; color_hex?: string },
  token: string | null
) {
  return apiPost<Category>('/categories', input, token);
}

export function updateCategory(
  id: number,
  input: { name?: string; color_hex?: string },
  token: string | null
) {
  return apiPatch<Category>(`/categories/${id}`, input, token);
}

export function deleteCategory(id: number, token: string | null) {
  return apiDelete<void>(`/categories/${id}`, token);
}
