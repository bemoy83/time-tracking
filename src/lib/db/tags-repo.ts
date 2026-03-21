import type { Tag, TagCategory } from '../tags';
import { getDB } from './core';

// ============================================================
// TagCategory repo
// ============================================================

export async function addTagCategory(category: TagCategory): Promise<void> {
  const db = await getDB();
  await db.add('tagCategories', category);
}

export async function getTagCategory(id: string): Promise<TagCategory | null> {
  const db = await getDB();
  return (await db.get('tagCategories', id)) ?? null;
}

export async function getAllTagCategories(): Promise<TagCategory[]> {
  const db = await getDB();
  return db.getAll('tagCategories');
}

export async function updateTagCategory(category: TagCategory): Promise<void> {
  const db = await getDB();
  await db.put('tagCategories', category);
}

export async function deleteTagCategory(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('tagCategories', id);
}

// ============================================================
// Tag repo
// ============================================================

export async function addTag(tag: Tag): Promise<void> {
  const db = await getDB();
  await db.add('tags', tag);
}

export async function getTag(id: string): Promise<Tag | null> {
  const db = await getDB();
  return (await db.get('tags', id)) ?? null;
}

export async function getAllTags(): Promise<Tag[]> {
  const db = await getDB();
  return db.getAll('tags');
}

export async function getTagsByCategory(categoryId: string): Promise<Tag[]> {
  const db = await getDB();
  return db.getAllFromIndex('tags', 'by-category', categoryId);
}

export async function updateTag(tag: Tag): Promise<void> {
  const db = await getDB();
  await db.put('tags', tag);
}

export async function deleteTag(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('tags', id);
}

export async function deleteAllTags(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('tags', 'readwrite');
  await tx.store.clear();
  await tx.done;
}

export async function deleteAllTagCategories(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('tagCategories', 'readwrite');
  await tx.store.clear();
  await tx.done;
}
